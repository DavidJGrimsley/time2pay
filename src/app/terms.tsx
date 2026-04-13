import { PublicLegalDocument } from '@/components/legal/public-legal-document';

const TERMS_SECTIONS = [
  {
    heading: '1. Service Scope',
    body: [
      'Time2Pay is provided as a workflow tool for session tracking, invoicing, and payment-related business operations.',
      'You are responsible for how you use exported data, invoices, and any integrations connected to your account.',
    ],
  },
  {
    heading: '2. Account Responsibilities',
    body: [
      'You agree to provide accurate profile and business identity information when using hosted account features.',
      'You are responsible for maintaining control of your sign-in methods and keeping access to your device and account secure.',
    ],
  },
  {
    heading: '3. Payments and Integrations',
    body: [
      'Third-party financial services and APIs, including Mercury, are governed by their own terms and policies.',
      'Time2Pay does not represent, warrant, or control third-party banking platform behavior or availability.',
    ],
  },
  {
    heading: '4. Acceptable Use',
    body: [
      'You agree not to use Time2Pay for fraudulent, unlawful, or abusive activity.',
      'We may suspend access if use materially risks platform security, reliability, or legal compliance.',
    ],
  },
  {
    heading: '5. Changes and Contact',
    body: [
      'Terms may be updated as product functionality and compliance requirements evolve.',
      'Questions can be sent through the project contact channels listed in the app footer and repository.',
    ],
  },
];

export default function TermsRoute() {
  return (
    <PublicLegalDocument
      title="Terms of Service"
      lastUpdated="2026-03-28"
      sections={[...TERMS_SECTIONS]}
    />
  );
}
