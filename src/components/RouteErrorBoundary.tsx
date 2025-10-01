import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { hasError: boolean; message?: string };

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(err: unknown): State {
    return { 
      hasError: true, 
      message: err instanceof Error ? err.message : String(err) 
    };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="p-6 space-y-3">
          <h2 className="text-lg font-semibold">Something went wrong</h2>
          <p className="text-sm text-muted-foreground">{this.state.message}</p>
          <Button
            onClick={() => (location.href = location.href)}
          >
            Reload
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
