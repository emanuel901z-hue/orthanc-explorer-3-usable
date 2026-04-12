import { Component, type ReactNode } from "react";
import { OrthancError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Props {
  children: ReactNode;
}

interface State {
  caught: { message: string; correlationId?: string } | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { caught: null };

  static getDerivedStateFromError(error: unknown): State {
    if (error instanceof OrthancError) {
      return { caught: { message: error.message, correlationId: error.correlationId } };
    }
    return { caught: { message: "An unexpected error occurred." } };
  }

  componentDidCatch(error: unknown): void {
    if (error instanceof OrthancError) {
      logger.error("ui.error", {
        correlationId: error.correlationId,
        status: error.status,
      });
    } else {
      logger.error("ui.error", {});
    }
  }

  render() {
    if (this.state.caught) {
      return (
        <div className="flex flex-col items-center justify-center h-screen gap-4">
          <p className="text-destructive font-semibold">{this.state.caught.message}</p>
          {this.state.caught.correlationId && (
            <p className="text-muted-foreground text-xs">
              Reference: {this.state.caught.correlationId}
            </p>
          )}
          <button
            className="text-sm underline"
            onClick={() => this.setState({ caught: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
