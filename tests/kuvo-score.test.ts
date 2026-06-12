import { describe, expect, it } from 'vitest';
import { calculateKuvoScore, formatScoreDisplay } from '@/lib/score/kuvo-score';

describe('calculateKuvoScore', () => {
  it('devuelve datos insuficientes con pocas señales', () => {
    const result = calculateKuvoScore({
      profileCompletePct: 10,
      verified: false,
      completedCampaigns: 0,
      reviewAvg: null,
      reviewCount: 0,
      responseRate: null,
      fulfillmentRate: null,
      confirmedReports: 0,
      cancelledCampaigns: 0,
    });
    expect(result.value).toBeNull();
    expect(result.label).toBe('Datos insuficientes');
  });

  it('calcula un puntaje cuando hay señales suficientes', () => {
    const result = calculateKuvoScore({
      profileCompletePct: 90,
      verified: true,
      completedCampaigns: 3,
      reviewAvg: 4.5,
      reviewCount: 4,
      responseRate: 0.8,
      fulfillmentRate: 0.9,
      confirmedReports: 0,
      cancelledCampaigns: 0,
    });
    expect(result.value).not.toBeNull();
    expect(result.value).toBeGreaterThan(50);
  });

  it('aplica penalización por reportes confirmados', () => {
    const base = calculateKuvoScore({
      profileCompletePct: 90,
      verified: true,
      completedCampaigns: 2,
      reviewAvg: 4,
      reviewCount: 2,
      responseRate: 0.7,
      fulfillmentRate: 0.8,
      confirmedReports: 0,
      cancelledCampaigns: 0,
    });
    const penalized = calculateKuvoScore({
      profileCompletePct: 90,
      verified: true,
      completedCampaigns: 2,
      reviewAvg: 4,
      reviewCount: 2,
      responseRate: 0.7,
      fulfillmentRate: 0.8,
      confirmedReports: 2,
      cancelledCampaigns: 1,
    });
    expect(penalized.value).toBeLessThan(base.value ?? 100);
  });
});

describe('formatScoreDisplay', () => {
  it('muestra datos insuficientes sin valor', () => {
    expect(formatScoreDisplay(null)).toBe('Datos insuficientes');
  });
});
