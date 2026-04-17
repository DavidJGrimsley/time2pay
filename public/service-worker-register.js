(function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  const hostname = window.location.hostname || '';
  const isLocalhost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]';

  if (/\.plesk\.page$/i.test(window.location.hostname || '')) {
    return;
  }

  // Avoid stale precache issues during any local development or local production testing.
  if (isLocalhost) {
    window.addEventListener('load', function onLocalLoad() {
      navigator.serviceWorker
        .getRegistrations()
        .then(function (registrations) {
          return Promise.all(
            registrations.map(function (registration) {
              return registration.unregister();
            }),
          );
        })
        .catch(function () {
          return undefined;
        });

      if ('caches' in window) {
        window.caches
          .keys()
          .then(function (cacheNames) {
            return Promise.all(
              cacheNames.map(function (cacheName) {
                return window.caches.delete(cacheName);
              }),
            );
          })
          .catch(function () {
            return undefined;
          });
      }
    });
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
