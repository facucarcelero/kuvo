import type { SupabaseClient } from '@supabase/supabase-js';
import type { AccountRole, CampaignStatus, ReportRow } from '@/lib/database.types';
import { pauseCampaign, reopenCampaign } from '@/features/campaigns/api';

export const ADMIN_PAGE_SIZE = 20;

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  error?: string;
};

export type AdminProfileItem = {
  id: string;
  full_name: string;
  username: string | null;
  role: AccountRole;
  city: string | null;
  verified: boolean;
  active: boolean;
  created_at: string;
};

export type AdminCampaignItem = {
  id: string;
  title: string;
  category: string;
  city: string;
  status: CampaignStatus;
  created_at: string;
  businessName: string;
};

export type AdminReportItem = {
  id: string;
  reporterProfileId: string;
  reporterName: string;
  targetType: ReportRow['target_type'];
  targetId: string;
  reason: string;
  details: string | null;
  status: ReportRow['status'];
  createdAt: string;
  resolvedAt: string | null;
};

export type AdminAuditItem = {
  id: string;
  actorProfileId: string | null;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type AdminOverviewMetrics = {
  totalProfiles: number;
  activeProfiles: number;
  verifiedProfiles: number;
  openCampaigns: number;
  openReports: number;
};

export type AdminSession =
  | { ok: true; profileId: string; accountId: string }
  | { ok: false; error: string };

function pageRange(page: number) {
  const from = page * ADMIN_PAGE_SIZE;
  return { from, to: from + ADMIN_PAGE_SIZE - 1 };
}

function escapeIlike(value: string) {
  return value.replace(/[%_,]/g, '\\$&');
}

export async function assertAdminSession(supabase: SupabaseClient): Promise<AdminSession> {
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { ok: false, error: 'Sesión no válida.' };

  const { data: me, error: profileErr } = await supabase
    .from('profiles')
    .select('id, role, active')
    .eq('account_id', user.id)
    .single();

  if (profileErr || !me || me.role !== 'admin' || me.active === false) {
    return { ok: false, error: 'Acceso restringido.' };
  }

  return { ok: true, profileId: me.id, accountId: user.id };
}

export async function getAdminOverviewMetrics(supabase: SupabaseClient): Promise<AdminOverviewMetrics> {
  const [
    { count: totalProfiles },
    { count: activeProfiles },
    { count: verifiedProfiles },
    { count: openCampaigns },
    { count: openReports },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('active', true),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('verified', true),
    supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'open'),
  ]);

  return {
    totalProfiles: totalProfiles ?? 0,
    activeProfiles: activeProfiles ?? 0,
    verifiedProfiles: verifiedProfiles ?? 0,
    openCampaigns: openCampaigns ?? 0,
    openReports: openReports ?? 0,
  };
}

export async function listProfilesPaginated(
  supabase: SupabaseClient,
  params: { page: number; search?: string; role?: string },
): Promise<PaginatedResult<AdminProfileItem>> {
  const { from, to } = pageRange(params.page);
  let query = supabase
    .from('profiles')
    .select('id, full_name, username, role, city, verified, active, created_at', { count: 'exact' })
    .order('created_at', { ascending: false });

  const search = params.search?.trim();
  if (search) {
    const q = escapeIlike(search);
    query = query.or(`full_name.ilike.%${q}%,username.ilike.%${q}%`);
  }
  if (params.role && params.role !== 'all') {
    query = query.eq('role', params.role);
  }

  const { data, count, error } = await query.range(from, to);
  if (error) return { items: [], total: 0, error: error.message };

  return {
    items: (data ?? []) as AdminProfileItem[],
    total: count ?? 0,
  };
}

export async function listCampaignsPaginated(
  supabase: SupabaseClient,
  params: { page: number; search?: string; status?: string },
): Promise<PaginatedResult<AdminCampaignItem>> {
  const { from, to } = pageRange(params.page);
  let query = supabase
    .from('campaigns')
    .select('id, title, category, city, status, created_at, business_profiles(business_name)', { count: 'exact' })
    .order('created_at', { ascending: false });

  const search = params.search?.trim();
  if (search) {
    query = query.ilike('title', `%${escapeIlike(search)}%`);
  }
  if (params.status && params.status !== 'all') {
    query = query.eq('status', params.status);
  }

  const { data, count, error } = await query.range(from, to);
  if (error) return { items: [], total: 0, error: error.message };

  const items: AdminCampaignItem[] = (data ?? []).map((row: any) => {
    const business = Array.isArray(row.business_profiles)
      ? row.business_profiles[0]
      : row.business_profiles;
    return {
      id: row.id,
      title: row.title,
      category: row.category,
      city: row.city,
      status: row.status,
      created_at: row.created_at,
      businessName: business?.business_name ?? 'Negocio',
    };
  });

  return { items, total: count ?? 0 };
}

export async function listReportsPaginated(
  supabase: SupabaseClient,
  params: { page: number; status?: string },
): Promise<PaginatedResult<AdminReportItem>> {
  const { from, to } = pageRange(params.page);
  let query = supabase
    .from('reports')
    .select(
      'id, reporter_profile_id, target_type, target_id, reason, details, status, created_at, resolved_at, reporter:profiles!reports_reporter_profile_id_fkey(full_name, username)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false });

  if (params.status && params.status !== 'all') {
    query = query.eq('status', params.status);
  }

  const { data, count, error } = await query.range(from, to);
  if (error) return { items: [], total: 0, error: error.message };

  const items: AdminReportItem[] = (data ?? []).map((row: any) => {
    const reporter = Array.isArray(row.reporter) ? row.reporter[0] : row.reporter;
    return {
      id: row.id,
      reporterProfileId: row.reporter_profile_id,
      reporterName: reporter?.full_name ?? 'Usuario',
      targetType: row.target_type,
      targetId: row.target_id,
      reason: row.reason,
      details: row.details,
      status: row.status,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at,
    };
  });

  return { items, total: count ?? 0 };
}

export async function listAuditLogsPaginated(
  supabase: SupabaseClient,
  params: { page: number },
): Promise<PaginatedResult<AdminAuditItem>> {
  const { from, to } = pageRange(params.page);
  const { data, count, error } = await supabase
    .from('platform_audit_logs')
    .select(
      'id, actor_profile_id, action, entity_type, entity_id, metadata, created_at, actor:profiles!platform_audit_logs_actor_profile_id_fkey(full_name, username)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) return { items: [], total: 0, error: error.message };

  const items: AdminAuditItem[] = (data ?? []).map((row: any) => {
    const actor = Array.isArray(row.actor) ? row.actor[0] : row.actor;
    return {
      id: row.id,
      actorProfileId: row.actor_profile_id,
      actorName: actor?.full_name ?? 'Sistema',
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      createdAt: row.created_at,
    };
  });

  return { items, total: count ?? 0 };
}

export async function setProfileVerified(
  supabase: SupabaseClient,
  profileId: string,
  verified: boolean,
) {
  return supabase.rpc('admin_set_profile_verified', {
    p_profile_id: profileId,
    p_verified: verified,
  });
}

export async function setProfileActive(
  supabase: SupabaseClient,
  profileId: string,
  active: boolean,
) {
  return supabase.rpc('admin_set_profile_active', {
    p_profile_id: profileId,
    p_active: active,
  });
}

export async function adminPauseCampaign(supabase: SupabaseClient, campaignId: string) {
  return pauseCampaign(supabase, campaignId);
}

export async function adminReopenCampaign(supabase: SupabaseClient, campaignId: string) {
  return reopenCampaign(supabase, campaignId);
}

export async function updateReportStatus(
  supabase: SupabaseClient,
  reportId: string,
  status: ReportRow['status'],
) {
  const payload: { status: ReportRow['status']; resolved_at: string | null } = {
    status,
    resolved_at: status === 'resolved' || status === 'dismissed' ? new Date().toISOString() : null,
  };

  return supabase.from('reports').update(payload).eq('id', reportId).select('id').single();
}
