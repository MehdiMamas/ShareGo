import { Component, type ErrorInfo, type ReactNode } from "react";
import { colors } from "../styles/theme";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("uncaught error:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            background: colors.background,
            gap: 16,
            padding: 32,
          }}
        >
          <p style={{ color: colors.error, fontSize: 16, fontWeight: 600 }}>
            something went wrong
          </p>
          <p
            style={{
              color: colors.textSecondary,
              fontSize: 13,
              textAlign: "center",
              maxWidth: 360,
            }}
          >
            {this.state.error?.message ?? "unknown error"}
          </p>
          <button
            onClick={this.handleReset}
            style={{
              padding: "10px 24px",
              borderRadius: 8,
              background: colors.primary,
              color: colors.textPrimary,
              fontSize: 14,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
            }}
          >
            try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
