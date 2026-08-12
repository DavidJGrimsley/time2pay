export type LegalDocumentId = 'terms' | 'privacy';

export interface LegalDocumentSection {
  id: string;
  title: string;
  body: string[];
}

export interface LegalDocument {
  id: LegalDocumentId;
  title: string;
  summary: string;
  effectiveDate: string;
  lastUpdated: string;
  /**
   * Bump this only for a material legal update that existing authenticated users
   * must accept before entering the app. Minor copy edits can update
   * lastUpdated/changeSummary while leaving acceptanceVersion unchanged.
   */
  acceptanceVersion: string;
  requiresReacceptance: boolean;
  changeSummary: string;
  sections: LegalDocumentSection[];
}

export const legalDocumentReplacementWarning = '';

export const legalDocuments: Record<LegalDocumentId, LegalDocument> = {
  terms: {
    id: 'terms',
    title: 'Terms of Service',
    summary: 'Terms for using Time2Pay session tracking, invoicing, and payment-related workflows.',
    effectiveDate: '2026-04-30',
    lastUpdated: '2026-04-30',
    acceptanceVersion: '2026-04-30',
    requiresReacceptance: true,
    changeSummary:
      'Initial hosted Time2Pay Terms acceptance for account-based session tracking, invoicing, and integrations.',
    sections: [
      {
        id: 'service-scope',
        title: '1. Service Scope',
        body: [
          'Time2Pay is provided as a workflow tool for session tracking, invoicing, and payment-related business operations.',
          'You are responsible for how you use exported data, invoices, and any integrations connected to your account.',
        ],
      },
      {
        id: 'account-responsibilities',
        title: '2. Account Responsibilities',
        body: [
          'You agree to provide accurate profile and business identity information when using account features.',
          'You are responsible for maintaining control of your sign-in methods and keeping access to your device and account secure.',
        ],
      },
      {
        id: 'payments-integrations',
        title: '3. Payments and Integrations',
        body: [
          'Third-party financial services and APIs, including Mercury, are governed by their own terms and policies.',
          'Time2Pay does not represent, warrant, or control third-party banking platform behavior or availability.',
        ],
      },
      {
        id: 'acceptable-use',
        title: '4. Acceptable Use',
        body: [
          'You agree not to use Time2Pay for fraudulent, unlawful, or abusive activity.',
          'We may suspend access if use materially risks platform security, reliability, or legal compliance.',
        ],
      },
      {
        id: 'changes-contact',
        title: '5. Changes and Contact',
        body: [
          'Terms may be updated as product functionality and compliance requirements evolve.',
          'Questions can be sent through the project contact channels listed in the app footer and repository.',
        ],
      },
    ],
  },
  privacy: {
    id: 'privacy',
    title: 'Privacy Policy',
    summary: 'Privacy details for Time2Pay account, session, invoice, and integration data.',
    effectiveDate: '2026-03-28',
    lastUpdated: '2026-03-28',
    acceptanceVersion: '2026-03-28',
    requiresReacceptance: true,
    changeSummary:
      'Initial hosted Time2Pay Privacy acceptance for account, session, invoice, and optional integration data.',
    sections: [
      {
        id: 'data-we-process',
        title: '1. Data We Process',
        body: [
          'Time2Pay processes information needed to provide session tracking, invoicing, and account functionality.',
          'Depending on your selected runtime mode, data may be stored locally on device or in infrastructure you configure.',
        ],
      },
      {
        id: 'how-data-is-used',
        title: '2. How Data Is Used',
        body: [
          'Data is used to run core app features such as timers, profile completion, invoice preparation, and integrations you enable.',
          'We do not sell your personal data. Data is processed for product operation, support, and security purposes.',
        ],
      },
      {
        id: 'integrations-third-parties',
        title: '3. Integrations and Third Parties',
        body: [
          'When integrations such as Mercury or GitHub are enabled, related data exchange is subject to those providers and your configuration.',
          'Review third-party provider policies directly for their independent processing terms.',
        ],
      },
      {
        id: 'security-retention',
        title: '4. Security and Retention',
        body: [
          'Time2Pay applies operational safeguards and environment-based controls, including mode validation and access boundaries.',
          'You should rotate credentials, protect secrets, and remove data that is no longer required for business or compliance purposes.',
        ],
      },
      {
        id: 'your-choices',
        title: '5. Your Choices',
        body: [
          'You can request updates or removal of profile data through your managed environment and deployment controls.',
          'This policy may be updated to reflect product changes and legal requirements.',
        ],
      },
    ],
  },
};

export function getLegalDocument(documentId: LegalDocumentId): LegalDocument {
  return legalDocuments[documentId];
}
