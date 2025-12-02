import { Component, ErrorInfo, ReactNode } from 'react';

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
    console.error('[💥 SSR ERROR BOUNDARY CAUGHT]', error);
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[💥 SSR ERROR DETAILS]', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      isSSR: typeof window === 'undefined'
    });
    
    this.setState({ error, errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, backgroundColor: '#fee', border: '1px solid #f00' }}>
          <h1>🔥 Error Boundary Caught an Error</h1>
          <p><strong>Error:</strong> {this.state.error?.message}</p>
          <p><strong>Environment:</strong> {typeof window === 'undefined' ? 'SSR' : 'Client'}</p>
          <details style={{ marginTop: 16 }}>
            <summary>Error Details</summary>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}>
              {this.state.error?.stack}
            </pre>
            {this.state.errorInfo && (
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}>
                {this.state.errorInfo.componentStack}
              </pre>
            )}
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

export default SSRErrorBoundary;