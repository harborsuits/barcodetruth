import { supabase } from "@/integrations/supabase/client";

/**
 * Manually refresh coverage view
 * Admin only function - uses existing admin_refresh_coverage RPC
 */
export async function refreshCoverageView() {
  try {
    const { error } = await supabase.rpc('admin_refresh_coverage');
    
    if (error) {
      console.error('Coverage refresh failed:', error);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('Failed to refresh coverage:', err);
    return false;
  }
}

/**
 * Verify user account integrity
 * Returns true if user has complete setup (profile + preferences)
 */
export async function verifyUserAccountIntegrity(userId: string): Promise<{
  has_profile: boolean;
  has_preferences: boolean;
  is_complete: boolean;
}> {
  try {
    // Check profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    
    // Check preferences
    const { data: prefs } = await supabase
      .from('user_preferences')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();
    
    const has_profile = !!profile;
    const has_preferences = !!prefs;
    
    return {
      has_profile,
      has_preferences,
      is_complete: has_profile && has_preferences,
    };
  } catch (err) {
    console.error('Failed to verify user account:', err);
    return {
      has_profile: false,
      has_preferences: false,
      is_complete: false,
    };
  }
}

/**
 * Initialize user preferences with defaults if missing
 */
export async function ensureUserPreferences(userId: string) {
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: userId,
        value_labor: 50,
        value_environment: 50,
        value_politics: 50,
        value_social: 50,
        muted_categories: [],
        notification_mode: 'instant',
        digest_time: '18:00',
        exclude_same_parent: true,
        updated_at: new Date().toISOString(),
      }, { 
        onConflict: 'user_id',
        ignoreDuplicates: true 
      })
      .select()
      .single();
    
    if (error && error.code !== '23505') { // Ignore duplicate key errors
      console.error('Failed to ensure preferences:', error);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('Failed to ensure user preferences:', err);
    return false;
  }
}
