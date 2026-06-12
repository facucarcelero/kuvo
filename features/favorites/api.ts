import type { SupabaseClient } from '@supabase/supabase-js';

export type FavoriteItem = {
  id: string;
  creatorId: string;
  createdAt: string;
};

export async function listFavorites(supabase: SupabaseClient, accountId: string) {
  return supabase
    .from('favorites')
    .select('id, creator_id, created_at')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });
}

export async function addFavorite(
  supabase: SupabaseClient,
  accountId: string,
  creatorId: string,
) {
  return supabase
    .from('favorites')
    .insert({ account_id: accountId, creator_id: creatorId })
    .select('id, creator_id, created_at')
    .single();
}

export async function removeFavorite(supabase: SupabaseClient, favoriteId: string) {
  return supabase.from('favorites').delete().eq('id', favoriteId);
}
