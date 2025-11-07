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

/**
 * Get health dashboard data
 * Fetches current health score, trending, recent checks, top issues, and recent fixes
 */
export async function getHealthDashboard() {
  try {
    const { data, error } = await supabase.rpc('get_health_dashboard');
    
    if (error) {
      console.error('Failed to fetch health dashboard:', error);
      return null;
    }
    
    return data;
  } catch (err) {
    console.error('Failed to get health dashboard:', err);
    return null;
  }
}

/**
 * Trigger manual health check
 * Admin only - requires authentication
 */
export async function triggerHealthCheck() {
  try {
    const { data, error } = await supabase.functions.invoke('daily-health-check');
    
    if (error) {
      console.error('Health check failed:', error);
      return null;
    }
    
    return data;
  } catch (err) {
    console.error('Failed to trigger health check:', err);
    return null;
  }
}

/**
 * Get recent health check results
 */
export async function getRecentHealthChecks(limit: number = 10) {
  try {
    const { data, error } = await supabase
      .from('health_check_results')
      .select('*')
      .order('checked_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Failed to fetch health checks:', error);
      return null;
    }
    
    return data;
  } catch (err) {
    console.error('Failed to get recent health checks:', err);
    return null;
  }
}

/**
 * Get data quality metrics
 */
export async function getDataQualityMetrics(metricName?: string) {
  try {
    let query = supabase
      .from('data_quality_metrics')
      .select('*')
      .order('checked_at', { ascending: false });
    
    if (metricName) {
      query = query.eq('metric_name', metricName);
    }
    
    const { data, error } = await query.limit(50);
    
    if (error) {
      console.error('Failed to fetch quality metrics:', error);
      return null;
    }
    
    return data;
  } catch (err) {
    console.error('Failed to get quality metrics:', err);
    return null;
  }
}

/**
 * Get recent auto-fix logs
 */
export async function getAutoFixLogs(days: number = 7) {
  try {
    const { data, error } = await supabase
      .from('data_quality_log')
      .select('*')
      .gte('timestamp', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .like('action', 'auto_%')
      .order('timestamp', { ascending: false })
      .limit(50);
    
    if (error) {
      console.error('Failed to fetch auto-fix logs:', error);
      return null;
    }
    
    return data;
  } catch (err) {
    console.error('Failed to get auto-fix logs:', err);
    return null;
  }
}
