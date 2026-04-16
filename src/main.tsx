
if ('navigator' in window && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for (let registration of registrations) {
      registration.unregister();
    }
  }).catch(function(err) {
    console.log('Service Worker registration failed: ', err);
  });
}

import {StrictMode, Suspense, use} from 'react';
import {createRoot} from 'react-dom/client';
import {LazyMotion, domAnimation} from 'motion/react';
import App from './App.tsx';
import './index.css';

// Dynamic i18n bootstrap — Rollup splits this into its own chunk.
// React 19 `use()` suspends rendering until the i18n module resolves,
// so any component calling `useTranslation` below this boundary is guaranteed
// to see an initialized i18next instance.
const i18nPromise = import('./lib/i18n');

function I18nBootstrap({children}: {children: React.ReactNode}) {
  use(i18nPromise);
  return <>{children}</>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LazyMotion features={domAnimation} strict>
      <Suspense fallback={<div className="flex h-screen items-center justify-center bg-background text-foreground">Loading...</div>}>
        <I18nBootstrap>
          <App />
        </I18nBootstrap>
      </Suspense>
    </LazyMotion>
  </StrictMode>,
);
