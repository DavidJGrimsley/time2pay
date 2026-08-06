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
  cta?: LandingCta;
};

export type LandingSection = {
  id: string;
  eyebrow?: string;
  title: string;
  body: string[];
  ctas?: LandingCta[];
};

export const TIME2PAY_GITHUB_URL = 'https://github.com/DavidJGrimsley/time2pay';
export const DAVID_GRIMSLEY_PORTFOLIO_URL = 'https://DavidJGrimsley.com';
export const MERCURY_REFERRAL_STATUS_PATH = '/referral-status';
export const TIME2PAY_SOCIAL_IMAGE_PATH = '/images/time2payLogo.png';

export const LANDING_SEO_TITLE =
  'Time2Pay – Time Tracking & Invoicing App for Freelancers and Subcontractors';
export const LANDING_SEO_DESCRIPTION =
  'Clock in, track hours by client and project, and send professional invoices in minutes. Time2Pay is a time tracking and invoicing app for freelancers and independent contractors—starting at $2/month or $20/year, with GitHub proof of work and one-click Mercury payments.';

export const heroSection: LandingSection = {
  id: 'hero',
  eyebrow: 'Time tracking & invoicing for contractors',
  title: 'Time2Pay',
  body: [
    'Clock in when work starts, keep hours organized by client and project, and build invoices from your actual time records—not a spreadsheet you reconstructed after the fact.',
    'Get started for $2/month or $20/year, or self-host for free. The Mercury referral reward is coming soon.',
  ],
};

export const workflowSection: LandingSection = {
  id: 'workflow',
  eyebrow: 'GitHub · Optional for developers',
  title: 'Bill against the work you actually did.',
  body: [
    'Link a repo, start a timer, and your commits and pull requests follow the session. When the invoice is ready, clients can trace every billed hour back to the code that shipped.',
    "Don't use GitHub? The time tracking and invoicing workflow works exactly the same without it.",
  ],
};

export const featuresSection: LandingSection = {
  id: 'features',
  eyebrow: 'How It Works',
  title: 'Track time, build invoices, get paid.',
  body: [
    'Clock in, keep sessions organized by client and project, and generate branded invoices ready to email—or create Mercury invoices your clients can pay with one click.',
  ],
};

export const features: LandingFeature[] = [
  {
    id: 'timer',
    eyebrow: '01  Time tracking',
    title: 'Capture billable hours while the work is happening.',
    body: 'Start the timer, add manual sessions when needed, capture breaks, and keep notes tied to the client work—not an app you check separately.',
    detail: 'Sessions stay editable because billable time rarely follows a perfect stopwatch.',
  },
  {
    id: 'invoices',
    eyebrow: '02  Invoice pipeline',
    title: 'Build invoices from your time records, not memory.',
    body: 'Generate branded invoices ready to email, or create Mercury invoices your clients can pay with one click—without rebuilding the work history by hand.',
    detail: 'You keep the review step before anything is sent.',
  },
  {
    id: 'github-proof',
    eyebrow: '03  Work records',
    title: 'Keep every billable hour tied to the right client and project.',
    body: 'Clean customer, project, and task records keep your hours organized before they ever become an invoice.',
    detail: 'Commit links and pull request context can follow sessions into invoice previews and PDFs when you need them.',
  },
];

export const githubBullets: LandingBullet[] = [
  {
    id: 'repo-start',
    title: 'Start from a URL',
    body: 'Paste a repo or commit URL and Time2Pay creates the customer, project, and task records for you.',
  },
  {
    id: 'branch-context',
    title: 'Work stays tied to the code',
    body: 'Your active branch becomes the task context so billable hours stay labeled as the work moves.',
  },
  {
    id: 'commit-links',
    title: 'Clients see what shipped',
    body: 'Commit messages and pull request links appear on sessions and invoices so clients can verify what they paid for.',
  },
];

export const mercuryCallout: LandingSection = {
  id: 'mercury-callout',
  eyebrow: 'Mercury Integration',
  title: 'One-click invoicing for Mercury business accounts.',
  body: [
    'Connect your Mercury account and turn tracked sessions into invoices your clients can pay with one click. The review step stays in the flow—you see exactly where money is going before it moves.',
    "Mercury contacts, account context, and payment workflows stay visible beside the invoice so you're not switching tabs to see where you stand.",
  ],
  ctas: [
    { label: 'Mercury Reward — Coming Soon', href: MERCURY_REFERRAL_STATUS_PATH, kind: 'primary' },
    { label: 'Start Hosted for $2/month', href: '/profile', kind: 'primary' },
    { label: 'Self-Host for Free', href: TIME2PAY_GITHUB_URL, kind: 'secondary' },
  ],
};

export const mercuryBullets: LandingBullet[] = [
  {
    id: 'secure-key',
    title: 'One-click payment',
    body: "Create a local invoice and a Mercury invoice at the same time. Clients pay with one click—you stay in control of what gets sent.",
  },
  {
    id: 'drafts',
    title: 'Review before anything moves',
    body: 'Check the destination account, line items, and delivery before sending. The confirm step stays visible in the flow.',
  },
  {
    id: 'bank-context',
    title: 'Contacts already synced',
    body: "Mercury customer contacts appear in your client list so you're not re-entering billing info for repeat clients.",
  },
  {
    id: 'payments',
    title: 'Balances in view',
    body: "See Mercury account context beside your billing work so you're not switching tabs to check where you stand.",
  },
];

export const pricingSection: LandingSection = {
  id: 'pricing',
  eyebrow: 'Pricing',
  title: '$2/month, $20/year, or self-host for free.',
  body: [
    'Time2Pay keeps the core app self-hostable for operators who want full control. Paid Time2Pay is simple: choose $2/month or the recommended $20 annual plan.',
    'Mercury referral attribution is being connected. Once verification is reliable, qualified referrals will receive free lifetime access.',
  ],
  ctas: [
    { label: 'Start Hosted for $2/month', href: '/profile', kind: 'primary' },
    { label: 'Mercury Reward — Coming Soon', href: MERCURY_REFERRAL_STATUS_PATH, kind: 'primary' },
    { label: 'Self-Host for Free', href: TIME2PAY_GITHUB_URL, kind: 'secondary' },
  ],
};

export const pricingBullets: LandingBullet[] = [
  {
    id: 'mercury-lifetime',
    title: 'Mercury reward coming soon',
    body: 'Referral attribution and qualification reporting are being connected with Mercury.',
    cta: { label: 'See Referral Status', href: MERCURY_REFERRAL_STATUS_PATH, kind: 'primary' },
  },
  {
    id: 'hosted',
    title: '$2/month',
    body: 'Pay month to month, cancel whenever. Includes hosted sign-in, cloud data storage, and Mercury integration.',
    cta: { label: 'Start Hosted for $2/month', href: '/profile', kind: 'primary' },
  },
  {
    id: 'self-host',
    title: 'Self-host for free',
    body: 'Run it yourself from the open-source repo. No subscription, no account required.',
    cta: { label: 'Self-Host for Free', href: TIME2PAY_GITHUB_URL, kind: 'secondary' },
  },
];

export const ctaSection: LandingSection = {
  id: 'cta',
  eyebrow: 'Get Started',
  title: 'Track time and invoice clients starting at $2/month.',
  body: [],
  ctas: [
    { label: 'Start Hosted for $2/month', href: '/profile', kind: 'primary' },
    { label: 'Mercury Reward — Coming Soon', href: MERCURY_REFERRAL_STATUS_PATH, kind: 'primary' },
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
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Privacy Policy', href: '/privacy' },
];
