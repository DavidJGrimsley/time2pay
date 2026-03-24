import Head from 'expo-router/head';

export function NoIndexSeoHead() {
  return (
    <Head>
      <meta name="robots" content="noindex,nofollow" />
    </Head>
  );
}
