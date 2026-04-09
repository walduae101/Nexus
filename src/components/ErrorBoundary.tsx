import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = this.state.error?.message || 'An unexpected error occurred.';
      try {
        const parsed = JSON.parse(errorMessage);
        if (parsed.error) {
          errorMessage = `Firestore Error: ${parsed.error} (Path: ${parsed.path})`;
        }
      } catch (e) {
        // Not a JSON error message
      }

      return (
        <div className="p-4 m-4 border border-red-500 rounded-md bg-red-50 text-red-900">
          <h2 className="text-lg font-bold mb-2">Something went wrong</h2>
          <p className="font-mono text-sm">{errorMessage}</p>
          <button
            className="mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 rounded text-red-800 transition-colors"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
