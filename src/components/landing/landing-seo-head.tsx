import Head from 'expo-router/head';
import { DAVID_GRIMSLEY_PORTFOLIO_URL, SITE_ORIGIN } from '../../content/landing-content';

const LANDING_TITLE = 'Time2Pay | Self-Hosted Time Tracking by David J. Grimsley';
const LANDING_DESCRIPTION =
  'Time2Pay is a local-first time tracking and invoicing app for freelancers who want self-hosted control over the workflow.';
const LANDING_URL = `${SITE_ORIGIN}/`;

export function LandingSeoHead() {
  return (
    <Head>
      <title>{LANDING_TITLE}</title>
      <meta name="description" content={LANDING_DESCRIPTION} />
      <meta name="author" content="David J. Grimsley" />
      <meta name="robots" content="index,follow" />
      <meta property="og:title" content={LANDING_TITLE} />
      <meta property="og:description" content={LANDING_DESCRIPTION} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={LANDING_URL} />
      <meta property="og:site_name" content="Time2Pay" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={LANDING_TITLE} />
      <meta name="twitter:description" content={LANDING_DESCRIPTION} />
      <link rel="canonical" href={LANDING_URL} />
      <link rel="author" href={DAVID_GRIMSLEY_PORTFOLIO_URL} />
      <link rel="me" href={DAVID_GRIMSLEY_PORTFOLIO_URL} />
    </Head>
  );
}
