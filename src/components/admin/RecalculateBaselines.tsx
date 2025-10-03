import { Button } from "@/components/ui/button";
import { Calculator } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useEffect } from "react";

interface RecalculateBaselinesProps {
  brandId?: string;
  mode?: "single" | "batch";
}

export function RecalculateBaselines({ brandId, mode = "single" }: RecalculateBaselinesProps) {
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (rateLimitedUntil && rateLimitedUntil > Date.now()) {
      const timer = setInterval(() => {
        if (Date.now() >= rateLimitedUntil) {
          setRateLimitedUntil(null);
        }
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [rateLimitedUntil]);

  const checkAdminStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    setIsAdmin(!!data);
  };

  const handleRecalculate = async () => {
    if (rateLimitedUntil && rateLimitedUntil > Date.now()) {
      const secondsLeft = Math.ceil((rateLimitedUntil - Date.now()) / 1000);
      toast.error(`Rate limited. Try again in ${secondsLeft}s`);
      return;
    }

    setLoading(true);
    try {
      // Verify user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to recalculate baselines");
        return;
      }

      const payload = mode === "batch" ? { mode: "batch" } : { brandId };
      
      const { data, error } = await supabase.functions.invoke("calculate-baselines", {
        body: payload,
      });

      if (error) {
        // Check for rate limit error
        if (error.message?.includes('Rate limit') || error.message?.includes('429')) {
          setRateLimitedUntil(Date.now() + 60000); // 60 seconds
          toast.error("Rate limit exceeded. Try again in 60 seconds");
          return;
        }
        throw error;
      }

      toast.success(
        mode === "batch" 
          ? `Recalculated ${data.processed} brands${data.anomalies > 0 ? ` (${data.anomalies} anomalies detected)` : ''}` 
          : "Brand baseline recalculated"
      );
    } catch (error: any) {
      console.error("Recalculation error:", error);
      toast.error(error.message || "Failed to recalculate baselines");
    } finally {
      setLoading(false);
    }
  };

  // Don't render if not admin
  if (!isAdmin) return null;

  const secondsLeft = rateLimitedUntil ? Math.ceil((rateLimitedUntil - Date.now()) / 1000) : 0;
  const isRateLimited = rateLimitedUntil && rateLimitedUntil > Date.now();

  return (
    <Button
      onClick={handleRecalculate}
      disabled={loading || isRateLimited}
      variant="outline"
      size="sm"
    >
      <Calculator className="mr-2 h-4 w-4" />
      {loading 
        ? "Calculating..." 
        : isRateLimited 
        ? `Wait ${secondsLeft}s`
        : mode === "batch" 
        ? "Recalculate All" 
        : "Recalculate"}
    </Button>
  );
}
