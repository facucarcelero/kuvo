import type { SupabaseClient } from '@supabase/supabase-js';

export async function listNotifications(supabase: SupabaseClient, accountId: string, limit = 30) {
  return supabase
    .from('notifications')
    .select('id, title, body, action_url, read_at, created_at')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(limit);
}

export async function countUnreadNotifications(supabase: SupabaseClient, accountId: string) {
  return supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', accountId)
    .is('read_at', null);
}

export async function markNotificationRead(supabase: SupabaseClient, id: string) {
  return supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);
}

export async function markAllNotificationsRead(supabase: SupabaseClient, accountId: string) {
  return supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('account_id', accountId)
    .is('read_at', null);
}
