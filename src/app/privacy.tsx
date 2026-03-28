import { PublicLegalDocument } from '@/components/legal/public-legal-document';

const PRIVACY_SECTIONS = [
  {
    heading: '1. Data We Process',
    body: [
      'Time2Pay processes information needed to provide session tracking, invoicing, and account functionality.',
      'Depending on your selected runtime mode, data may be stored locally on device or in hosted infrastructure you configure.',
    ],
  },
  {
    heading: '2. How Data Is Used',
    body: [
      'Data is used to run core app features such as timers, profile completion, invoice preparation, and integrations you enable.',
      'We do not sell your personal data. Data is processed for product operation, support, and security purposes.',
    ],
  },
  {
    heading: '3. Integrations and Third Parties',
    body: [
      'When integrations such as Mercury or GitHub are enabled, related data exchange is subject to those providers and your configuration.',
      'Review third-party provider policies directly for their independent processing terms.',
    ],
  },
  {
    heading: '4. Security and Retention',
    body: [
      'Time2Pay applies operational safeguards and environment-based controls, including hosted-mode validation and access boundaries.',
      'You should rotate credentials, protect secrets, and remove data that is no longer required for business or compliance purposes.',
    ],
  },
  {
    heading: '5. Your Choices',
    body: [
      'You can request updates or removal of profile data through your managed environment and deployment controls.',
      'This policy may be updated to reflect product changes and legal requirements.',
    ],
  },
];

export default function PrivacyRoute() {
  return (
    <PublicLegalDocument
      title="Privacy Policy"
      lastUpdated="2026-03-28"
      sections={[...PRIVACY_SECTIONS]}
    />
  );
}
