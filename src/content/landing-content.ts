export type LandingCta = {
  label: string;
  href: string;
  kind: 'primary' | 'secondary';
};

export type LandingFeature = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  detail: string;
};

export type LandingFooterLink = {
  label: string;
  href: string;
};

export type LandingBullet = {
  id: string;
  title: string;
  body: string;
};

export type LandingSection = {
  id: string;
  eyebrow?: string;
  title: string;
  body: string[];
  ctas?: LandingCta[];
};

export const SITE_ORIGIN = 'https://lucid-lewin.108-175-12-95.plesk.page';
export const TIME2PAY_GITHUB_URL = 'https://github.com/DavidJGrimsley/time2pay';
export const DAVID_GRIMSLEY_PORTFOLIO_URL = 'https://DavidJGrimsley.com';

export const heroSection: LandingSection = {
  id: 'hero',
  eyebrow: 'Local-first contractor workflow',
  title: 'Track the work. Build the invoice. Keep control.',
  body: [
    'Time2Pay keeps time tracking, invoicing, and client-ready records in one workflow built for freelancers and solo operators.',
    'Run it yourself, keep your data local, and move from live sessions to invoice exports without handing your business process to a third-party platform.',
  ],
};

export const workflowSection: LandingSection = {
  id: 'workflow',
  eyebrow: 'Workflow Preview',
  title: 'The operating loop before you even touch the dashboard.',
  body: [
    'This is the compact path the app is built around: track live work, clean up what matters, and turn it into invoice-ready output without leaving the flow.',
  ],
};

export const featuresSection: LandingSection = {
  id: 'features',
  eyebrow: 'How It Works',
  title: 'A short path from tracked hours to money collected.',
  body: [
    'The flow is intentionally compact: start the timer, clean up sessions, turn work into invoices, and keep banking context close when you need it.',
  ],
};

export const features: LandingFeature[] = [
  {
    id: 'timer',
    eyebrow: '01  Live timer',
    title: 'Track sessions while the work is happening.',
    body: 'Start and stop the timer quickly, capture breaks, and keep notes attached to the actual session instead of recreating the day later.',
    detail: 'Manual edits stay available when reality does not match the clock.',
  },
  {
    id: 'sessions',
    eyebrow: '02  Session organization',
    title: 'Group work by client, project, and task.',
    body: 'Time2Pay keeps the records readable enough to review before billing, which matters when you need to defend hours or revisit scope.',
    detail: 'The profile gate ensures the business identity shown on invoices is filled in first.',
  },
  {
    id: 'invoices',
    eyebrow: '03  Invoice pipeline',
    title: 'Turn sessions into invoice totals without a second spreadsheet.',
    body: 'Build invoices from tracked work, generate PDFs, and prepare payment-facing output with the sender and recipient information already in place.',
    detail: 'The goal is less re-entry and fewer opportunities for billing mistakes.',
  },
];

export const mercuryCallout: LandingSection = {
  id: 'mercury-callout',
  eyebrow: 'Mercury Pairing',
  title: 'Mercury is where the operating loop gets more powerful.',
  body: [
    'Time2Pay is being shaped around a Mercury-connected workflow where invoice state, payment context, and operator visibility live closer to the bank account.',
    'This is the early version of that story. As more Mercury API features land, this section will grow into a stronger partnership and demo surface.',
  ],
  ctas: [
    { label: 'Finish Profile Setup', href: '/profile', kind: 'primary' },
    { label: 'Self-Host for Free', href: TIME2PAY_GITHUB_URL, kind: 'secondary' },
  ],
};

export const mercuryBullets: LandingBullet[] = [
  {
    id: 'payments',
    title: 'Bank-aware invoicing',
    body: 'Mercury account context is where invoice delivery, payment tracking, and visibility start to feel like one connected flow.',
  },
  {
    id: 'reconciliation',
    title: 'Stronger finance-side leverage',
    body: 'The strongest version of Time2Pay is a Mercury-connected workspace that keeps billing and money movement closer together.',
  },
  {
    id: 'roadmap',
    title: 'Partnership-ready roadmap',
    body: 'This section is positioned for the next Mercury API additions, demos, and collaboration conversations.',
  },
  {
    id: 'more',
    title: 'More to come',
    body: 'More Mercury depth is coming as the banking features and product surface expand.',
  },
];

export const ctaSection: LandingSection = {
  id: 'cta',
  eyebrow: 'Get Started',
  title: 'Set up your business identity once, then get to work.',
  body: [
    'Returning users go straight to the dashboard after profile completion. First-time users should start by filling in the basic business details that unlock the rest of the app.',
  ],
  ctas: [
    { label: "Let's Get Started", href: '/profile', kind: 'primary' },
    { label: 'Self-Host for Free', href: TIME2PAY_GITHUB_URL, kind: 'secondary' },
  ],
};

export const footerBrand = {
  name: 'David J. Grimsley',
  alias: 'aka Mr. DJ',
  role: 'Designer, developer, and operator behind Time2Pay.',
  body: 'I build practical product systems, local-first tools, and Expo apps for businesses that want more control over their workflow.',
};

export const footerLinks: LandingFooterLink[] = [
  { label: 'DavidJGrimsley.com', href: DAVID_GRIMSLEY_PORTFOLIO_URL },
  { label: 'Time2Pay on GitHub', href: TIME2PAY_GITHUB_URL },
];
