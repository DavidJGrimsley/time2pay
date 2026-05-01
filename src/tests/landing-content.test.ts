import { describe, expect, it, vi } from 'vitest';
import {
  ctaSection,
  features,
  githubBullets,
  heroSection,
  LANDING_SEO_DESCRIPTION,
  LANDING_SEO_TITLE,
  mercuryBullets,
  mercuryCallout,
  pricingBullets,
  pricingSection,
  workflowSection,
} from '../content/landing-content';

vi.mock('expo-router/head', () => ({
  default: () => null,
}));

describe('landing page content', () => {
  it('surfaces the refreshed product positioning', () => {
    const landingCopy = JSON.stringify({
      ctaSection,
      features,
      githubBullets,
      heroSection,
      mercuryBullets,
      mercuryCallout,
      pricingBullets,
      pricingSection,
      workflowSection,
    });

    expect(heroSection.title).toBe('Time2Pay');
    expect(landingCopy).toContain('GitHub');
    expect(landingCopy).toContain('commits and pull requests follow the session');
    expect(landingCopy).toContain('pull requests');
    expect(workflowSection.eyebrow).toBe('GitHub · Optional for developers');
    expect(workflowSection.title).toBe('Bill against the work you actually did.');
    expect(landingCopy).toContain('Mercury invoices your clients can pay with one click');
    expect(landingCopy).toContain('branded invoices ready to email');
    expect(landingCopy).toContain('$1/month');
    expect(landingCopy).toContain('one-time $10 lifetime membership');
    expect(landingCopy).toContain('Self-Host for Free');
    expect(landingCopy).toContain('free lifetime hosted access');
    expect(features[1]?.id).toBe('invoices');
    expect(features[1]?.body).toContain('branded invoices');
    expect(features[2]?.title).toBe('Keep every billable hour tied to the right client and project.');
    expect(pricingBullets.map((bullet) => bullet.id)).toEqual([
      'mercury-lifetime',
      'hosted',
      'self-host',
    ]);
    expect(githubBullets.map((bullet) => bullet.id)).toEqual([
      'repo-start',
      'branch-context',
      'commit-links',
    ]);
    expect(pricingBullets.every((bullet) => Boolean(bullet.cta))).toBe(true);
  });

  it('keeps SEO metadata aligned with pricing and integrations', async () => {
    const { buildSoftwareApplicationJsonLd } = await import(
      '../components/landing/landing-seo-head'
    );
    const schema = buildSoftwareApplicationJsonLd({
      landingUrl: 'https://time2pay.app/',
      socialImageUrl: 'https://time2pay.app/images/time2payLogo.png',
    });

    expect(LANDING_SEO_TITLE).toContain('Time Tracking & Invoicing');
    expect(LANDING_SEO_DESCRIPTION).toContain('one-click Mercury payments');
    expect(LANDING_SEO_DESCRIPTION).toContain('$1/month');
    expect(LANDING_SEO_DESCRIPTION).toContain('$10 lifetime');
    expect(schema).toMatchObject({
      '@type': 'SoftwareApplication',
      name: 'Time2Pay',
      applicationCategory: 'BusinessApplication',
      offers: {
        '@type': 'Offer',
        price: '1.00',
        priceCurrency: 'USD',
      },
    });
  });
});
