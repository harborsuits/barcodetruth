import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Home } from "./Home";
import PublicHome from "./PublicHome";
import { RouteFallback } from "@/components/RouteFallback";

/**
 * Auth-aware homepage router:
 * - Logged-out visitors: see PublicHome (decision-engine marketing)
 * - Logged-in users: see Home (in-app dashboard with bottom nav)
 */
export default function HomeRouter() {
  const [state, setState] = useState<"loading" | "public" | "private">("loading");

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setState(session?.user ? "private" : "public");
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setState(session?.user ? "private" : "public");
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (state === "loading") return <RouteFallback label="Loading…" />;
  if (state === "private") return <Home />;
  return <PublicHome />;
}
