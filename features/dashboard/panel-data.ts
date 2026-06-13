import type { SupabaseClient } from '@supabase/supabase-js';
import { listFavorites } from '@/features/favorites/api';
import { listMessages, listMyConversations, markConversationRead, sendMessage } from '@/features/messages/api';
import { countUnreadNotifications, listNotifications } from '@/features/notifications/api';
import type { Creator } from '@/lib/types';
import { formatScoreDisplay } from '@/lib/score/kuvo-score';

export type ConversationItem = {
  id: string;
  title: string;
  initials: string;
  preview: string;
  time: string;
  unread: number;
  lastMessageAt: string | null;
};

export type ChatLine = {
  id: string;
  mine: boolean;
  text: string;
  time: string;
};

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

const gradients: [string, string][] = [
  ['#7c3aed', '#ec4899'],
  ['#2563eb', '#06b6d4'],
  ['#f97316', '#f43f5e'],
  ['#059669', '#84cc16'],
];

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(x => x[0]).join('').toUpperCase() || '?';
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatListTime(iso: string | null) {
  if (!iso) return '';
  try {
    const date = new Date(iso);
    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();
    if (sameDay) return formatTime(iso);
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Ayer';
    return date.toLocaleDateString('es-AR', { weekday: 'short' });
  } catch {
    return '';
  }
}

async function unreadCountForConversation(
  supabase: SupabaseClient,
  conversationId: string,
  profileId: string,
  lastReadAt: string | null,
) {
  let query = supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('conversation_id', conversationId)
    .neq('sender_profile_id', profileId);

  if (lastReadAt) query = query.gt('created_at', lastReadAt);
  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

export async function loadConversations(supabase: SupabaseClient, profileId: string) {
  const { data, error } = await listMyConversations(supabase, profileId);
  if (error || !data) return { items: [] as ConversationItem[], error: error?.message };

  const items = await Promise.all(
    data.map(async (row: any) => {
      const conv = row.conversations;
      const title = conv?.campaigns?.title ?? 'Conversación';
      const convId = row.conversation_id as string;
      const lastReadAt = row.last_read_at as string | null;

      const { data: lastMsg } = await supabase
        .from('messages')
        .select('body, created_at')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const unread = await unreadCountForConversation(supabase, convId, profileId, lastReadAt);

      return {
        id: convId,
        title,
        initials: initials(title),
        preview: lastMsg?.body ?? 'Sin mensajes recientes',
        time: formatListTime(lastMsg?.created_at ?? null),
        unread,
        lastMessageAt: lastMsg?.created_at ?? null,
      } satisfies ConversationItem;
    }),
  );

  items.sort((a, b) => {
    const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return bTime - aTime;
  });

  return { items, error: undefined };
}

export async function loadChatMessages(
  supabase: SupabaseClient,
  conversationId: string,
  profileId: string,
) {
  const { data, error } = await listMessages(supabase, conversationId);
  if (error || !data) return { lines: [] as ChatLine[], error: error?.message };
  const lines = [...data].reverse().map((m: any) => ({
    id: m.id,
    mine: m.sender_profile_id === profileId,
    text: m.body,
    time: formatTime(m.created_at),
  }));
  await markConversationRead(supabase, conversationId, profileId);
  return { lines, error: undefined };
}

export async function postChatMessage(
  supabase: SupabaseClient,
  conversationId: string,
  profileId: string,
  body: string,
) {
  return sendMessage(supabase, conversationId, profileId, body);
}

export async function loadFavoriteCreators(supabase: SupabaseClient, accountId: string) {
  const { data, error } = await listFavorites(supabase, accountId);
  if (error || !data?.length) return { creators: [] as Creator[], error: error?.message };

  const ids = data.map(f => f.creator_id);
  const { data: rows, error: rowErr } = await supabase
    .from('creator_profiles')
    .select('id,profile_id,categories,followers_declared,engagement_declared,starting_price,score,profiles!inner(full_name,username,city,verified,bio)')
    .in('id', ids);

  if (rowErr || !rows) return { creators: [] as Creator[], error: rowErr?.message };

  const creators: Creator[] = rows.map((row: any, i: number) => {
    const p = row.profiles;
    const name = p.full_name || 'Creador';
    const gradient = gradients[i % gradients.length];
    return {
      id: row.id,
      profileId: row.profile_id,
      name,
      username: p.username ? `@${p.username}` : '@creador',
      city: p.city || 'Argentina',
      category: row.categories?.[0] || 'Lifestyle',
      categories: row.categories || [],
      followers: Number(row.followers_declared ?? 0),
      engagement: Number(row.engagement_declared ?? 0),
      startingPrice: Number(row.starting_price ?? 0),
      score: row.score != null ? Number(row.score) : null,
      scoreLabel: formatScoreDisplay(row.score != null ? Number(row.score) : null),
      verified: Boolean(p.verified),
      bio: p.bio || '',
      initials: initials(name),
      gradient,
      portfolio: [],
    };
  });
  return { creators, error: undefined };
}

export async function loadUnreadNotificationCount(supabase: SupabaseClient, accountId: string) {
  const { count, error } = await countUnreadNotifications(supabase, accountId);
  return error ? 0 : count ?? 0;
}

export async function loadNotificationItems(supabase: SupabaseClient, accountId: string) {
  const { data, error } = await listNotifications(supabase, accountId);
  if (error || !data) return { items: [] as NotificationItem[], error: error?.message };
  const items: NotificationItem[] = data.map((n: any) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    actionUrl: n.action_url,
    readAt: n.read_at,
    createdAt: n.created_at,
  }));
  return { items, error: undefined };
}

export function totalUnreadMessages(conversations: ConversationItem[]) {
  return conversations.reduce((sum, c) => sum + c.unread, 0);
}
