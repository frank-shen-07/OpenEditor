import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "react-router-dom";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("OpenEditor crashed:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="page error-page">
          <div className="wrapper">
            <h1>Something went wrong</h1>
            <p className="muted">{this.state.error.message}</p>
            <div className="landing-cta">
              <button
                className="btn btn-execute"
                type="button"
                onClick={() => window.location.reload()}
              >
                Reload
              </button>
              <Link className="btn" to="/">
                Go home
              </Link>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
