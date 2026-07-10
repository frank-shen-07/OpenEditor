import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "../lib/supabase";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  authAvailable: boolean;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toAuthUser(user: User): AuthUser {
  const meta = user.user_metadata ?? {};
  const displayName =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    user.email?.split("@")[0] ||
    "User";

  return {
    id: user.id,
    email: user.email ?? "",
    displayName,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(supabaseConfigured);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ? toAuthUser(data.session.user) : null);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? toAuthUser(session.user) : null);
      setLoading(false);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error("Supabase is not configured");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const registerWithEmail = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error("Supabase is not configured");
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }, []);

  const loginWithGoogle = useCallback(async () => {
    if (!supabase) throw new Error("Supabase is not configured");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
  }, []);

  const logout = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      authAvailable: supabaseConfigured,
      loginWithEmail,
      registerWithEmail,
      loginWithGoogle,
      logout,
    }),
    [user, loading, loginWithEmail, registerWithEmail, loginWithGoogle, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
