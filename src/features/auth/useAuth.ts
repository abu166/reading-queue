import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { QueryClient } from "@tanstack/react-query";
import { configured, supabase } from "../../lib/supabase";
export function useAuth(cache: QueryClient) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(configured);
  const [recovery, setRecovery] = useState(false);
  const [expired, setExpired] = useState(false);
  const account = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!configured) return;
    // INITIAL_SESSION is emitted after SDK storage/callback initialization.
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (account.current !== next?.user.id) {
        cache.clear();
        if (account.current && !next) setExpired(true);
        account.current = next?.user.id;
      }
      if (next) setExpired(false);
      setSession(next);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, [cache]);
  return {
    session,
    loading,
    recovery,
    expired,
    completeRecovery: () => setRecovery(false),
  };
}
