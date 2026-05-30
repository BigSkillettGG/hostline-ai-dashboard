import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * When this value changes, the boundary resets its error state. Pass the
   * route path so navigating away from a broken page clears the error.
   */
  resetKey?: string | number;
  /** Short label for the area that failed, e.g. "page" or "dashboard". */
  scopeLabel?: string;
  /** Optional custom fallback renderer. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render-time errors in its subtree and shows a recovery UI instead of
 * letting the whole app white-screen. Place one at the app root (catch-all) and
 * one around route content (so a single broken page keeps the chrome alive).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    // Auto-reset when the reset key changes (e.g. route navigation) so the user
    // is not stuck on the error screen after moving to a different page.
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Caught render error", error, info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    const scope = this.props.scopeLabel ?? "page";

    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center p-6">
        <Card className="w-full max-w-md border-destructive/20">
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <CardTitle className="text-lg">Something went wrong</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This {scope} ran into an unexpected error. Your data is safe — you can try again or
              reload the app.
            </p>
            {error.message ? (
              <p className="rounded-md bg-muted px-3 py-2 font-mono text-xs text-muted-foreground break-words">
                {error.message}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button onClick={this.reset} size="sm" className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </Button>
              <Button onClick={() => window.location.reload()} variant="outline" size="sm">
                Reload app
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}

export default ErrorBoundary;
