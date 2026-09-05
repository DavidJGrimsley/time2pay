import type { Href } from 'expo-router';

export type OnboardingCompletionMode = 'enter-app' | 'auth' | 'account-setup' | 'custom';

export interface OnboardingValueProp {
  title: string;
  body: string;
}

export interface OnboardingFeatureHighlight {
  id: string;
  title: string;
  body: string;
  badge?: string;
}

export interface OnboardingCompletionConfig {
  mode: OnboardingCompletionMode;
  route: Href;
  label: string;
  helperText: string;
}

export interface OnboardingConfig {
  appName: string;
  welcomeEyebrow: string;
  welcomeTitle: string;
  welcomeBody: string;
  valueProps: OnboardingValueProp[];
  nextRouteAfterWelcome: Href;
  featuresEyebrow: string;
  featuresTitle: string;
  featuresBody: string;
  featureHighlights: OnboardingFeatureHighlight[];
  nextRouteAfterFeatures: Href;
  legal: {
    title: string;
    body: string;
  };
  completeTitle: string;
  completeBody: string;
  completion: OnboardingCompletionConfig;
}

export const onboardingConfig: OnboardingConfig = {
  appName: 'Time2Pay',
  welcomeEyebrow: 'Time tracking and invoicing',
  welcomeTitle: 'Track the work now. Invoice from real records later.',
  welcomeBody:
    'Time2Pay helps contractors clock in, keep hours organized by client and project, and build invoices from the work record instead of memory.',
  valueProps: [
    {
      title: 'Capture billable hours while the work is happening',
      body: 'Start the timer, add manual sessions when needed, and keep notes tied to the client work.',
    },
    {
      title: 'Build invoices from sessions',
      body: 'Turn reviewed time records into clean invoices without rebuilding the week from a spreadsheet.',
    },
    {
      title: 'Keep proof close to the job',
      body: 'Customer, project, pictures, and notes context can stay attached from session to invoice.',
    },
  ],
  nextRouteAfterWelcome: '/onboarding/features' as Href,
  featuresEyebrow: 'Optional integrations',
  featuresTitle: 'Use the workflow that fits the job',
  featuresBody:
    'Time2Pay works for field contractors, freelancers, and programmers. The integrations are optional helpers when they match how you already work.',
  featureHighlights: [
    {
      id: 'core-workflow',
      title: 'Clients, projects, tasks, and sessions',
      body: 'Keep each billable session tied to the right customer and project before it ever becomes an invoice.',
      badge: 'Core',
    },
    {
      id: 'invoice-models',
      title: 'Invoice the way the job is priced',
      body: 'Create hourly invoices from reviewed sessions, milestone invoices after work is complete, or combine a completed milestone with its related sessions in one draft.',
      badge: 'Invoicing',
    },
    {
      id: 'github',
      title: 'GitHub proof for development work',
      body: 'Link a repo or paste a GitHub URL so commits and pull requests can follow sessions into invoice review.',
      badge: 'Optional',
    },
    {
      id: 'mercury',
      title: 'Mercury invoices and one-click payment',
      body: 'Create invoices your clients can pay quickly while keeping the review step visible before anything is sent.',
      badge: 'Optional',
    },
  ],
  nextRouteAfterFeatures: '/onboarding/auth' as Href,
  legal: {
    title: 'Review the basics',
    body: 'Please review and accept the current Time2Pay Terms of Service and Privacy Policy before entering your account.',
  },
  completeTitle: 'You are ready to begin',
  completeBody: 'Enter the app and start setting up your first client, project, and billable session.',
  completion: {
    mode: 'auth',
    route: '/dashboard' as Href,
    label: 'Enter Time2Pay',
    helperText: 'Time2Pay will save this acceptance to your account before opening the app.',
  },
};
