'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, BadgeCheck, BriefcaseBusiness, Check, Flag, LayoutDashboard, Search, ShieldCheck, Users, X } from 'lucide-react';
import { Logo } from './Logo';
import { createClient, isDemoMode, isSupabaseConfigured } from '@/lib/supabase/client';
import { demoCampaigns, demoCreators } from '@/lib/demo';

type AdminProfile = {
  id: string;
  full_name: string;
  username?: string;
  role: string;
  city?: string;
  verified?: boolean;
  active?: boolean;
};

export function AdminPanel() {
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [tab, setTab] = useState<'overview' | 'profiles' | 'campaigns'>('overview');
  const [toast, setToast] = useState('');
  const [healthOk, setHealthOk] = useState<boolean | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    if (isDemoMode()) {
      setProfiles(demoCreators.map(c => ({
        id: c.profileId,
        full_name: c.name,
        username: c.username.replace('@', ''),
        role: 'creator',
        city: c.city,
        verified: c.verified,
        active: true,
      })));
      setCampaigns(demoCampaigns);
      setAllowed(true);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    if (!supabase) { setLoading(false); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: me } = await supabase.from('profiles').select('role, active').eq('account_id', user.id).single();
    if (me?.role !== 'admin' || me.active === false) { setLoading(false); return; }

    setAllowed(true);
    const [{ data: ps }, { data: cs }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('campaigns').select('*,business_profiles(business_name)').order('created_at', { ascending: false }).limit(100),
    ]);
    if (ps) setProfiles(ps);
    if (cs) setCampaigns(cs);

    try {
      const res = await fetch('/api/health');
      const body = await res.json();
      setHealthOk(Boolean(body.ok && body.readiness === 'ok'));
    } catch {
      setHealthOk(false);
    }

    setLoading(false);
  }

  function notify(x: string) { setToast(x); setTimeout(() => setToast(''), 2200); }

  async function toggleVerify(id: string, current: boolean) {
    if (isSupabaseConfigured()) {
      const { error } = await createClient()?.rpc('admin_set_profile_verified', {
        p_profile_id: id,
        p_verified: !current,
      }) ?? { error: null };
      if (error) { notify(error.message); return; }
    }
    setProfiles(v => v.map(p => p.id === id ? { ...p, verified: !current } : p));
    notify(!current ? 'Perfil verificado' : 'Verificación removida');
  }

  async function toggleActive(id: string, current: boolean) {
    if (isSupabaseConfigured()) {
      const { error } = await createClient()?.rpc('admin_set_profile_active', {
        p_profile_id: id,
        p_active: !current,
      }) ?? { error: null };
      if (error) { notify(error.message); return; }
    }
    setProfiles(v => v.map(p => p.id === id ? { ...p, active: !current } : p));
    notify(!current ? 'Perfil habilitado' : 'Perfil deshabilitado');
  }

  async function pauseCampaign(id: string) {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      if (!supabase) return;
      const { error } = await supabase.from('campaigns').update({ status: 'paused' }).eq('id', id);
      if (error) { notify(error.message); return; }
    }
    setCampaigns(v => v.map(c => c.id === id ? { ...c, status: 'paused' } : c));
    notify('Campaña pausada');
  }

  if (loading) return <div className="fullLoader"><Logo/><div className="loaderRing"/><p>Verificando permisos...</p></div>;
  if (!allowed) return <div className="accessDenied"><ShieldCheck/><h1>Acceso restringido</h1><p>Esta sección está disponible únicamente para administradores de KUVO.</p><Link className="primaryBtn" href="/panel">Volver al panel</Link></div>;

  return <div className="adminApp">
    <aside className="adminSidebar"><Logo/><nav><button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}><LayoutDashboard/>Resumen</button><button className={tab === 'profiles' ? 'active' : ''} onClick={() => setTab('profiles')}><Users/>Perfiles</button><button className={tab === 'campaigns' ? 'active' : ''} onClick={() => setTab('campaigns')}><BriefcaseBusiness/>Campañas</button></nav><Link href="/panel">Volver al panel</Link></aside>
    <main className="adminMain"><header><div><span className="eyebrow"><ShieldCheck size={15}/> Administración</span><h1>Control de plataforma</h1><p>Moderación, verificación y estado general de KUVO.</p></div><div className="adminAvatar">AD</div></header>
    {tab === 'overview' && <>
      <div className="metricGrid adminMetrics">
        <article><span><Users/></span><p>Perfiles</p><strong>{profiles.length}</strong><small>{profiles.filter(p => p.active !== false).length} activos</small></article>
        <article><span><BadgeCheck/></span><p>Verificados</p><strong>{profiles.filter(p => p.verified).length}</strong><small>En base de datos</small></article>
        <article><span><BriefcaseBusiness/></span><p>Campañas</p><strong>{campaigns.length}</strong><small>{campaigns.filter((c: any) => c.status === 'open').length} abiertas</small></article>
        <article><span><Flag/></span><p>Reportes</p><strong>—</strong><small>Módulo pendiente</small></article>
      </div>
      <div className="dashboardColumns">
        <section className="dashPanel"><div className="panelTitle"><div><h3>Últimos perfiles</h3><p>Altas recientes</p></div><button onClick={() => setTab('profiles')}>Ver todos</button></div><div className="adminRecent">{profiles.slice(0, 6).map(p => <div key={p.id}><span>{p.full_name?.split(' ').map(x => x[0]).slice(0, 2).join('')}</span><p><strong>{p.full_name}</strong><small>{p.role} · {p.city || 'Sin ciudad'}</small></p>{p.verified ? <BadgeCheck/> : <i>Pendiente</i>}</div>)}</div></section>
        <section className="dashPanel"><div className="panelTitle"><div><h3>Salud del sistema</h3><p>Comprobación real</p></div></div><div className="healthList"><div><span><Activity/></span><p><strong>Aplicación web</strong><small>/api/health</small></p><b>{healthOk === null ? '—' : healthOk ? 'OK' : 'Error'}</b></div><div><span><ShieldCheck/></span><p><strong>Integraciones</strong><small>Solo lectura administrativa</small></p><b>{isSupabaseConfigured() ? 'Configurado' : 'Demo'}</b></div></div></section>
      </div>
    </>}
    {tab === 'profiles' && <section className="dashPanel applicationPanel"><div className="contentToolbar"><label><Search/><input placeholder="Buscar perfil"/></label><select><option>Todos los roles</option><option>Creadores</option><option>Negocios</option></select></div><div className="applicationTable adminTable"><div className="tableHead"><span>Perfil</span><span>Rol</span><span>Ciudad</span><span>Estado</span><span>Acciones</span></div>{profiles.map(p => <div className="tableRow" key={p.id}><div className="applicationPerson"><span>{p.full_name?.split(' ').map(x => x[0]).slice(0, 2).join('')}</span><p><strong>{p.full_name}</strong><small>@{p.username || 'sinusuario'}</small></p></div><span>{p.role === 'creator' ? 'Creador' : p.role === 'business' ? 'Negocio' : 'Admin'}</span><span>{p.city || '—'}</span><i className={`status ${p.active === false ? 'rejected' : 'accepted'}`}>{p.active === false ? 'Bloqueado' : 'Activo'}</i><div className="rowActions"><button title="Verificar" onClick={() => toggleVerify(p.id, !!p.verified)} className={p.verified ? 'selected' : ''}><BadgeCheck/></button><button title="Activar o bloquear" onClick={() => toggleActive(p.id, p.active !== false)}>{p.active === false ? <Check/> : <X/>}</button></div></div>)}</div></section>}
    {tab === 'campaigns' && <section className="dashPanel applicationPanel"><div className="contentToolbar"><label><Search/><input placeholder="Buscar campaña"/></label><select><option>Todos los estados</option><option>Abiertas</option><option>Pausadas</option></select></div><div className="applicationTable adminTable"><div className="tableHead"><span>Campaña</span><span>Negocio</span><span>Categoría</span><span>Estado</span><span>Acciones</span></div>{campaigns.map((c: any) => <div className="tableRow" key={c.id}><div className="applicationPerson"><span>{(c.businessName || c.business_profiles?.business_name || 'KU').slice(0, 2).toUpperCase()}</span><p><strong>{c.title}</strong><small>{c.city}</small></p></div><span>{c.businessName || c.business_profiles?.business_name || 'Negocio'}</span><span>{c.category}</span><i className={`status ${c.status}`}>{c.status === 'open' ? 'Activa' : c.status === 'paused' ? 'Pausada' : c.status}</i><div className="rowActions"><button title="Pausar" onClick={() => pauseCampaign(c.id)}><X/></button></div></div>)}</div></section>}
    </main>{toast && <div className="toast"><Check/>{toast}</div>}
  </div>;
}
