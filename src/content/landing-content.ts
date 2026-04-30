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
export const MERCURY_REFERRAL_URL = 'https://mercury.com/partner/time2pay';
export const TIME2PAY_SOCIAL_IMAGE_PATH = '/images/time2payLogo.png';

export const LANDING_SEO_TITLE =
  'Time2Pay | GitHub PR and Commit Invoicing for Contractors';
export const LANDING_SEO_DESCRIPTION =
  'Time2Pay is a self-hostable contractor invoicing app with Mercury invoices that are payable with the click of a button, hosted access starting at $1/month, and $10 lifetime options.';

export const heroSection: LandingSection = {
  id: 'hero',
  eyebrow: 'Self-hostable contractor invoicing',
  title: 'Time2Pay',
  body: [
    'Track contractor work, connect it to GitHub commits and pull requests, and turn finished sessions into invoice-ready proof without a second spreadsheet.',
    'Self-host Time2Pay for free, or use the hosted app (this website and the downloadable mobile app) for $1/month with Mercury integration and secure data storage.',
  ],
};

export const workflowSection: LandingSection = {
  id: 'workflow',
  eyebrow: 'GitHub Integration (optional for developers)',
  title: 'Integrate with GitHub',
  body: [
    'If your work lives in GitHub, Time2Pay can turn repo context into billing context. Start from an owner or org, map projects to repos, map tasks to branches, and carry commits plus pull requests into the work record.',
    'If you are not using GitHub, you can still run the full time tracking and invoicing workflow normally.',
  ],
};

export const featuresSection: LandingSection = {
  id: 'features',
  eyebrow: 'How It Works',
  title: 'One workspace for proof of work, billing, and payment context.',
  body: [
    'The flow stays compact: clock in, keep sessions organized by customer and project, and create invoices with your branding that are ready to be emailed or become Mercury invoices that are payable with the click of a button.',
  ],
};

export const features: LandingFeature[] = [
  {
    id: 'timer',
    eyebrow: '01  Time tracking',
    title: 'Capture billable sessions while the work is happening.',
    body: 'Start the timer, add manual sessions when needed, capture breaks, and keep notes tied to the actual client work.',
    detail: 'Sessions stay editable because billing rarely follows a perfect stopwatch.',
  },
  {
    id: 'invoices',
    eyebrow: '02  Invoice pipeline',
    title: 'Build invoices without rebuilding the work history.',
    body: 'Generate invoices with your branding that are ready to be emailed, preserve session detail, and create Mercury invoices that are payable with the click of a button when your hosted profile is connected.',
    detail: 'You still keep the review step in the loop before anything is sent.',
  },
  {
    id: 'github-proof',
    eyebrow: '03  Work records',
    title: 'Keep your billable work tied to the right customer and project.',
    body: 'Use clean customer, project, and task records so your hours stay organized before they ever become an invoice.',
    detail: 'Supporting details can follow sessions into invoice previews and PDFs when you need them.',
  },
];

export const githubBullets: LandingBullet[] = [
  {
    id: 'repo-start',
    title: 'Start from a repo',
    body: 'Paste a GitHub repo or commit URL, or use connected repo access, to create or reuse the customer, project, and task records.',
  },
  {
    id: 'branch-context',
    title: 'Track the branch',
    body: 'Branch names become task context, so active work stays tied to the code path you are billing against.',
  },
  {
    id: 'commit-links',
    title: 'Show the proof',
    body: 'Commit messages, pull requests, and links can appear with sessions and invoices, giving clients a clear path from hours to shipped work.',
  },
];

export const mercuryCallout: LandingSection = {
  id: 'mercury-callout',
  eyebrow: 'Mercury Workflow',
  title: 'Mercury-ready billing without hiding the review step.',
  body: [
    'Hosted users can save a Mercury production API key server-side, use it through Time2Pay API routes, and create Mercury invoices that are payable with the click of a button from tracked sessions.',
    'Bank context, customer contact sync, recipients, and money movement workflows sit near the invoice flow so payment operations are easier to review.',
  ],
  ctas: [
    { label: 'Sign Up Through Time2Pay', href: MERCURY_REFERRAL_URL, kind: 'primary' },
    { label: 'Start Hosted for $1/month', href: '/profile', kind: 'primary' },
    { label: 'Self-Host for Free', href: TIME2PAY_GITHUB_URL, kind: 'secondary' },
  ],
};

export const mercuryBullets: LandingBullet[] = [
  {
    id: 'secure-key',
    title: 'Secure hosted key storage',
    body: 'Production Mercury keys are saved for signed-in hosted users through server-side credential routes, not pasted into local invoice data.',
  },
  {
    id: 'drafts',
    title: 'Mercury invoices',
    body: 'Create the local Time2Pay invoice and a Mercury invoice that is payable with the click of a button, then review destination account, line items, and delivery before sending.',
  },
  {
    id: 'bank-context',
    title: 'Bank context nearby',
    body: 'View Mercury account context and customer contact data beside billing work so the money side is not detached from the invoice.',
  },
  {
    id: 'payments',
    title: 'Payment workflows',
    body: 'Recipient-aware Mercury workflows keep send-money actions close to the same operating workspace used for client billing.',
  },
];

export const pricingSection: LandingSection = {
  id: 'pricing',
  eyebrow: 'Pricing',
  title: '$1/month, $10 lifetime, or free with a successful Mercury referral.',
  body: [
    'Time2Pay keeps the core app self-hostable for operators who want full control. Hosted Time2Pay stays simple: pay $1/month for as long or as little as you need it, or pay a one-time $10 lifetime membership if you are already a Mercury business customer or your referral does not qualify.',
    'Successful Mercury referrals get free lifetime hosted access. If you sign up through Time2Pay but do not complete the required onboarding deposits within the 90-day window, you can still choose the $10 lifetime membership or the $1/month plan.',
  ],
  ctas: [
    { label: 'Start Hosted for $1/month', href: '/profile', kind: 'primary' },
    { label: 'Sign Up Through Time2Pay', href: MERCURY_REFERRAL_URL, kind: 'primary' },
    { label: 'Self-Host for Free', href: TIME2PAY_GITHUB_URL, kind: 'secondary' },
  ],
};

export const pricingBullets: LandingBullet[] = [
  {
    id: 'mercury-lifetime',
    title: 'Free lifetime Mercury offer',
    body: 'Sign up for Mercury through Time2Pay and receive free lifetime hosted access after the referral is verified and qualified.',
    cta: { label: 'Sign Up Through Time2Pay', href: MERCURY_REFERRAL_URL, kind: 'primary' },
  },
  {
    id: 'hosted',
    title: '$1/month hosted',
    body: 'Use hosted Time2Pay for $1/month for as long or as little as you need it when you want managed sign-in, hosted data, and a connected browser workflow.',
    cta: { label: 'Start Hosted for $1/month', href: '/profile', kind: 'primary' },
  },
  {
    id: 'self-host',
    title: 'Self-host free',
    body: 'Use the open-source app from GitHub when you want to run the workflow yourself.',
    cta: { label: 'Self-Host for Free', href: TIME2PAY_GITHUB_URL, kind: 'secondary' },
  },
];

export const ctaSection: LandingSection = {
  id: 'cta',
  eyebrow: 'Get Started',
  title: 'Choose the path that fits your business.',
  body: [],
  ctas: [
    { label: 'Start Hosted for $1/month', href: '/profile', kind: 'primary' },
    { label: 'Sign Up Through Time2Pay', href: MERCURY_REFERRAL_URL, kind: 'primary' },
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
