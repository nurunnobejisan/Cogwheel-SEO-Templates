"use client";

import { useCallback, useEffect, useState } from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { getAuthClient, isAuthConfigured } from "@/lib/auth-client";

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  configured: boolean;
}

export function useAuth(): AuthState & {
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
} {
  const configured = isAuthConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(configured);

  useEffect(() => {
    if (!configured) return;
    const client = getAuthClient();
    if (!client) {
      setLoading(false);
      return;
    }

    type GetSessionResult = { data: { session: Session | null } };
    client.auth.getSession().then((result: GetSessionResult) => {
      setSession(result.data.session);
      setUser(result.data.session?.user ?? null);
      setLoading(false);
    });

    const { data: listener } = client.auth.onAuthStateChange(
      (_event: AuthChangeEvent, s: Session | null) => {
        setSession(s);
        setUser(s?.user ?? null);
      },
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [configured]);

  const signInWithGoogle = useCallback(async () => {
    const client = getAuthClient();
    if (!client) return;
    await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  }, []);

  const signOut = useCallback(async () => {
    const client = getAuthClient();
    if (!client) return;
    await client.auth.signOut();
    setUser(null);
    setSession(null);
  }, []);

  return { user, session, loading, configured, signInWithGoogle, signOut };
}
