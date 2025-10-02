import { supabase } from "@/integrations/supabase/client";

export async function searchBrands(q: string) {
  if (!q.trim()) return [];
  
  // prefix and contains for a little fuzz
  const { data, error } = await supabase
    .from('brands')
    .select('id,name,parent_company')
    .or(`name.ilike.${q}%,name.ilike.%${q}%`)
    .limit(20);
  
  if (error) throw error;
  return data || [];
}
