import { Component, ErrorInfo, ReactNode } from 'react';
import { safeConsoleError } from '@/utils/safe-logging';
interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class SSRErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    safeConsoleError('[💥 SSR ERROR BOUNDARY CAUGHT]', error);
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[💥 SSR ERROR DETAILS]', '[REDACTED ERROR OBJECT - Check for sensitive data]');
    
    this.setState({ error, errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      // SECURITY: Only show detailed error information in development
      const isDevelopment = import.meta.env.DEV;

      return (
        <div style={{ padding: 32, backgroundColor: '#fee', border: '1px solid #f00' }}>
          <h1>🔥 Something went wrong</h1>
          <p>We're sorry, but an unexpected error occurred. Please try refreshing the page.</p>
          <p><strong>Environment:</strong> {typeof window === 'undefined' ? 'SSR' : 'Client'}</p>

          {isDevelopment && (
            <details style={{ marginTop: 16 }}>
              <summary>Development Error Details</summary>
              <p><strong>Error:</strong> {this.state.error?.message}</p>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}>
                {this.state.error?.stack}
              </pre>
              {this.state.errorInfo && (
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}>
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default SSRErrorBoundary;