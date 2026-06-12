export type AccountRole = 'business' | 'creator' | 'admin';

export type CampaignStatus =
  | 'draft'
  | 'open'
  | 'paused'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type ApplicationStatus =
  | 'pending'
  | 'shortlisted'
  | 'accepted'
  | 'rejected'
  | 'withdrawn';

export type ReportTargetType = 'profile' | 'campaign' | 'message' | 'review';

export type ProfileRow = {
  id: string;
  account_id: string;
  role: AccountRole;
  full_name: string;
  username: string | null;
  city: string | null;
  avatar_url: string | null;
  bio: string | null;
  verified: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type CreatorProfileRow = {
  id: string;
  profile_id: string;
  categories: string[];
  instagram: string | null;
  tiktok: string | null;
  youtube: string | null;
  followers: number;
  engagement: number;
  followers_declared: number;
  engagement_declared: number;
  starting_price: number;
  score: number;
  availability: boolean;
  portfolio: unknown;
  experience: string | null;
};

export type BusinessProfileRow = {
  id: string;
  profile_id: string;
  business_name: string;
  industry: string | null;
  website: string | null;
  location: string | null;
  logo_url: string | null;
  verified: boolean;
};

export type CampaignRow = {
  id: string;
  business_id: string;
  title: string;
  description: string;
  category: string;
  city: string;
  budget_min: number;
  budget_max: number;
  deliverables: string[];
  status: CampaignStatus;
  deadline: string | null;
  created_at: string;
  updated_at: string;
};

export type ApplicationRow = {
  id: string;
  campaign_id: string;
  creator_id: string;
  message: string;
  proposed_price: number;
  status: ApplicationStatus;
  created_at: string;
  updated_at: string;
};

export type FavoriteRow = {
  id: string;
  account_id: string;
  creator_id: string;
  created_at: string;
};

export type ConversationRow = {
  id: string;
  campaign_id: string | null;
  created_at: string;
  updated_at: string;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_profile_id: string;
  body: string;
  created_at: string;
};

export type NotificationRow = {
  id: string;
  account_id: string;
  title: string;
  body: string;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
};

export type ReviewRow = {
  id: string;
  campaign_id: string;
  reviewer_profile_id: string;
  reviewed_profile_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export type AuditLogRow = {
  id: string;
  actor_profile_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ReportRow = {
  id: string;
  reporter_profile_id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: string;
  details: string | null;
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  created_at: string;
  resolved_at: string | null;
};
