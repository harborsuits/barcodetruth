import { Button } from "@/components/ui/button";
import { Calculator } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

interface RecalculateBaselinesProps {
  brandId?: string;
  mode?: "single" | "batch";
}

export function RecalculateBaselines({ brandId, mode = "single" }: RecalculateBaselinesProps) {
  const [loading, setLoading] = useState(false);

  const handleRecalculate = async () => {
    setLoading(true);
    try {
      const payload = mode === "batch" ? { mode: "batch" } : { brandId };
      
      const { data, error } = await supabase.functions.invoke("calculate-baselines", {
        body: payload,
      });

      if (error) throw error;

      toast.success(
        mode === "batch" 
          ? `Recalculated ${data.processed} brands` 
          : "Brand baseline recalculated"
      );
    } catch (error: any) {
      console.error("Recalculation error:", error);
      toast.error(error.message || "Failed to recalculate baselines");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleRecalculate}
      disabled={loading}
      variant="outline"
      size="sm"
    >
      <Calculator className="mr-2 h-4 w-4" />
      {loading ? "Calculating..." : mode === "batch" ? "Recalculate All" : "Recalculate"}
    </Button>
  );
}
