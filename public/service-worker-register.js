(function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  // During local Expo dev server sessions there is usually no generated /sw.js.
  if (window.location.hostname === 'localhost' && window.location.port === '8081') {
    return;
  }

  let refreshing = false;

  window.addEventListener('load', async function onLoad() {
    try {
      const scriptResponse = await fetch('/sw.js', {
        method: 'HEAD',
        cache: 'no-store',
      });

      if (!scriptResponse.ok) {
        return;
      }

      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      navigator.serviceWorker.addEventListener('controllerchange', function onControllerChange() {
        if (refreshing) {
          return;
        }
        refreshing = true;
        window.location.reload();
      });

      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      registration.addEventListener('updatefound', function onUpdateFound() {
        const installingWorker = registration.installing;
        if (!installingWorker) {
          return;
        }

        installingWorker.addEventListener('statechange', function onStateChange() {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            installingWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
    } catch (error) {
      console.error('Service worker registration failed:', error);
    }
  });
})();
