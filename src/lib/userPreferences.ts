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

export async function getUserPreferences() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  } catch {
    return null;
  }
}

export async function updateUserValues(values: {
  value_labor: number;
  value_environment: number;
  value_politics: number;
  value_social: number;
  value_political_intensity?: number;
  value_political_alignment?: number;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    console.log('Saving values for user:', user.id, values);
    
    const { data, error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: user.id,
        ...values,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })
      .select();
    
    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }
    
    console.log('Values saved successfully:', data);
    return true;
  } catch (err) {
    console.error('Failed to update values:', err);
    return false;
  }
}

export async function updateUserPreferences(preferences: {
  exclude_same_parent?: boolean;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const { error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: user.id,
        ...preferences,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
    
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Failed to update preferences:', err);
    return false;
  }
}
