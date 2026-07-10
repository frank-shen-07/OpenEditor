import { useState } from "react";
import { useAuth } from "../context/AuthContext";

type AuthMode = "login" | "register";

export function AuthPanel() {
  const {
    user,
    loading,
    authAvailable,
    loginWithEmail,
    registerWithEmail,
    loginWithGoogle,
    logout,
  } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!authAvailable) return null;

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setError(null);
  };

  const close = () => {
    setOpen(false);
    resetForm();
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "login") await loginWithEmail(email, password);
      else await registerWithEmail(email, password);
      close();
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

  if (loading) {
    return <span className="auth-status muted">…</span>;
  }

  if (user) {
    return (
      <div className="auth-panel">
        <span className="auth-user mono">{user.displayName}</span>
        <button className="btn btn-sm" type="button" onClick={() => logout()}>
          Log out
        </button>
      </div>
    );
  }

  return (
    <div className="auth-panel">
      {open ? (
        <div className="auth-form card card-compact">
          <div className="auth-form-header">
            <div className="yaml-mode-tabs">
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
            <button className="btn btn-icon btn-sm" type="button" onClick={close} aria-label="Close">
              ✕
            </button>
          </div>

          <button
            className="btn btn-sm auth-oauth-btn"
            type="button"
            disabled={submitting}
            onClick={handleGoogle}
          >
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
          <div className="auth-form-actions">
            <button
              className="btn btn-execute btn-sm"
              type="button"
              disabled={submitting}
              onClick={submit}
            >
              {mode === "login" ? "Log in" : "Create account"}
            </button>
            <button className="btn btn-cancel btn-sm" type="button" onClick={close}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button className="btn authorize btn-sm" type="button" onClick={() => setOpen(true)}>
          Log in
        </button>
      )}
    </div>
  );
}
