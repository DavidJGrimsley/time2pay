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
    expect(landingCopy).toContain('map projects to repos');
    expect(landingCopy).toContain('pull requests');
    expect(workflowSection.eyebrow).toBe('GitHub Integration (optional for developers)');
    expect(workflowSection.title).toBe('Integrate with GitHub');
    expect(landingCopy).toContain('Mercury invoices that are payable with the click of a button');
    expect(landingCopy).toContain('invoices with your branding that are ready to be emailed');
    expect(landingCopy).toContain('$1/month');
    expect(landingCopy).toContain('one-time $10 lifetime membership');
    expect(landingCopy).toContain('Self-Host for Free');
    expect(landingCopy).toContain('free lifetime hosted access');
    expect(features[1]?.id).toBe('invoices');
    expect(features[1]?.body).toContain('your branding');
    expect(features[2]?.title).toBe('Keep your billable work tied to the right customer and project.');
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

    expect(LANDING_SEO_TITLE).toContain('GitHub PR and Commit Invoicing');
    expect(LANDING_SEO_DESCRIPTION).toContain('Mercury invoices that are payable with the click of a button');
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
