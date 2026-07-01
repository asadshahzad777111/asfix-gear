import { Component } from 'react';

/**
 * Root-level safety net. Without this, ANY uncaught render error anywhere in
 * the tree (a bad property access, a missing translation key, a null
 * reference in a newly added component, etc.) unmounts the entire React app
 * and leaves the visitor staring at a blank white page — this has been the
 * #1 recurring bug report for this site. Catching it here means a single
 * broken widget shows a friendly recovery screen instead of taking down the
 * whole site, and the real error still gets logged to the console for
 * debugging.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Unhandled render error:', error, info?.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const isDev = import.meta.env?.DEV;

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center',
          background: '#0f172a',
          color: '#f8fafc',
          fontFamily: 'Segoe UI, Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
        <h1 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>Kuch masla ho gaya / Something went wrong</h1>
        <p style={{ color: '#94a3b8', maxWidth: 420, marginBottom: '1.5rem' }}>
          Yeh page load nahi ho saka. Please neeche button dabayein aur dobara try karein — agar masla rahe to hamein
          Contact page se batayein.
        </p>
        <button
          type="button"
          onClick={this.handleReload}
          style={{
            padding: '0.75rem 1.75rem',
            borderRadius: '999px',
            border: 'none',
            background: '#ff6b2c',
            color: '#fff',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: 'pointer',
          }}
        >
          🔄 Home par wapas jayein
        </button>
        {isDev && this.state.error && (
          <pre
            style={{
              marginTop: '2rem',
              maxWidth: '90vw',
              overflow: 'auto',
              textAlign: 'left',
              background: 'rgba(0,0,0,0.4)',
              padding: '1rem',
              borderRadius: '8px',
              fontSize: '0.75rem',
              color: '#fca5a5',
            }}
          >
            {String(this.state.error?.stack || this.state.error)}
          </pre>
        )}
      </div>
    );
  }
}
