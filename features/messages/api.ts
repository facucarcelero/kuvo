import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { ChatLine } from '@/features/dashboard/panel-data';

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_profile_id: string;
  body: string;
  created_at: string;
};

export function formatMessageTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function mapMessageRow(row: MessageRow, profileId: string): ChatLine {
  return {
    id: row.id,
    mine: row.sender_profile_id === profileId,
    text: row.body,
    time: formatMessageTime(row.created_at),
  };
}

export function appendChatMessage(prev: ChatLine[], line: ChatLine): ChatLine[] {
  if (prev.some(x => x.id === line.id)) return prev;
  return [...prev, line];
}

function removeChannelSafe(supabase: SupabaseClient, channel: RealtimeChannel) {
  void supabase.removeChannel(channel);
}

export async function listMyConversations(supabase: SupabaseClient, profileId: string) {
  return supabase
    .from('conversation_members')
    .select(`
      conversation_id,
      last_read_at,
      conversations (
        id,
        campaign_id,
        updated_at,
        campaigns ( title, status )
      )
    `)
    .eq('profile_id', profileId)
    .order('joined_at', { ascending: false });
}

export async function listMessages(supabase: SupabaseClient, conversationId: string, before?: string) {
  let query = supabase
    .from('messages')
    .select('id, conversation_id, sender_profile_id, body, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (before) query = query.lt('created_at', before);
  return query;
}

export async function sendMessage(
  supabase: SupabaseClient,
  conversationId: string,
  senderProfileId: string,
  body: string,
) {
  return supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_profile_id: senderProfileId, body })
    .select('id, conversation_id, sender_profile_id, body, created_at')
    .single();
}

export async function markConversationRead(
  supabase: SupabaseClient,
  conversationId: string,
  profileId: string,
) {
  return supabase
    .from('conversation_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('profile_id', profileId);
}

export function subscribeToConversationMessages(
  supabase: SupabaseClient,
  conversationId: string,
  profileId: string,
  onInsert: (line: ChatLine, row: MessageRow) => void,
): () => void {
  const channel = supabase
    .channel(`messages:conversation:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        const row = payload.new as MessageRow;
        onInsert(mapMessageRow(row, profileId), row);
      },
    )
    .subscribe();

  return () => removeChannelSafe(supabase, channel);
}

/** RLS limita eventos a conversaciones donde el usuario es miembro (sidebar / unread). */
export function subscribeToMemberMessageInserts(
  supabase: SupabaseClient,
  profileId: string,
  onInsert: (row: MessageRow) => void,
): () => void {
  const channel = supabase
    .channel(`messages:inbox:${profileId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      (payload) => onInsert(payload.new as MessageRow),
    )
    .subscribe();

  return () => removeChannelSafe(supabase, channel);
}
