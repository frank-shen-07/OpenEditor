import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { clearOAuthHashFromUrl } from "../lib/authCallback";

/** Handles the Supabase OAuth redirect and sends the user to the editor. */
export function AuthCallbackPage() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (user) clearOAuthHashFromUrl();
  }, [user]);

  if (loading) {
    return (
      <div className="page-loading">
        <span className="muted">Signing you in…</span>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/app" replace />;
  }

  return <Navigate to="/auth" replace />;
}
