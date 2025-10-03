import { supabase } from "@/integrations/supabase/client";

export async function searchBrands(q: string) {
  if (!q.trim()) return [];
  
  try {
    const { data, error } = await supabase.functions.invoke('search-brands', {
      body: { q }
    });
    
    if (error) throw error;
    return data?.data || [];
  } catch (error: any) {
    if (error?.message?.includes('rate_limited')) {
      throw new Error('Too many requests. Please wait a moment.');
    }
    throw error;
  }
}
