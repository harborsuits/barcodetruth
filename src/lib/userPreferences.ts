import { supabase } from "@/integrations/supabase/client";

export async function getExcludeSameParent(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return true; // Default to true if not logged in
    
    const { data } = await supabase
      .from('user_preferences')
      .select('exclude_same_parent')
      .eq('user_id', user.id)
      .maybeSingle();
    
    return data?.exclude_same_parent ?? true;
  } catch {
    return true;
  }
}
