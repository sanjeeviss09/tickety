import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    // If it's a dynamic import failure due to stale chunk hashes, force a clean reload
    if (
      error.message?.includes('dynamically imported module') ||
      error.message?.includes('Failed to fetch dynamically imported module') ||
      error.message?.includes('Loading chunk')
    ) {
      console.warn('Stale module chunk detected, reloading window...');
      window.location.reload();
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold tracking-tight mb-2">Something went wrong</h2>
          <p className="text-sm text-muted-foreground max-w-md mb-4">
            An unexpected error occurred while rendering this page.
          </p>
          {this.state.error?.message && (
            <div className="w-full max-w-md bg-muted/50 border rounded-md p-3 mb-6 text-left text-xs font-mono text-muted-foreground overflow-auto max-h-32">
              {this.state.error.message}
            </div>
          )}
          <div className="flex items-center gap-3">
            <Button variant="default" size="sm" onClick={this.handleReset} className="gap-1.5">
              <RefreshCw className="h-4 w-4" />
              Reload Page
            </Button>
            <Button variant="outline" size="sm" onClick={() => (window.location.href = '/')} className="gap-1.5">
              <Home className="h-4 w-4" />
              Go to Home
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
