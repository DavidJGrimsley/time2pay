import Head from 'expo-router/head';
import {
  DAVID_GRIMSLEY_PORTFOLIO_URL,
  LANDING_SEO_DESCRIPTION,
  LANDING_SEO_TITLE,
  TIME2PAY_GITHUB_URL,
  TIME2PAY_SOCIAL_IMAGE_PATH,
} from '../../content/landing-content';
import { resolveSiteOrigin } from '@/services/site-origin';

const LANDING_SOCIAL_IMAGE_ALT =
  'Time2Pay – time tracking and invoicing app for freelancers and independent contractors.';

export function buildSoftwareApplicationJsonLd(input: {
  landingUrl: string;
  socialImageUrl: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Time2Pay',
    description: LANDING_SEO_DESCRIPTION,
    url: input.landingUrl,
    image: input.socialImageUrl,
    operatingSystem: 'Web, PWA, iOS, Android',
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Time Tracking, Invoicing',
    author: {
      '@type': 'Person',
      name: 'David J. Grimsley',
      url: DAVID_GRIMSLEY_PORTFOLIO_URL,
    },
    sameAs: [
      TIME2PAY_GITHUB_URL,
      DAVID_GRIMSLEY_PORTFOLIO_URL,
    ],
    offers: {
      '@type': 'Offer',
      price: '2.00',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: input.landingUrl,
    },
  };
}

export function LandingSeoHead() {
  const landingUrl = `${resolveSiteOrigin()}/`;
  const socialImageUrl = `${landingUrl}${TIME2PAY_SOCIAL_IMAGE_PATH.replace(/^\//, '')}`;
  const softwareApplicationJsonLd = buildSoftwareApplicationJsonLd({
    landingUrl,
    socialImageUrl,
  });

  return (
    <Head>
      <title>{LANDING_SEO_TITLE}</title>
      <meta name="description" content={LANDING_SEO_DESCRIPTION} />
      <meta name="keywords" content="time tracking, invoicing app, contractor billing, subcontractor time tracker, clock in software, freelance invoicing, contractor time tracking, invoice software, GitHub invoicing, Mercury payments" />
      <meta name="author" content="David J. Grimsley" />
      <meta name="robots" content="index,follow" />
      <meta property="og:title" content={LANDING_SEO_TITLE} />
      <meta property="og:description" content={LANDING_SEO_DESCRIPTION} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={landingUrl} />
      <meta property="og:site_name" content="Time2Pay" />
      <meta property="og:image" content={socialImageUrl} />
      <meta property="og:image:alt" content={LANDING_SOCIAL_IMAGE_ALT} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={LANDING_SEO_TITLE} />
      <meta name="twitter:description" content={LANDING_SEO_DESCRIPTION} />
      <meta name="twitter:image" content={socialImageUrl} />
      <meta name="twitter:image:alt" content={LANDING_SOCIAL_IMAGE_ALT} />
      <link rel="canonical" href={landingUrl} />
      <link rel="author" href={DAVID_GRIMSLEY_PORTFOLIO_URL} />
      <link rel="me" href={DAVID_GRIMSLEY_PORTFOLIO_URL} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd) }}
      />
    </Head>
  );
}
