import type { SupabaseClient } from '@supabase/supabase-js';

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
