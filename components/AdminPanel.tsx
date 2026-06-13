'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  BadgeCheck,
  BriefcaseBusiness,
  Check,
  ChevronLeft,
  ChevronRight,
  Flag,
  LayoutDashboard,
  ScrollText,
  Search,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { Logo } from './Logo';
import {
  ADMIN_PAGE_SIZE,
  adminPauseCampaign,
  adminReopenCampaign,
  assertAdminSession,
  getAdminOverviewMetrics,
  listAuditLogsPaginated,
  listCampaignsPaginated,
  listProfilesPaginated,
  listReportsPaginated,
  setProfileActive,
  setProfileVerified,
  updateReportStatus,
  type AdminAuditItem,
  type AdminCampaignItem,
  type AdminOverviewMetrics,
  type AdminProfileItem,
  type AdminReportItem,
} from '@/features/admin/api';
import { campaignStatusLabel } from '@/lib/labels/campaign-status';
import {
  adminCanDismissReport,
  adminCanResolveReport,
  reportStatusLabel,
} from '@/lib/labels/report-status';
import { createClient, isDemoMode, isSupabaseConfigured } from '@/lib/supabase/client';

type Tab = 'overview' | 'profiles' | 'campaigns' | 'reports' | 'audit';

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel?: string;
  action: () => Promise<void>;
};

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(x => x[0]).join('').toUpperCase() || '?';
}

function roleLabel(role: string) {
  if (role === 'creator') return 'Creador';
  if (role === 'business') return 'Negocio';
  if (role === 'admin') return 'Admin';
  return role;
}

function Pagination({
  page,
  total,
  loading,
  onPageChange,
}: {
  page: number;
  total: number;
  loading: boolean;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const from = total === 0 ? 0 : page * ADMIN_PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * ADMIN_PAGE_SIZE);

  return (
    <div className="adminPagination">
      <span>{total === 0 ? 'Sin resultados' : `${from}–${to} de ${total}`}</span>
      <div>
        <button type="button" className="ghostBtn" disabled={loading || page <= 0} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft size={16} /> Anterior
        </button>
        <button type="button" className="ghostBtn" disabled={loading || page >= totalPages - 1} onClick={() => onPageChange(page + 1)}>
          Siguiente <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export function AdminPanel() {
  const [allowed, setAllowed] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');
  const [toast, setToast] = useState('');
  const [healthOk, setHealthOk] = useState<boolean | null>(null);
  const [metrics, setMetrics] = useState<AdminOverviewMetrics | null>(null);
  const [recentProfiles, setRecentProfiles] = useState<AdminProfileItem[]>([]);

  const [profileItems, setProfileItems] = useState<AdminProfileItem[]>([]);
  const [profileTotal, setProfileTotal] = useState(0);
  const [profilePage, setProfilePage] = useState(0);
  const [profileSearch, setProfileSearch] = useState('');
  const [profileRole, setProfileRole] = useState('all');
  const [profileLoading, setProfileLoading] = useState(false);

  const [campaignItems, setCampaignItems] = useState<AdminCampaignItem[]>([]);
  const [campaignTotal, setCampaignTotal] = useState(0);
  const [campaignPage, setCampaignPage] = useState(0);
  const [campaignSearch, setCampaignSearch] = useState('');
  const [campaignStatus, setCampaignStatus] = useState('all');
  const [campaignLoading, setCampaignLoading] = useState(false);

  const [reportItems, setReportItems] = useState<AdminReportItem[]>([]);
  const [reportTotal, setReportTotal] = useState(0);
  const [reportPage, setReportPage] = useState(0);
  const [reportStatus, setReportStatus] = useState('open');
  const [reportLoading, setReportLoading] = useState(false);

  const [auditItems, setAuditItems] = useState<AdminAuditItem[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(0);
  const [auditLoading, setAuditLoading] = useState(false);

  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const notify = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(''), 2500);
  }, []);

  const notifyError = useCallback((message: string) => {
    notify(message);
  }, [notify]);

  useEffect(() => {
    void (async () => {
      if (isDemoMode()) {
        setBootLoading(false);
        return;
      }

      if (!isSupabaseConfigured()) {
        setBootLoading(false);
        return;
      }

      const supabase = createClient();
      if (!supabase) {
        setBootLoading(false);
        return;
      }

      const session = await assertAdminSession(supabase);
      if (!session.ok) {
        setBootLoading(false);
        return;
      }

      setAllowed(true);

      const [overview, recent] = await Promise.all([
        getAdminOverviewMetrics(supabase),
        listProfilesPaginated(supabase, { page: 0 }),
      ]);

      setMetrics(overview);
      setRecentProfiles(recent.items.slice(0, 6));

      try {
        const res = await fetch('/api/health');
        const body = await res.json();
        setHealthOk(Boolean(body.ok && body.readiness === 'ok'));
      } catch {
        setHealthOk(false);
      }

      setBootLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!allowed || tab !== 'profiles') return;
    const supabase = createClient();
    if (!supabase) return;

    let cancelled = false;
    setProfileLoading(true);

    void listProfilesPaginated(supabase, {
      page: profilePage,
      search: profileSearch,
      role: profileRole,
    }).then(({ items, total, error }) => {
      if (cancelled) return;
      setProfileLoading(false);
      if (error) {
        notifyError(error);
        return;
      }
      setProfileItems(items);
      setProfileTotal(total);
    });

    return () => { cancelled = true; };
  }, [allowed, tab, profilePage, profileSearch, profileRole, notifyError]);

  useEffect(() => {
    if (!allowed || tab !== 'campaigns') return;
    const supabase = createClient();
    if (!supabase) return;

    let cancelled = false;
    setCampaignLoading(true);

    void listCampaignsPaginated(supabase, {
      page: campaignPage,
      search: campaignSearch,
      status: campaignStatus,
    }).then(({ items, total, error }) => {
      if (cancelled) return;
      setCampaignLoading(false);
      if (error) {
        notifyError(error);
        return;
      }
      setCampaignItems(items);
      setCampaignTotal(total);
    });

    return () => { cancelled = true; };
  }, [allowed, tab, campaignPage, campaignSearch, campaignStatus, notifyError]);

  useEffect(() => {
    if (!allowed || tab !== 'reports') return;
    const supabase = createClient();
    if (!supabase) return;

    let cancelled = false;
    setReportLoading(true);

    void listReportsPaginated(supabase, {
      page: reportPage,
      status: reportStatus,
    }).then(({ items, total, error }) => {
      if (cancelled) return;
      setReportLoading(false);
      if (error) {
        notifyError(error);
        return;
      }
      setReportItems(items);
      setReportTotal(total);
    });

    return () => { cancelled = true; };
  }, [allowed, tab, reportPage, reportStatus, notifyError]);

  useEffect(() => {
    if (!allowed || tab !== 'audit') return;
    const supabase = createClient();
    if (!supabase) return;

    let cancelled = false;
    setAuditLoading(true);

    void listAuditLogsPaginated(supabase, { page: auditPage }).then(({ items, total, error }) => {
      if (cancelled) return;
      setAuditLoading(false);
      if (error) {
        notifyError(error);
        return;
      }
      setAuditItems(items);
      setAuditTotal(total);
    });

    return () => { cancelled = true; };
  }, [allowed, tab, auditPage, notifyError]);

  function openConfirm(next: ConfirmState) {
    setConfirm(next);
  }

  async function runConfirm() {
    if (!confirm) return;
    setConfirmLoading(true);
    try {
      await confirm.action();
    } finally {
      setConfirmLoading(false);
      setConfirm(null);
    }
  }

  async function refreshOverview() {
    const supabase = createClient();
    if (!supabase) return;
    const overview = await getAdminOverviewMetrics(supabase);
    setMetrics(overview);
  }

  async function toggleVerify(id: string, current: boolean) {
    const supabase = createClient();
    if (!supabase) return;
    const { error } = await setProfileVerified(supabase, id, !current);
    if (error) {
      notifyError(error.message);
      return;
    }
    setProfileItems(v => v.map(p => p.id === id ? { ...p, verified: !current } : p));
    setRecentProfiles(v => v.map(p => p.id === id ? { ...p, verified: !current } : p));
    await refreshOverview();
    notify(!current ? 'Perfil verificado' : 'Verificación removida');
  }

  function requestToggleActive(profile: AdminProfileItem) {
    const willBlock = profile.active !== false;
    openConfirm({
      title: willBlock ? 'Bloquear perfil' : 'Reactivar perfil',
      message: willBlock
        ? `¿Confirmás bloquear a ${profile.full_name}? No podrá operar en la plataforma.`
        : `¿Confirmás reactivar a ${profile.full_name}? Recuperará acceso al panel.`,
      confirmLabel: willBlock ? 'Bloquear' : 'Reactivar',
      action: async () => {
        const supabase = createClient();
        if (!supabase) return;
        const { error } = await setProfileActive(supabase, profile.id, profile.active === false);
        if (error) {
          notifyError(error.message);
          return;
        }
        const nextActive = profile.active === false;
        setProfileItems(v => v.map(p => p.id === profile.id ? { ...p, active: nextActive } : p));
        setRecentProfiles(v => v.map(p => p.id === profile.id ? { ...p, active: nextActive } : p));
        await refreshOverview();
        notify(nextActive ? 'Perfil habilitado' : 'Perfil bloqueado');
      },
    });
  }

  function requestPauseCampaign(campaign: AdminCampaignItem) {
    openConfirm({
      title: 'Pausar campaña',
      message: `¿Confirmás pausar "${campaign.title}"? Dejará de recibir postulaciones hasta reabrirla.`,
      confirmLabel: 'Pausar',
      action: async () => {
        const supabase = createClient();
        if (!supabase) return;
        const { error } = await adminPauseCampaign(supabase, campaign.id);
        if (error) {
          notifyError(error.message);
          return;
        }
        setCampaignItems(v => v.map(c => c.id === campaign.id ? { ...c, status: 'paused' } : c));
        await refreshOverview();
        notify('Campaña pausada');
      },
    });
  }

  function requestReopenCampaign(campaign: AdminCampaignItem) {
    openConfirm({
      title: 'Reabrir campaña',
      message: `¿Confirmás reabrir "${campaign.title}"? Volverá al estado activo.`,
      confirmLabel: 'Reabrir',
      action: async () => {
        const supabase = createClient();
        if (!supabase) return;
        const { error } = await adminReopenCampaign(supabase, campaign.id);
        if (error) {
          notifyError(error.message);
          return;
        }
        setCampaignItems(v => v.map(c => c.id === campaign.id ? { ...c, status: 'open' } : c));
        await refreshOverview();
        notify('Campaña reabierta');
      },
    });
  }

  function requestResolveReport(report: AdminReportItem) {
    openConfirm({
      title: 'Resolver reporte',
      message: `¿Confirmás marcar como resuelto el reporte sobre ${report.targetType} (${report.reason.slice(0, 80)}…)?`,
      confirmLabel: 'Resolver',
      action: async () => {
        const supabase = createClient();
        if (!supabase) return;
        const { error } = await updateReportStatus(supabase, report.id, 'resolved');
        if (error) {
          notifyError(error.message);
          return;
        }
        setReportItems(v => v.map(r => r.id === report.id ? { ...r, status: 'resolved', resolvedAt: new Date().toISOString() } : r));
        await refreshOverview();
        notify('Reporte resuelto');
      },
    });
  }

  function requestDismissReport(report: AdminReportItem) {
    openConfirm({
      title: 'Descartar reporte',
      message: `¿Confirmás descartar este reporte? Quedará cerrado sin acción adicional.`,
      confirmLabel: 'Descartar',
      action: async () => {
        const supabase = createClient();
        if (!supabase) return;
        const { error } = await updateReportStatus(supabase, report.id, 'dismissed');
        if (error) {
          notifyError(error.message);
          return;
        }
        setReportItems(v => v.map(r => r.id === report.id ? { ...r, status: 'dismissed', resolvedAt: new Date().toISOString() } : r));
        await refreshOverview();
        notify('Reporte descartado');
      },
    });
  }

  if (bootLoading) {
    return (
      <div className="fullLoader">
        <Logo /><div className="loaderRing" /><p>Verificando permisos...</p>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="accessDenied">
        <ShieldCheck />
        <h1>Acceso restringido</h1>
        <p>Esta sección está disponible únicamente para administradores de KUVO con Supabase configurado.</p>
        <Link className="primaryBtn" href="/panel">Volver al panel</Link>
      </div>
    );
  }

  return (
    <div className="adminApp">
      <aside className="adminSidebar">
        <Logo />
        <nav>
          <button type="button" className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}><LayoutDashboard />Resumen</button>
          <button type="button" className={tab === 'profiles' ? 'active' : ''} onClick={() => setTab('profiles')}><Users />Perfiles</button>
          <button type="button" className={tab === 'campaigns' ? 'active' : ''} onClick={() => setTab('campaigns')}><BriefcaseBusiness />Campañas</button>
          <button type="button" className={tab === 'reports' ? 'active' : ''} onClick={() => setTab('reports')}><Flag />Reportes</button>
          <button type="button" className={tab === 'audit' ? 'active' : ''} onClick={() => setTab('audit')}><ScrollText />Auditoría</button>
        </nav>
        <Link href="/panel">Volver al panel</Link>
      </aside>

      <main className="adminMain">
        <header>
          <div>
            <span className="eyebrow"><ShieldCheck size={15} /> Administración</span>
            <h1>Control de plataforma</h1>
            <p>Moderación, verificación y trazabilidad de KUVO.</p>
          </div>
          <div className="adminAvatar">AD</div>
        </header>

        {tab === 'overview' && (
          <>
            <div className="metricGrid adminMetrics">
              <article><span><Users /></span><p>Perfiles</p><strong>{metrics?.totalProfiles ?? 0}</strong><small>{metrics?.activeProfiles ?? 0} activos</small></article>
              <article><span><BadgeCheck /></span><p>Verificados</p><strong>{metrics?.verifiedProfiles ?? 0}</strong><small>En base de datos</small></article>
              <article><span><BriefcaseBusiness /></span><p>Campañas abiertas</p><strong>{metrics?.openCampaigns ?? 0}</strong><small>Estado open</small></article>
              <article><span><Flag /></span><p>Reportes abiertos</p><strong>{metrics?.openReports ?? 0}</strong><small>Pendientes de moderación</small></article>
            </div>
            <div className="dashboardColumns">
              <section className="dashPanel">
                <div className="panelTitle">
                  <div><h3>Últimos perfiles</h3><p>Altas recientes</p></div>
                  <button type="button" onClick={() => setTab('profiles')}>Ver todos</button>
                </div>
                <div className="adminRecent">
                  {recentProfiles.map(p => (
                    <div key={p.id}>
                      <span>{initials(p.full_name)}</span>
                      <p><strong>{p.full_name}</strong><small>{roleLabel(p.role)} · {p.city || 'Sin ciudad'}</small></p>
                      {p.verified ? <BadgeCheck /> : <i>Pendiente</i>}
                    </div>
                  ))}
                </div>
              </section>
              <section className="dashPanel">
                <div className="panelTitle"><div><h3>Salud del sistema</h3><p>Comprobación real</p></div></div>
                <div className="healthList">
                  <div><span><Activity /></span><p><strong>Aplicación web</strong><small>/api/health</small></p><b>{healthOk === null ? '—' : healthOk ? 'OK' : 'Error'}</b></div>
                  <div><span><ShieldCheck /></span><p><strong>Integraciones</strong><small>Solo lectura administrativa</small></p><b>{isSupabaseConfigured() ? 'Configurado' : 'Demo'}</b></div>
                </div>
              </section>
            </div>
          </>
        )}

        {tab === 'profiles' && (
          <section className="dashPanel applicationPanel">
            <div className="contentToolbar">
              <label><Search /><input placeholder="Buscar perfil" value={profileSearch} onChange={(e) => { setProfilePage(0); setProfileSearch(e.target.value); }} /></label>
              <select value={profileRole} onChange={(e) => { setProfilePage(0); setProfileRole(e.target.value); }}>
                <option value="all">Todos los roles</option>
                <option value="creator">Creadores</option>
                <option value="business">Negocios</option>
                <option value="admin">Admins</option>
              </select>
            </div>
            {profileLoading && <p className="loadingLine" />}
            <div className="applicationTable adminTable">
              <div className="tableHead"><span>Perfil</span><span>Rol</span><span>Ciudad</span><span>Estado</span><span>Acciones</span></div>
              {!profileLoading && profileItems.length === 0 && <p className="emptyInline">No hay perfiles con esos filtros.</p>}
              {profileItems.map(p => (
                <div className="tableRow" key={p.id}>
                  <div className="applicationPerson">
                    <span>{initials(p.full_name)}</span>
                    <p><strong>{p.full_name}</strong><small>@{p.username || 'sinusuario'}</small></p>
                  </div>
                  <span>{roleLabel(p.role)}</span>
                  <span>{p.city || '—'}</span>
                  <i className={`status ${p.active === false ? 'rejected' : 'accepted'}`}>{p.active === false ? 'Bloqueado' : 'Activo'}</i>
                  <div className="rowActions">
                    <button type="button" title="Verificar" onClick={() => void toggleVerify(p.id, !!p.verified)} className={p.verified ? 'selected' : ''}><BadgeCheck /></button>
                    <button type="button" title={p.active === false ? 'Reactivar' : 'Bloquear'} onClick={() => requestToggleActive(p)}>{p.active === false ? <Check /> : <X />}</button>
                  </div>
                </div>
              ))}
            </div>
            <Pagination page={profilePage} total={profileTotal} loading={profileLoading} onPageChange={setProfilePage} />
          </section>
        )}

        {tab === 'campaigns' && (
          <section className="dashPanel applicationPanel">
            <div className="contentToolbar">
              <label><Search /><input placeholder="Buscar campaña" value={campaignSearch} onChange={(e) => { setCampaignPage(0); setCampaignSearch(e.target.value); }} /></label>
              <select value={campaignStatus} onChange={(e) => { setCampaignPage(0); setCampaignStatus(e.target.value); }}>
                <option value="all">Todos los estados</option>
                <option value="open">Abiertas</option>
                <option value="paused">Pausadas</option>
                <option value="in_progress">En curso</option>
                <option value="completed">Completadas</option>
                <option value="cancelled">Canceladas</option>
              </select>
            </div>
            {campaignLoading && <p className="loadingLine" />}
            <div className="applicationTable adminTable">
              <div className="tableHead"><span>Campaña</span><span>Negocio</span><span>Categoría</span><span>Estado</span><span>Acciones</span></div>
              {!campaignLoading && campaignItems.length === 0 && <p className="emptyInline">No hay campañas con esos filtros.</p>}
              {campaignItems.map(c => (
                <div className="tableRow" key={c.id}>
                  <div className="applicationPerson">
                    <span>{c.businessName.slice(0, 2).toUpperCase()}</span>
                    <p><strong>{c.title}</strong><small>{c.city}</small></p>
                  </div>
                  <span>{c.businessName}</span>
                  <span>{c.category}</span>
                  <i className={`status ${c.status}`}>{campaignStatusLabel(c.status)}</i>
                  <div className="rowActions">
                    {c.status === 'open' && <button type="button" title="Pausar" onClick={() => requestPauseCampaign(c)}><X /></button>}
                    {c.status === 'paused' && <button type="button" title="Reabrir" onClick={() => requestReopenCampaign(c)}><Check /></button>}
                  </div>
                </div>
              ))}
            </div>
            <Pagination page={campaignPage} total={campaignTotal} loading={campaignLoading} onPageChange={setCampaignPage} />
          </section>
        )}

        {tab === 'reports' && (
          <section className="dashPanel applicationPanel">
            <div className="contentToolbar">
              <select value={reportStatus} onChange={(e) => { setReportPage(0); setReportStatus(e.target.value); }}>
                <option value="all">Todos</option>
                <option value="open">Abiertos</option>
                <option value="reviewing">En revisión</option>
                <option value="resolved">Resueltos</option>
                <option value="dismissed">Descartados</option>
              </select>
            </div>
            {reportLoading && <p className="loadingLine" />}
            <div className="applicationTable adminTable">
              <div className="tableHead"><span>Reporte</span><span>Objetivo</span><span>Estado</span><span>Fecha</span><span>Acciones</span></div>
              {!reportLoading && reportItems.length === 0 && <p className="emptyInline">No hay reportes con esos filtros.</p>}
              {reportItems.map(r => (
                <div className="tableRow" key={r.id}>
                  <div className="applicationPerson">
                    <span>{initials(r.reporterName)}</span>
                    <p><strong>{r.reporterName}</strong><small>{r.reason}</small></p>
                  </div>
                  <span>{r.targetType} · {r.targetId.slice(0, 8)}…</span>
                  <i className={`status ${r.status === 'open' ? 'pending' : r.status === 'resolved' ? 'accepted' : r.status === 'dismissed' ? 'rejected' : 'shortlisted'}`}>{reportStatusLabel(r.status)}</i>
                  <span>{new Date(r.createdAt).toLocaleDateString('es-AR')}</span>
                  <div className="rowActions">
                    {adminCanResolveReport(r.status) && <button type="button" title="Resolver" onClick={() => requestResolveReport(r)}><Check /></button>}
                    {adminCanDismissReport(r.status) && <button type="button" title="Descartar" onClick={() => requestDismissReport(r)}><X /></button>}
                  </div>
                </div>
              ))}
            </div>
            <Pagination page={reportPage} total={reportTotal} loading={reportLoading} onPageChange={setReportPage} />
          </section>
        )}

        {tab === 'audit' && (
          <section className="dashPanel applicationPanel">
            {auditLoading && <p className="loadingLine" />}
            <div className="applicationTable adminTable">
              <div className="tableHead"><span>Actor</span><span>Acción</span><span>Entidad</span><span>Fecha</span></div>
              {!auditLoading && auditItems.length === 0 && <p className="emptyInline">No hay registros de auditoría.</p>}
              {auditItems.map(a => (
                <div className="tableRow" key={a.id}>
                  <div className="applicationPerson">
                    <span>{initials(a.actorName)}</span>
                    <p><strong>{a.actorName}</strong><small>{a.actorProfileId?.slice(0, 8) ?? '—'}</small></p>
                  </div>
                  <span>{a.action}</span>
                  <span>{a.entityType}{a.entityId ? ` · ${a.entityId.slice(0, 8)}…` : ''}</span>
                  <span>{new Date(a.createdAt).toLocaleString('es-AR')}</span>
                </div>
              ))}
            </div>
            <Pagination page={auditPage} total={auditTotal} loading={auditLoading} onPageChange={setAuditPage} />
          </section>
        )}
      </main>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmLabel={confirm?.confirmLabel}
        loading={confirmLoading}
        onCancel={() => !confirmLoading && setConfirm(null)}
        onConfirm={() => void runConfirm()}
      />

      {toast && <div className="toast"><Check />{toast}</div>}
    </div>
  );
}
