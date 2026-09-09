import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const approvedDisclosure = [
  'Mercury is a fintech company, not an FDIC-insured bank.',
  'Banking services provided through Choice Financial Group and Column N.A., Members FDIC.',
].join(' ');

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n');

const placementSources = [
  'src/components/mercury-overview.tsx',
  'src/components/invoices-overview.tsx',
  'src/features/settings/integrations/integrations-screen.tsx',
  'src/components/landing/mercury-scene.tsx',
];

const mercuryWorkspaceComponentSources = [
  'src/components/controlled-mercury-bank-overview.tsx',
  'src/components/controlled-mercury-send-money-workflow.tsx',
];

const auditedSources = [
  ...placementSources,
  'src/components/bank-overview.tsx',
  'src/components/payments-overview.tsx',
  'src/components/controlled-mercury-bank-overview.tsx',
  'src/components/controlled-mercury-send-money-workflow.tsx',
  'src/components/InvoiceBuilder.tsx',
  'src/components/mercury-key-gate.tsx',
  'src/app/bank.tsx',
  'src/app/payments.tsx',
  'src/app/settings.tsx',
  'src/features/legal/legal-document-modal.tsx',
  'src/server/mercury/redact.ts',
  'src/server/mercury/audit.ts',
];

const prohibitedPhrases = [
  'Evolve Bank & Trust',
  'Mercury Bank',
  'Mercury bank account',
  'open a bank account with Mercury',
  'banking built for startups',
];

describe('Mercury disclosure compliance', () => {
  it('uses the shared business banking footer at every Mercury surface', () => {
    for (const path of placementSources) {
      const source = readSource(path);
      expect(source).toContain("from '@/components/mercury-disclosure'");
      expect(source).toContain('<MercuryDisclosure');
    }
  });

  it('places the workspace powered mark inside the associated Mercury panels', () => {
    for (const path of mercuryWorkspaceComponentSources) {
      const source = readSource(path);
      expect(source).toContain("from '@/components/mercury-disclosure'");
      expect(source).toContain('<MercuryPoweredBy');
      expect(source).toContain('headerAccessory={<MercuryPoweredBy />}');
    }

    for (const path of ['src/components/bank-overview.tsx', 'src/components/payments-overview.tsx']) {
      expect(readSource(path)).toContain('<MercuryKeyGate headerAccessory={<MercuryPoweredBy />}>');
    }
  });

  it('keeps the powered mark visible above guarded work and the disclosure as its footer', () => {
    const mercuryOverviewSource = readSource('src/components/mercury-overview.tsx');
    const invoicesSource = readSource('src/components/invoices-overview.tsx');
    const landingSource = readSource('src/components/landing/mercury-scene.tsx');

    expect(mercuryOverviewSource.indexOf('<MercuryDisclosure')).toBeGreaterThan(
      mercuryOverviewSource.indexOf('<AnimatedSizeView'),
    );
    expect(invoicesSource).toContain(
      '<MercuryKeyGate requireArAccess headerAccessory={<MercuryPoweredBy />}>',
    );
    expect(invoicesSource.lastIndexOf('<MercuryPoweredBy')).toBeGreaterThan(
      invoicesSource.indexOf('<MercurySessionInvoiceWorkspace'),
    );
    expect(invoicesSource.indexOf('<MercuryDisclosure')).toBeGreaterThan(
      invoicesSource.lastIndexOf('<MercuryPoweredBy'),
    );
    expect(landingSource.indexOf('<MercuryPoweredBy')).toBeLessThan(
      landingSource.indexOf('mercuryBullets.map'),
    );
    expect(landingSource.indexOf('testID="mercury-referral-cta"')).toBeGreaterThan(
      landingSource.indexOf('mercuryBullets.map'),
    );
    expect(landingSource.indexOf('testID="mercury-referral-disclosure"')).toBeGreaterThan(
      landingSource.indexOf('testID="mercury-referral-cta"'),
    );
    expect(landingSource.lastIndexOf('<MercuryDisclosure')).toBeGreaterThan(
      landingSource.indexOf('testID="mercury-referral-cta"'),
    );
    expect(landingSource).toContain('MERCURY_AFFILIATE_LINK_DISCLOSURE');
  });

  it('keeps approved disclosure copy centralized and rejects stale prohibited language', () => {
    const disclosureSource = readSource('src/components/mercury-disclosure.tsx');
    const escapedDisclosure = approvedDisclosure.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    expect(disclosureSource).toContain(approvedDisclosure);
    expect(disclosureSource.match(new RegExp(escapedDisclosure, 'g'))).toHaveLength(1);

    for (const path of auditedSources) {
      const source = readSource(path);
      expect(source).not.toContain(approvedDisclosure);

      for (const phrase of prohibitedPhrases) {
        expect(source).not.toContain(phrase);
      }
    }
  });
});
