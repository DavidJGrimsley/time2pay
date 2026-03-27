const DEFAULT_SITE_ORIGIN = 'https://time2pay.app';

function resolveSiteOrigin() {
  const explicitOrigin = process.env.EXPO_PUBLIC_SITE_ORIGIN?.trim();

  return explicitOrigin || DEFAULT_SITE_ORIGIN;
}

function withExpoRouterOrigin(plugins, origin) {
  return (plugins || []).map((plugin) => {
    if (!Array.isArray(plugin) || plugin[0] !== 'expo-router') {
      return plugin;
    }

    const [, options = {}] = plugin;
    return ['expo-router', { ...options, origin }];
  });
}

module.exports = ({ config }) => ({
  ...config,
  plugins: withExpoRouterOrigin(config.plugins, resolveSiteOrigin()),
});
