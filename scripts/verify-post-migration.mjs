/**
 * Verificación funcional post-migración 003 — proyecto remoto Supabase.
 *
 * Parte A (manual): supabase/tests/verify_schema_003.sql en SQL Editor.
 * Parte B (este script): pruebas RLS ofensivas con tres cuentas existentes.
 *
 * Sin Docker, sin Supabase CLI, sin service_role, sin signUp ni creación de usuarios.
 *
 * Uso: npm run verify:post-migration
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const ACCOUNT_VARS = [
  'VERIFY_NEGOCIO_EMAIL',
  'VERIFY_NEGOCIO_PASSWORD',
  'VERIFY_CREADOR_EMAIL',
  'VERIFY_CREADOR_PASSWORD',
  'VERIFY_TERCERO_EMAIL',
  'VERIFY_TERCERO_PASSWORD',
];

function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
    break;
  }
}

loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SITE_URL = process.env.SITE_URL || 'http://localhost:1000';

const runId = `verify-${Date.now().toString(36)}`;
const results = [];
const cleanup = { campaignId: null, applicationId: null, favoriteId: null };

const preamble = {
  remoteProject: '(desconocido)',
  schemaSqlVerified: false,
  loginNegocio: 'PENDING',
  loginCreador: 'PENDING',
  loginTercero: 'PENDING',
  demoModeDisabled: 'PENDING',
  docker: 'NO UTILIZADO',
};

function truthyEnv(name) {
  const v = (process.env[name] ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'si' || v === 'sí';
}

function remoteProjectLabel(url) {
  if (!url) return '(sin URL)';
  try {
    const host = new URL(url).hostname;
    const ref = host.split('.')[0];
    return ref && ref !== host ? `${ref} (${host})` : host;
  } catch {
    return '(URL inválida)';
  }
}

function maskEmail(email) {
  if (!email || !email.includes('@')) return '(sin email)';
  const [local, domain] = email.split('@');
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}***@${domain}`;
}

/** Solo PGRST202 indica función ausente en PostgREST (no sobrecargas sin parámetros). */
function isRpcMissing(error) {
  return Boolean(error?.code === 'PGRST202');
}

function classifyRpcError(error) {
  if (!error) return 'ok';
  if (isRpcMissing(error)) return 'rpc_missing';
  const msg = error.message ?? '';
  if (error.code === '42501' || /permission denied/i.test(msg)) return 'forbidden';
  if (/No autorizado|no autorizado|Estado inválido|Postulación no encontrada|Solo podés|No tenés permiso/i.test(msg)) {
    return 'business_rule';
  }
  if (error.code === 'PGRST116') return 'not_found';
  return 'other';
}

/** @typedef {'PASS'|'FAIL'|'SKIPPED'|'ERROR'} TestStatus */

/**
 * @param {string} id
 * @param {string} name
 * @param {TestStatus} status
 * @param {string} [detail]
 */
function record(id, name, status, detail = '') {
  results.push({ id, name, status, detail });
  console.log(`[${status}] ${id} ${name}${detail ? ` — ${detail}` : ''}`);
}

function client(accessToken) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * @param {'negocio'|'creador'|'tercero'} roleKey
 */
async function loginAccount(roleKey) {
  const prefix = roleKey.toUpperCase();
  const email = process.env[`VERIFY_${prefix}_EMAIL`]?.trim();
  const password = process.env[`VERIFY_${prefix}_PASSWORD`];

  if (!email || !password) {
    return { ok: false, reason: 'Faltan VERIFY_*_EMAIL o VERIFY_*_PASSWORD en .env.local' };
  }

  const supabase = client();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (/Invalid login credentials/i.test(error.message)) {
      return { ok: false, reason: 'Credenciales incorrectas' };
    }
    if (/Email not confirmed/i.test(error.message)) {
      return { ok: false, reason: 'Correo no confirmado en Supabase Auth' };
    }
    return { ok: false, reason: error.message };
  }

  if (!data.session?.access_token) {
    return { ok: false, reason: 'Sesión vacía tras login' };
  }

  return {
    ok: true,
    email,
    userId: data.user.id,
    supabase: client(data.session.access_token),
  };
}

async function getProfile(supabase) {
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) throw new Error('No se pudo obtener usuario autenticado');
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, account_id')
    .eq('account_id', user.id)
    .single();
  if (error) throw new Error(`Perfil no encontrado: ${error.message}`);
  return { user, profile: data };
}

async function runOffensiveTests(business, creator, third) {
  const bizCtx = await getProfile(business.supabase);
  const creCtx = await getProfile(creator.supabase);
  const thirdCtx = await getProfile(third.supabase);

  record('U1', 'Perfil negocio tiene role=business', bizCtx.profile.role === 'business' ? 'PASS' : 'FAIL', `role=${bizCtx.profile.role}`);
  record('U2', 'Perfil creador tiene role=creator', creCtx.profile.role === 'creator' ? 'PASS' : 'FAIL', `role=${creCtx.profile.role}`);

  const { error: roleErr } = await creator.supabase
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', creCtx.profile.id);
  record('R1', 'Creador no puede elevar role a admin', roleErr ? 'PASS' : 'FAIL', roleErr?.message ?? 'update permitido');

  const { data: cp, error: cpErr } = await creator.supabase
    .from('creator_profiles')
    .select('id, score, followers_declared, engagement_declared')
    .eq('profile_id', creCtx.profile.id)
    .single();
  if (cpErr) {
    record('R2', 'Creador no puede modificar score', 'ERROR', cpErr.message);
  } else {
    const { error: scoreErr } = await creator.supabase
      .from('creator_profiles')
      .update({ score: 99 })
      .eq('id', cp.id);
    record('R2', 'Creador no puede modificar score', scoreErr ? 'PASS' : 'FAIL', scoreErr?.message ?? 'update permitido');
  }

  const { error: verErr } = await creator.supabase
    .from('profiles')
    .update({ verified: true })
    .eq('id', creCtx.profile.id);
  record('R3', 'Creador no puede auto-verificarse (profiles)', verErr ? 'PASS' : 'FAIL', verErr?.message ?? 'update permitido');

  const { data: bp, error: bpErr } = await business.supabase
    .from('business_profiles')
    .select('id')
    .eq('profile_id', bizCtx.profile.id)
    .single();
  if (bpErr) {
    record('R4', 'Negocio no puede verificarse', 'ERROR', bpErr.message);
  } else {
    const { error: bizVerErr } = await business.supabase
      .from('business_profiles')
      .update({ verified: true })
      .eq('id', bp.id);
    record('R4', 'Negocio no puede verificarse', bizVerErr ? 'PASS' : 'FAIL', bizVerErr?.message ?? 'update permitido');
  }

  if (bpErr) {
    record('R5', 'Negocio crea campaña open', 'SKIPPED', 'Sin business_profile');
    record('R6', 'Creador crea postulación', 'SKIPPED', 'Sin campaña');
    record('R7', 'Creador no puede auto-aceptar postulación', 'SKIPPED', 'Sin postulación');
    record('R8', 'Negocio no modifica propuesta/precio', 'SKIPPED', 'Sin postulación');
    record('R9', 'Negocio shortlist vía RPC', 'SKIPPED', 'Sin postulación');
    record('R10', 'Negocio acepta vía RPC business_accept_application', 'SKIPPED', 'Sin postulación');
    record('R11', 'Tercero no crea conversación directa', 'SKIPPED', 'Sin campaña');
    record('R12', 'Tercero no lee conversaciones ajenas', 'SKIPPED', 'Sin conversación');
    record('R13', 'Negocio accede a conversación propia', 'SKIPPED', 'Sin conversación');
    record('R14', 'Tercero no lee mensajes ajenos', 'SKIPPED', 'Sin conversación');
  } else {
    const { data: campaign, error: campErr } = await business.supabase
      .from('campaigns')
      .insert({
        business_id: bp.id,
        title: `Campaña ${runId}`,
        description: 'Registro efímero de verificación RLS post-migración 003.',
        category: 'Tecnología',
        city: 'San Juan',
        budget_min: 10000,
        budget_max: 50000,
        deliverables: ['1 reel'],
        status: 'open',
        deadline: '2026-12-31',
      })
      .select('id')
      .single();
    if (campaign) cleanup.campaignId = campaign.id;
    record('R5', 'Negocio crea campaña open', !campErr && campaign?.id ? 'PASS' : 'FAIL', campErr?.message ?? 'sin id');

    const { data: creatorProf, error: creatorProfErr } = await creator.supabase
      .from('creator_profiles')
      .select('id')
      .eq('profile_id', creCtx.profile.id)
      .single();

    let application = null;
    if (campErr || !campaign?.id || creatorProfErr || !creatorProf?.id) {
      record('R6', 'Creador crea postulación', 'SKIPPED', creatorProfErr?.message ?? campErr?.message ?? 'prerrequisito');
    } else {
      const { data: app, error: appErr } = await creator.supabase
        .from('applications')
        .insert({
          campaign_id: campaign.id,
          creator_id: creatorProf.id,
          message: `Propuesta ${runId}`,
          proposed_price: 25000,
        })
        .select('id, status')
        .single();
      application = app;
      if (app?.id) cleanup.applicationId = app.id;
      record('R6', 'Creador crea postulación pending', !appErr && app?.status === 'pending' ? 'PASS' : 'FAIL', appErr?.message ?? app?.status);
    }

    if (!application?.id) {
      record('R7', 'Creador no puede auto-aceptar postulación', 'SKIPPED', 'Sin postulación');
      record('R8', 'Negocio no modifica propuesta/precio', 'SKIPPED', 'Sin postulación');
      record('R9', 'Negocio shortlist vía RPC', 'SKIPPED', 'Sin postulación');
      record('R10', 'Negocio acepta vía RPC business_accept_application', 'SKIPPED', 'Sin postulación');
    } else {
      const { error: selfAcceptErr } = await creator.supabase
        .from('applications')
        .update({ status: 'accepted' })
        .eq('id', application.id);
      record('R7', 'Creador no puede auto-aceptar postulación', selfAcceptErr ? 'PASS' : 'FAIL', selfAcceptErr?.message ?? 'update permitido');

      const { error: priceErr } = await business.supabase
        .from('applications')
        .update({ proposed_price: 1, message: 'Modificado por negocio' })
        .eq('id', application.id);
      record('R8', 'Negocio no modifica propuesta/precio', priceErr ? 'PASS' : 'FAIL', priceErr?.message ?? 'update permitido');

      const { error: shortlistErr } = await business.supabase.rpc('business_shortlist_application', {
        p_application_id: application.id,
      });
      if (isRpcMissing(shortlistErr)) {
        record('R9', 'Negocio shortlist vía RPC business_shortlist_application', 'FAIL', `PGRST202 (${shortlistErr?.message})`);
      } else if (shortlistErr) {
        record('R9', 'Negocio shortlist vía RPC business_shortlist_application', 'FAIL', `[${classifyRpcError(shortlistErr)}] ${shortlistErr.message}`);
      } else {
        record('R9', 'Negocio shortlist vía RPC business_shortlist_application', 'PASS', 'status→shortlisted');
      }

      const { data: convId, error: acceptErr } = await business.supabase.rpc('business_accept_application', {
        p_application_id: application.id,
      });
      if (isRpcMissing(acceptErr)) {
        record('R10', 'Negocio acepta vía RPC business_accept_application', 'FAIL', `PGRST202 (${acceptErr?.message})`);
      } else if (acceptErr) {
        record('R10', 'Negocio acepta vía RPC business_accept_application', 'FAIL', `[${classifyRpcError(acceptErr)}] ${acceptErr.message}`);
      } else {
        record('R10', 'Negocio acepta vía RPC business_accept_application', convId ? 'PASS' : 'FAIL', convId ? `conversation=${convId}` : 'sin conversation_id');
      }

      const { error: convInsertErr } = await third.supabase
        .from('conversations')
        .insert({ campaign_id: campaign.id })
        .select('id')
        .single();
      record('R11', 'Tercero no crea conversación directa', convInsertErr ? 'PASS' : 'FAIL', convInsertErr?.message ?? 'insert permitido');

      const convToProbe = convId;
      if (!convToProbe) {
        record('R12', 'Tercero no lee conversaciones ajenas', 'SKIPPED', 'Sin conversación de prueba');
        record('R13', 'Negocio accede a conversación propia', 'SKIPPED', 'Sin conversación de prueba');
        record('R14', 'Tercero no lee mensajes ajenos', 'SKIPPED', 'Sin conversación de prueba');
      } else {
        const { data: thirdConvs, error: thirdConvErr } = await third.supabase
          .from('conversations')
          .select('id')
          .eq('id', convToProbe);
        record('R12', 'Tercero no lee conversaciones ajenas', !thirdConvErr && (thirdConvs?.length ?? 0) === 0 ? 'PASS' : 'FAIL', `filas=${thirdConvs?.length ?? 0}`);

        const { data: bizConvs, error: bizConvErr } = await business.supabase
          .from('conversations')
          .select('id')
          .eq('id', convToProbe);
        record('R13', 'Negocio accede a conversación propia', !bizConvErr && (bizConvs?.length ?? 0) === 1 ? 'PASS' : 'FAIL', `filas=${bizConvs?.length ?? 0}`);

        const { data: thirdMsgs, error: thirdMsgErr } = await third.supabase
          .from('messages')
          .select('id')
          .eq('conversation_id', convToProbe);
        record('R14', 'Tercero no lee mensajes ajenos', !thirdMsgErr && (thirdMsgs?.length ?? 0) === 0 ? 'PASS' : 'FAIL', `filas=${thirdMsgs?.length ?? 0}`);
      }
    }

    if (!creatorProfErr && creatorProf?.id) {
      const { data: { user: bizUser } } = await business.supabase.auth.getUser();
      if (!bizUser?.id) {
        record('R15', 'Tercero no ve favoritos ajenos', 'ERROR', 'Sin usuario negocio para favorito');
      } else {
      const { data: fav, error: favErr } = await business.supabase
        .from('favorites')
        .insert({ account_id: bizUser.id, creator_id: creatorProf.id })
        .select('id')
        .single();
      if (fav?.id) cleanup.favoriteId = fav.id;
      if (favErr && !/duplicate|23505/i.test(favErr.message ?? '')) {
        record('R15', 'Negocio registra favorito de prueba', 'FAIL', favErr.message);
      } else {
        const { count, error: thirdFavErr } = await third.supabase
          .from('favorites')
          .select('*', { count: 'exact', head: true });
        record('R15', 'Tercero no ve favoritos ajenos', !thirdFavErr && (count ?? 0) === 0 ? 'PASS' : 'FAIL', `count=${count ?? 0}`);
      }
      }
    } else {
      record('R15', 'Tercero no ve favoritos ajenos', 'SKIPPED', 'Sin creator_profile');
    }
  }

  const { data: thirdNotifs, error: notifErr } = await third.supabase
    .from('notifications')
    .select('id, account_id');
  if (notifErr) {
    record('R16', 'Tercero solo ve sus notificaciones', 'ERROR', notifErr.message);
  } else {
    const leaked = thirdNotifs?.some(n => n.account_id !== thirdCtx.user.id);
    record('R16', 'Tercero solo ve sus notificaciones', !leaked ? 'PASS' : 'FAIL', `total=${thirdNotifs?.length ?? 0}`);
  }

  const { error: adminRpcErr } = await creator.supabase.rpc('admin_set_profile_verified', {
    p_profile_id: creCtx.profile.id,
    p_verified: true,
  });
  if (isRpcMissing(adminRpcErr)) {
    record('R17', 'No-admin bloqueado en admin_set_profile_verified', 'FAIL', `PGRST202 (${adminRpcErr?.message})`);
  } else if (!adminRpcErr) {
    record('R17', 'No-admin no ejecuta admin_set_profile_verified', 'FAIL', 'RPC ejecutada sin error');
  } else {
    const kind = classifyRpcError(adminRpcErr);
    record(
      'R17',
      'No-admin no ejecuta admin_set_profile_verified',
      kind === 'business_rule' || kind === 'forbidden' ? 'PASS' : 'FAIL',
      `[${kind}] ${adminRpcErr.message}`,
    );
  }
}

async function cleanupTestData(business) {
  if (!business?.supabase) return;
  const sb = business.supabase;

  if (cleanup.favoriteId) {
    await sb.from('favorites').delete().eq('id', cleanup.favoriteId);
  }

  if (cleanup.campaignId) {
    const { data: camp } = await sb.from('campaigns').select('status').eq('id', cleanup.campaignId).maybeSingle();
    if (camp?.status === 'open') {
      await sb.from('campaigns').delete().eq('id', cleanup.campaignId);
    } else {
      console.log(`[INFO] Limpieza: campaña ${cleanup.campaignId} conservada (estado=${camp?.status ?? 'desconocido'})`);
    }
  }
}

function printPreamble() {
  console.log('\n=== Precondiciones (remoto, sin Docker) ===');
  console.log(`Proyecto remoto: ${preamble.remoteProject}`);
  console.log(`Schema 003 confirmado manualmente: ${preamble.schemaSqlVerified ? 'sí' : 'no'}`);
  console.log(`Login negocio: ${preamble.loginNegocio}`);
  console.log(`Login creador: ${preamble.loginCreador}`);
  console.log(`Login tercero: ${preamble.loginTercero}`);
  console.log(`Modo demo desactivado: ${preamble.demoModeDisabled}`);
  console.log(`Docker: ${preamble.docker}`);
  console.log(`Run ID: ${runId}`);
  console.log('');
}

function printSummary() {
  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIPPED').length;
  const error = results.filter(r => r.status === 'ERROR').length;

  console.log('\n=== Resumen ===');
  console.log(`PASS: ${pass} | FAIL: ${fail} | SKIPPED: ${skipped} | ERROR: ${error} | TOTAL: ${results.length}`);

  const bad = results.filter(r => r.status === 'FAIL' || r.status === 'ERROR');
  if (bad.length) {
    console.log('\nFallos / errores:');
    for (const r of bad) console.log(` - [${r.status}] ${r.id}: ${r.name} — ${r.detail}`);
  }
}

async function main() {
  console.log('\n=== KUVO Verificación post-migración 003 (remoto) ===');

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('ERROR: Faltan SUPABASE_URL y SUPABASE_ANON_KEY');
    process.exit(1);
  }

  preamble.remoteProject = remoteProjectLabel(SUPABASE_URL);
  preamble.schemaSqlVerified = truthyEnv('VERIFY_SCHEMA_003_OK');
  preamble.demoModeDisabled = process.env.NEXT_PUBLIC_DEMO_MODE !== 'true' ? 'PASS' : 'FAIL';

  printPreamble();

  if (!preamble.schemaSqlVerified) {
    record('PRE', 'Esquema 003 confirmado manualmente', 'ERROR', 'Ejecutá supabase/tests/verify_schema_003.sql y definí VERIFY_SCHEMA_003_OK=true');
    printSummary();
    process.exit(1);
  }

  if (preamble.demoModeDisabled === 'FAIL') {
    record('PRE', 'Modo demo desactivado', 'FAIL', 'NEXT_PUBLIC_DEMO_MODE debe ser false');
  }

  const missingVars = ACCOUNT_VARS.filter(v => !(process.env[v] ?? '').trim());
  if (missingVars.length) {
    record('PRE', 'Variables VERIFY_* de cuentas', 'ERROR', `Faltan: ${missingVars.join(', ')}`);
    printSummary();
    process.exit(1);
  }

  /** @type {Awaited<ReturnType<typeof loginAccount>>[]} */
  const sessions = [];

  for (const [key, label] of [['negocio', 'Negocio'], ['creador', 'Creador'], ['tercero', 'Tercero']]) {
    const preambleKey = { negocio: 'loginNegocio', creador: 'loginCreador', tercero: 'loginTercero' }[key];
    const result = await loginAccount(key);
    if (result.ok) {
      preamble[preambleKey] = 'PASS';
      console.log(`[PASS] Login ${label.toLowerCase()}: ${maskEmail(result.email)}`);
      sessions.push(result);
    } else {
      preamble[preambleKey] = 'FAIL';
      console.log(`[FAIL] Login ${label.toLowerCase()}: ${result.reason}`);
      record('PRE', `Login ${label.toLowerCase()}`, 'ERROR', result.reason ?? 'desconocido');
    }
  }

  printPreamble();

  if (sessions.length !== 3) {
    console.error('\nSuite detenida: las tres cuentas VERIFY_* deben existir, estar confirmadas e iniciar sesión con contraseña correcta.');
    printSummary();
    process.exit(1);
  }

  const [business, creator, third] = sessions;

  try {
    await runOffensiveTests(business, creator, third);
  } catch (err) {
    record('RUN', 'Ejecución pruebas ofensivas', 'ERROR', err instanceof Error ? err.message : String(err));
  } finally {
    try {
      await cleanupTestData(business);
    } catch (err) {
      console.log(`[WARN] Limpieza parcial: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  try {
    const healthRes = await fetch(`${SITE_URL}/api/health`);
    const health = await healthRes.json();
    record('H1', 'GET /api/health responde', healthRes.ok ? 'PASS' : 'FAIL', `status=${healthRes.status}`);
    record('H2', '/api/health readiness ok', health.readiness === 'ok' ? 'PASS' : 'FAIL', String(health.readiness));
  } catch (err) {
    record('H1', 'GET /api/health responde', 'ERROR', err instanceof Error ? err.message : String(err));
    record('H2', '/api/health readiness ok', 'SKIPPED', 'servidor no disponible');
  }

  printSummary();

  const exitCode = results.some(r => r.status === 'FAIL' || r.status === 'ERROR') ? 1 : 0;
  process.exit(exitCode);
}

main().catch(err => {
  console.error('ERROR fatal:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
