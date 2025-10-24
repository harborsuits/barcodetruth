import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ScanLimit {
  can_scan: boolean;
  is_subscribed: boolean;
  scans_remaining: number;
  scans_used: number;
  loading: boolean;
}

export function useScanLimit() {
  const [limit, setLimit] = useState<ScanLimit>({
    can_scan: true,
    is_subscribed: false,
    scans_remaining: 5,
    scans_used: 0,
    loading: true,
  });

  const checkLimit = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // Anonymous users get 5 free scans
        const anonScans = localStorage.getItem('anon_scans_used');
        const scansUsed = anonScans ? parseInt(anonScans, 10) : 0;
        const scansRemaining = Math.max(0, 5 - scansUsed);
        
        setLimit({
          can_scan: scansRemaining > 0,
          is_subscribed: false,
          scans_remaining: scansRemaining,
          scans_used: scansUsed,
          loading: false,
        });
        return;
      }

      // Check if user is admin - admins have unlimited scans
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (role) {
        setLimit({
          can_scan: true,
          is_subscribed: true,
          scans_remaining: 999999,
          scans_used: 0,
          loading: false,
        });
        return;
      }

      const { data, error } = await supabase.rpc('can_user_scan', {
        p_user_id: user.id
      });

      if (error) throw error;

      const result = data as { 
        can_scan: boolean; 
        is_subscribed: boolean; 
        scans_remaining: number; 
        scans_used: number; 
      };

      setLimit({
        can_scan: result?.can_scan ?? false,
        is_subscribed: result?.is_subscribed ?? false,
        scans_remaining: result?.scans_remaining ?? 0,
        scans_used: result?.scans_used ?? 0,
        loading: false,
      });
    } catch (error) {
      console.error('Error checking scan limit:', error);
      setLimit(prev => ({ ...prev, loading: false }));
    }
  };

  const trackScan = async (brandId?: string, barcode?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // Track anonymous scans in localStorage
        const anonScans = localStorage.getItem('anon_scans_used');
        const scansUsed = anonScans ? parseInt(anonScans, 10) : 0;
        localStorage.setItem('anon_scans_used', String(scansUsed + 1));
        await checkLimit();
        return;
      }

      await supabase.from('user_scans').insert({
        user_id: user.id,
        brand_id: brandId,
        barcode: barcode,
      });

      // Refresh limit after tracking
      await checkLimit();
    } catch (error) {
      console.error('Error tracking scan:', error);
    }
  };

  useEffect(() => {
    checkLimit();

    // Refresh limit on auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkLimit();
    });

    return () => subscription.unsubscribe();
  }, []);

  return { ...limit, checkLimit, trackScan };
}
