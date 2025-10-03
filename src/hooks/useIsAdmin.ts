import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  
  let inflight = false;
  const checkAdminRole = async () => {
    if (inflight) return;
    inflight = true;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setIsAdmin(false);
      
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      
      setIsAdmin(!!role);
    } finally {
      inflight = false;
    }
  };
  
  useEffect(() => {
    checkAdminRole();
    
    // React to auth changes (account switching, logout, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAdminRole();
    });
    
    return () => subscription.unsubscribe();
  }, []);
  
  return isAdmin; // null = loading, false = not admin, true = admin
}
