import type { SupabaseClient } from '@supabase/supabase-js';
import type { Application } from '@/lib/types';

type ApplicationInsert = {
  campaignId: string;
  creatorId: string;
  message: string;
  proposedPrice: number;
};

export async function insertApplication(supabase: SupabaseClient, input: ApplicationInsert) {
  return supabase
    .from('applications')
    .insert({
      campaign_id: input.campaignId,
      creator_id: input.creatorId,
      message: input.message,
      proposed_price: input.proposedPrice,
    })
    .select('id, created_at')
    .single();
}

export async function shortlistApplication(supabase: SupabaseClient, applicationId: string) {
  return supabase.rpc('business_shortlist_application', { p_application_id: applicationId });
}

export async function rejectApplication(supabase: SupabaseClient, applicationId: string) {
  return supabase.rpc('business_reject_application', { p_application_id: applicationId });
}

export async function acceptApplication(supabase: SupabaseClient, applicationId: string) {
  return supabase.rpc('business_accept_application', { p_application_id: applicationId });
}

export async function withdrawApplication(supabase: SupabaseClient, applicationId: string) {
  return supabase.rpc('creator_withdraw_application', { p_application_id: applicationId });
}

export type ApplicationAction = 'shortlisted' | 'rejected' | 'accepted';

const ACTION_RPC: Record<
  Exclude<ApplicationAction, 'accepted'>,
  (supabase: SupabaseClient, id: string) => ReturnType<typeof shortlistApplication>
> = {
  shortlisted: shortlistApplication,
  rejected: rejectApplication,
};

export async function updateApplicationStatus(
  supabase: SupabaseClient,
  applicationId: string,
  action: ApplicationAction,
) {
  if (action === 'accepted') {
    const { data, error } = await acceptApplication(supabase, applicationId);
    return { conversationId: data as string | null, nextStatus: 'accepted' as Application['status'], error };
  }

  const { error } = await ACTION_RPC[action](supabase, applicationId);
  return { conversationId: null, nextStatus: action, error };
}
