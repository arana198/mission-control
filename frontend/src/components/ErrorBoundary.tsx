'use client';

import React, { ReactNode, Component, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Error Boundary component to catch and display errors gracefully
 * Prevents entire app from crashing due to component errors
 *
 * NOTE: Uses inline styles instead of CSS tokens because this component renders
 * when the CSS may not be properly loaded. This is intentional and should not be refactored.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const componentName = this.props.componentName ? ` in ${this.props.componentName}` : '';
    console.error(`🔴 Error Boundary caught${componentName}:`, error);
    console.error('Component stack:', errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div style={{
            padding: '20px',
            color: 'red',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '4px',
            margin: '20px',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}>
            <h1 style={{ marginTop: 0, color: '#856404' }}>⚠️ Something Went Wrong</h1>
            <p style={{ color: '#856404', marginBottom: '10px' }}>
              An error occurred while rendering this page. Check the browser console for details.
            </p>
            <details style={{ whiteSpace: 'pre-wrap', color: '#666' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Error Details</summary>
              <code style={{ display: 'block', marginTop: '10px', padding: '10px', backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', overflow: 'auto' }}>
                {this.state.error?.toString()}
                {'\n\n'}
                {this.state.error?.stack}
              </code>
            </details>
            <p style={{ marginBottom: 0, marginTop: '15px' }}>
              <button onClick={() => window.location.reload()} style={{
                padding: '8px 16px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}>
                Reload Page
              </button>
            </p>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
