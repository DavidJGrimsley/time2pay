import { describe, expect, it } from 'vitest';
import { onboardingConfig } from '@/features/onboarding/onboarding-config';

describe('onboarding invoice explanation', () => {
  it('covers hourly, completed milestone, and combined invoice models', () => {
    const copy = onboardingConfig.featureHighlights.map((feature) => feature.body).join(' ');
    expect(copy).toContain('hourly invoices');
    expect(copy).toContain('milestone invoices');
    expect(copy).toContain('completed milestone with its related sessions');
  });
});
