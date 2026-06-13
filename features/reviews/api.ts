import type { SupabaseClient } from '@supabase/supabase-js';

export async function insertReview(
  supabase: SupabaseClient,
  input: {
    campaignId: string;
    reviewerProfileId: string;
    reviewedProfileId: string;
    rating: number;
    comment?: string;
  },
) {
  return supabase
    .from('reviews')
    .insert({
      campaign_id: input.campaignId,
      reviewer_profile_id: input.reviewerProfileId,
      reviewed_profile_id: input.reviewedProfileId,
      rating: input.rating,
      comment: input.comment ?? null,
    })
    .select('id')
    .single();
}

export async function listReviewsForCampaign(supabase: SupabaseClient, campaignId: string) {
  return supabase
    .from('reviews')
    .select('id, rating, comment, created_at, reviewer_profile_id')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });
}
