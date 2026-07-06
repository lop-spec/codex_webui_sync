import * as React from 'react';
import { legacyShellHtml } from '@/legacy-shell';

const LEGACY_SCRIPT_SOURCES = [
  '/js/app.js?v=react-parity-20260705',
  '/js/transfer.js?v=react-parity-20260705'
];
const LEGACY_STYLESHEET_HREF = '/css/app.css?v=react-parity-20260705';

declare global {
  interface Window {
    __codexReactLegacyBooted?: boolean;
  }
}

export function App() {
  React.useEffect(() => {
    if (!document.querySelector('link[href^="/css/app.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEGACY_STYLESHEET_HREF;
      document.head.appendChild(link);
    }
    if (window.__codexReactLegacyBooted) return;
    window.__codexReactLegacyBooted = true;
    for (const src of LEGACY_SCRIPT_SOURCES) {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.dataset.codexReactLegacy = 'true';
      document.body.appendChild(script);
    }
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: legacyShellHtml }} />;
}
