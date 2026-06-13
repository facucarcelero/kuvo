import type { SupabaseClient } from '@supabase/supabase-js';

export async function fetchPublicCampaign(supabase: SupabaseClient, id: string) {
  return supabase
    .from('campaigns')
    .select(`
      id, title, description, category, city, budget_min, budget_max,
      deliverables, status, deadline, created_at,
      business_profiles (
        id, business_name, verified,
        profiles ( id, full_name, username, city, verified )
      )
    `)
    .eq('id', id)
    .maybeSingle();
}

export async function fetchPublicCreatorByUsername(supabase: SupabaseClient, username: string) {
  return supabase
    .from('creator_profiles')
    .select(`
      id, profile_id, categories, followers_declared, engagement_declared,
      starting_price, score, portfolio, experience,
      profiles!inner ( id, full_name, username, city, bio, verified, active, avatar_url )
    `)
    .eq('profiles.username', username)
    .eq('profiles.active', true)
    .maybeSingle();
}

export async function fetchPublicBusinessByUsername(supabase: SupabaseClient, username: string) {
  return supabase
    .from('business_profiles')
    .select(`
      id, business_name, industry, website, location, verified,
      profiles!inner ( id, full_name, username, city, bio, verified, active, avatar_url )
    `)
    .eq('profiles.username', username)
    .eq('profiles.role', 'business')
    .eq('profiles.active', true)
    .maybeSingle();
}

export async function fetchOpenCampaignsByBusiness(supabase: SupabaseClient, businessId: string) {
  return supabase
    .from('campaigns')
    .select('id, title, category, city, status, budget_max, created_at')
    .eq('business_id', businessId)
    .in('status', ['open', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(12);
}
