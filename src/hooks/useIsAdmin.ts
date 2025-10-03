import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const inflightRef = useRef(false);
  const mountedRef = useRef(true);

  const checkAdminRole = useCallback(async () => {
    if (inflightRef.current) return;
    inflightRef.current = true;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mountedRef.current) return;
      if (!user) return setIsAdmin(false);

      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!mountedRef.current) return;
      setIsAdmin(!!role);
    } finally {
      inflightRef.current = false;
    }
  }, []);
  
  useEffect(() => {
    mountedRef.current = true;
    checkAdminRole();
    
    // React to auth changes (account switching, logout, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAdminRole();
    });
    
    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [checkAdminRole]);
  
  return isAdmin; // null = loading, false = not admin, true = admin
}
