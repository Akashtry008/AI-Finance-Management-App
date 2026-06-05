import React from 'react';
import { AlertOctagon } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-card glass-panel">
            <AlertOctagon size={48} className="text-danger" style={{ marginBottom: '1rem' }} />
            <h2>Oops, something went wrong.</h2>
            <p className="text-muted">An unexpected error occurred in the application.</p>
            <div className="error-details">
              <code>{this.state.error?.toString()}</code>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              style={{ marginTop: '1.5rem' }}
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
