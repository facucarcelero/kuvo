import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { NotificationItem } from '@/features/dashboard/panel-data';

export type NotificationRow = {
  id: string;
  account_id: string;
  title: string;
  body: string;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
};

export function mapNotificationRow(row: NotificationRow): NotificationItem {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    actionUrl: row.action_url,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

function removeChannelSafe(supabase: SupabaseClient, channel: RealtimeChannel) {
  void supabase.removeChannel(channel);
}

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

export function subscribeToNotifications(
  supabase: SupabaseClient,
  accountId: string,
  handlers: {
    onInsert: (item: NotificationItem) => void;
    onUpdate: (item: NotificationItem) => void;
  },
): () => void {
  const channel = supabase
    .channel(`notifications:${accountId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `account_id=eq.${accountId}`,
      },
      (payload) => handlers.onInsert(mapNotificationRow(payload.new as NotificationRow)),
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `account_id=eq.${accountId}`,
      },
      (payload) => handlers.onUpdate(mapNotificationRow(payload.new as NotificationRow)),
    )
    .subscribe();

  return () => removeChannelSafe(supabase, channel);
}
