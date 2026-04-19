import { useState } from "react";
import { Sparkles, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  brandId?: string | null;
  brandName?: string | null;
  barcode?: string | null;
  className?: string;
}

/**
 * Single CTA shown on weak/baseline brand results. Writes to coverage_requests
 * via the `request_brand_coverage` RPC and bumps brand_enrichment_queue.
 */
export function RequestCoverageCTA({ brandId, brandName, barcode, className }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleClick = async () => {
    if (submitting || done) return;
    setSubmitting(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        toast.error("Sign in to request priority coverage");
        setSubmitting(false);
        return;
      }
      const { error } = await supabase.rpc("request_brand_coverage", {
        p_brand_id: brandId ?? null,
        p_brand_name: brandName ?? null,
        p_barcode: barcode ?? null,
        p_reason: "user_requested_from_scan_result",
      });
      if (error) throw error;
      setDone(true);
      toast.success("Got it — we'll prioritize this brand.");
    } catch (e: any) {
      console.error("request_brand_coverage failed", e);
      toast.error("Couldn't submit just now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={submitting || done}
      variant={done ? "secondary" : "default"}
      className={className}
    >
      {done ? (
        <>
          <Check className="h-4 w-4 mr-2" /> Added to priority queue
        </>
      ) : submitting ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Requesting…
        </>
      ) : (
        <>
          <Sparkles className="h-4 w-4 mr-2" /> Request priority coverage
        </>
      )}
    </Button>
  );
}
