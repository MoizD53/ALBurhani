import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, background: '#0a0a0a', color: '#ff6b6b', fontFamily: 'monospace', minHeight: '100vh' }}>
          <h2 style={{ color: '#D4AF37' }}>AL-BURHANI POS Error:</h2>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: 15, background: '#141414', padding: 20, borderRadius: 8, border: '1px solid #333' }}>
            {this.state.error?.stack || this.state.error?.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// Global unhandled error hook
window.addEventListener('error', (e) => {
  console.error('Global window error:', e.error || e.message);
});

// Register Service Worker for PWA with automatic safe update flow
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  let isRefreshing = false;

  // Reload page when new service worker takes control (prevent infinite reload)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!isRefreshing) {
      isRefreshing = true;
      console.log('[PWA] New service worker took control. Reloading to display latest version...');
      window.location.reload();
    }
  });

  window.addEventListener('load', () => {
    const swPath = new URL('sw.js', window.location.href).href;
    navigator.serviceWorker
      .register(swPath, { updateViaCache: 'none' })
      .then((registration) => {
        console.log('[PWA] Service Worker registered with scope:', registration.scope);

        // If an updated worker is already waiting, trigger its activation
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        // Listen for new service worker being discovered
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New update available, activate it immediately
                console.log('[PWA] New update installed; activating...');
                installingWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          }
        });

        // Promptly check for updates on startup
        registration.update().catch(() => {});

        // Re-check for updates whenever user returns to the app window
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            registration.update().catch(() => {});
          }
        });
      })
      .catch((err) => {
        console.warn('[PWA] Service Worker registration failed:', err);
      });
  });
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
