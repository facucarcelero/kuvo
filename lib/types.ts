export type Role = 'business' | 'creator' | 'admin';

export type Creator = {
  id: string;
  profileId: string;
  name: string;
  username: string;
  city: string;
  category: string;
  categories: string[];
  followers: number;
  engagement: number;
  startingPrice: number;
  score: number | null;
  scoreLabel?: string;
  verified: boolean;
  bio: string;
  initials: string;
  gradient: [string, string];
  portfolio: string[];
};

export type Campaign = {
  id: string;
  businessId: string;
  businessName: string;
  title: string;
  description: string;
  category: string;
  city: string;
  budgetMin: number;
  budgetMax: number;
  deliverables: string[];
  deadline: string;
  status: 'draft' | 'open' | 'paused' | 'in_progress' | 'completed' | 'cancelled';
  applicants?: number;
  gradient: [string, string];
};

export type Application = {
  id: string;
  campaignId: string;
  campaignTitle: string;
  creatorId: string;
  creatorName: string;
  message: string;
  proposedPrice: number;
  status: 'pending' | 'shortlisted' | 'accepted' | 'rejected' | 'withdrawn';
  createdAt: string;
};
