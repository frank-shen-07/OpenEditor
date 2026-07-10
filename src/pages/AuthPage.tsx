import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Logo, ThemeToggle } from "../components/Chrome";
import { GoogleIcon } from "../components/ui";
import { useTheme } from "../hooks/useTheme";

type AuthMode = "login" | "register";

export function AuthPage() {
  const {
    user,
    loading,
    authAvailable,
    loginWithEmail,
    registerWithEmail,
    loginWithGoogle,
  } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get("mode") === "register" ? "register" : "login";

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (!loading && user) {
      navigate("/app", { replace: true });
    }
  }, [loading, user, navigate]);

  if (!authAvailable) {
    return <Navigate to="/app" replace />;
  }

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "login") await loginWithEmail(email, password);
      else await registerWithEmail(email, password);
      navigate("/app", { replace: true });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await loginWithGoogle();
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <div className="page auth-page">
      <header className="page-header">
        <div className="wrapper page-header-inner">
          <Logo />
          <div className="page-header-actions">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <Link className="btn" to="/">
              Back
            </Link>
          </div>
        </div>
      </header>

      <main className="auth-page-main">
        <div className="auth-page-card card">
          <h1 className="auth-page-title">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="auth-page-subtitle muted">
            {mode === "login"
              ? "Log in to access your saved API specs."
              : "Sign up to save and sync your OpenAPI documents."}
          </p>

          <div className="yaml-mode-tabs auth-page-tabs">
            <button
              type="button"
              className={`yaml-mode-tab${mode === "login" ? " is-active" : ""}`}
              onClick={() => {
                setMode("login");
                setError(null);
              }}
            >
              Log in
            </button>
            <button
              type="button"
              className={`yaml-mode-tab${mode === "register" ? " is-active" : ""}`}
              onClick={() => {
                setMode("register");
                setError(null);
              }}
            >
              Register
            </button>
          </div>

          <button
            className="btn auth-oauth-btn"
            type="button"
            disabled={submitting || loading}
            onClick={handleGoogle}
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="auth-divider">
            <span>or</span>
          </div>

          <label className="field">
            <span className="field-label">Email</span>
            <input
              className="input mono"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <input
              className="input mono"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
          </label>

          {error && <div className="auth-error">{error}</div>}

          <button
            className="btn btn-execute auth-page-submit"
            type="button"
            disabled={submitting || loading}
            onClick={submit}
          >
            {mode === "login" ? "Log in" : "Create account"}
          </button>
        </div>
      </main>
    </div>
  );
}
