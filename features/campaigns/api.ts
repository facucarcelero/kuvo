import type { SupabaseClient } from '@supabase/supabase-js';
import type { Campaign } from '@/lib/types';

type DraftCampaignInput = {
  businessId: string;
  title: string;
  description: string;
  category: string;
  city: string;
  budgetMin: number;
  budgetMax: number;
  deliverables: string[];
  deadline: string;
};

export async function insertDraftCampaign(supabase: SupabaseClient, input: DraftCampaignInput) {
  return supabase
    .from('campaigns')
    .insert({
      business_id: input.businessId,
      title: input.title,
      description: input.description,
      category: input.category,
      city: input.city,
      budget_min: input.budgetMin,
      budget_max: input.budgetMax,
      deliverables: input.deliverables,
      deadline: input.deadline,
      status: 'draft',
    })
    .select('id')
    .single();
}

export async function publishCampaign(supabase: SupabaseClient, campaignId: string) {
  return supabase.rpc('business_publish_campaign', { p_campaign_id: campaignId });
}

export async function pauseCampaign(supabase: SupabaseClient, campaignId: string) {
  return supabase.rpc('business_pause_campaign', { p_campaign_id: campaignId });
}

export async function reopenCampaign(supabase: SupabaseClient, campaignId: string) {
  return supabase.rpc('business_reopen_campaign', { p_campaign_id: campaignId });
}

export async function cancelCampaign(supabase: SupabaseClient, campaignId: string) {
  return supabase.rpc('business_cancel_campaign', { p_campaign_id: campaignId });
}

export async function completeCampaign(supabase: SupabaseClient, campaignId: string) {
  return supabase.rpc('business_complete_campaign', { p_campaign_id: campaignId });
}

export type CampaignTransition = 'pause' | 'reopen' | 'cancel' | 'complete';

const TRANSITION_STATUS: Record<CampaignTransition, Campaign['status']> = {
  pause: 'paused',
  reopen: 'open',
  cancel: 'cancelled',
  complete: 'completed',
};

const TRANSITION_RPC: Record<CampaignTransition, (supabase: SupabaseClient, id: string) => ReturnType<typeof pauseCampaign>> = {
  pause: pauseCampaign,
  reopen: reopenCampaign,
  cancel: cancelCampaign,
  complete: completeCampaign,
};

export async function transitionCampaign(
  supabase: SupabaseClient,
  campaignId: string,
  action: CampaignTransition,
) {
  const { error } = await TRANSITION_RPC[action](supabase, campaignId);
  return { nextStatus: TRANSITION_STATUS[action], error };
}
