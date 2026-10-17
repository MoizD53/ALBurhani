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
          <h2 style={{ color: '#D4AF37' }}>AL-BHURANI POS Error:</h2>
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

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
