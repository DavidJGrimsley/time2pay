const DEFAULT_SITE_ORIGIN = 'https://time2pay.app';
const LOCAL_DATABASE_HEADERS = {
  'Cross-Origin-Embedder-Policy': 'credentialless',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

function resolveSiteOrigin() {
  const explicitOrigin = process.env.EXPO_PUBLIC_SITE_ORIGIN?.trim();

  return explicitOrigin || DEFAULT_SITE_ORIGIN;
}

function isHostedDataMode() {
  return process.env.EXPO_PUBLIC_TIME2PAY_DATA_MODE?.trim().toLowerCase() === 'hosted';
}

function withExpoRouterOptions(plugins, origin) {
  return (plugins || []).map((plugin) => {
    if (!Array.isArray(plugin) || plugin[0] !== 'expo-router') {
      return plugin;
    }

    const [, options = {}] = plugin;
    const nextOptions = { ...options, origin };

    // Stripe embedded Checkout does not support cross-origin-isolated pages.
    // Local/self-hosted mode adds these headers because expo-sqlite needs them on web.
    nextOptions.headers = isHostedDataMode() ? undefined : LOCAL_DATABASE_HEADERS;
    if (!nextOptions.headers) delete nextOptions.headers;

    return ['expo-router', nextOptions];
  });
}

module.exports = ({ config }) => ({
  ...config,
  plugins: withExpoRouterOptions(config.plugins, resolveSiteOrigin()),
});
