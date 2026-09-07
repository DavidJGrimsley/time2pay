import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const PWA_BOOTSTRAP_SCRIPT = `
(function bootstrapTime2PayPwa() {
  if (!(typeof window !== 'undefined' && typeof document !== 'undefined')) {
    return;
  }

  var hostname = window.location.hostname || '';
  if (/\\.plesk\\.page$/i.test(hostname)) {
    return;
  }

  var manifestLink = document.createElement('link');
  manifestLink.rel = 'manifest';
  manifestLink.href = '/manifest.json';
  document.head.appendChild(manifestLink);
})();
`;

const CRITICAL_BACKGROUND_CSS = `
html,
body,
#root {
  min-height: 100%;
  background: #f8f7f3;
}

body {
  margin: 0;
}

html.dark,
html.dark body,
html.dark #root {
  background: #1a1f16;
  color-scheme: dark;
}

html.light,
html.light body,
html.light #root {
  background: #f8f7f3;
  color-scheme: light;
}

@media (prefers-color-scheme: dark) {
  html:not(.light):not(.dark),
  html:not(.light):not(.dark) body,
  html:not(.light):not(.dark) #root {
    background: #1a1f16;
    color-scheme: dark;
  }
}
`;

const APPEARANCE_BOOTSTRAP_SCRIPT = `
(function applyTime2PayAppearance() {
  try {
    var stored = null;
    try {
      stored = window.localStorage.getItem('time2pay.settings.appearance-preference');
    } catch (error) {}
    var theme = stored === 'light' || stored === 'dark' ? stored : null;
    if (!theme) {
      theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }
    var root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    root.style.colorScheme = theme;
    root.style.background = theme === 'dark' ? '#1a1f16' : '#f8f7f3';
  } catch (error) {}
})();
`;

export default function RootHtml({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#1a1f16" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Time2Pay" />
        <style dangerouslySetInnerHTML={{ __html: CRITICAL_BACKGROUND_CSS }} />
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_BOOTSTRAP_SCRIPT }} />
        <script src="/__time2pay_runtime_config__" />
        <script dangerouslySetInnerHTML={{ __html: PWA_BOOTSTRAP_SCRIPT }} />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <ScrollViewStyleReset />
      </head>
      <body>
        {children}
        <script defer src="/service-worker-register.js" />
      </body>
    </html>
  );
}
