export type ScoreInput = {
  profileCompletePct: number;
  verified: boolean;
  completedCampaigns: number;
  reviewAvg: number | null;
  reviewCount: number;
  responseRate: number | null;
  fulfillmentRate: number | null;
  confirmedReports: number;
  cancelledCampaigns: number;
};

export type ScoreResult = {
  value: number | null;
  label: string;
  breakdown: Record<string, number | null>;
};

const WEIGHTS = {
  profile: 0.15,
  verification: 0.20,
  completed: 0.25,
  reviews: 0.20,
  response: 0.10,
  fulfillment: 0.10,
} as const;

export function calculateKuvoScore(input: ScoreInput): ScoreResult {
  const breakdown: Record<string, number | null> = {
    profile: Math.min(100, Math.max(0, input.profileCompletePct)) * WEIGHTS.profile,
    verification: input.verified ? 100 * WEIGHTS.verification : 0,
    completed: Math.min(100, input.completedCampaigns * 20) * WEIGHTS.completed,
    reviews: input.reviewCount >= 1 && input.reviewAvg != null
      ? (input.reviewAvg / 5) * 100 * WEIGHTS.reviews
      : null,
    response: input.responseRate != null ? input.responseRate * WEIGHTS.response : null,
    fulfillment: input.fulfillmentRate != null ? input.fulfillmentRate * WEIGHTS.fulfillment : null,
  };

  const signals = [
    input.profileCompletePct >= 40,
    input.verified,
    input.completedCampaigns >= 1,
    input.reviewCount >= 1,
    input.responseRate != null,
    input.fulfillmentRate != null,
  ].filter(Boolean).length;

  if (signals < 2) {
    return { value: null, label: 'Datos insuficientes', breakdown };
  }

  let totalWeight = WEIGHTS.profile + WEIGHTS.verification + WEIGHTS.completed;
  let weighted = (breakdown.profile ?? 0) + (breakdown.verification ?? 0) + (breakdown.completed ?? 0);

  if (breakdown.reviews != null) {
    weighted += breakdown.reviews;
    totalWeight += WEIGHTS.reviews;
  }
  if (breakdown.response != null) {
    weighted += breakdown.response;
    totalWeight += WEIGHTS.response;
  }
  if (breakdown.fulfillment != null) {
    weighted += breakdown.fulfillment;
    totalWeight += WEIGHTS.fulfillment;
  }

  let value = Math.round(weighted / totalWeight);
  const penalty = Math.min(30, input.confirmedReports * 10 + input.cancelledCampaigns * 5);
  value = Math.max(0, Math.min(100, value - penalty));

  return { value, label: String(value), breakdown };
}

export function formatScoreDisplay(score: number | null | undefined): string {
  if (score == null || Number.isNaN(score)) return 'Datos insuficientes';
  return String(Math.round(score));
}
