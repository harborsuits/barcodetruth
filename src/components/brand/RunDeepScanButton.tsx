import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DeepScanModal } from "./DeepScanModal";
import { UpgradeModal } from "./UpgradeModal";

interface RunDeepScanButtonProps {
  brandId: string;
  disabled?: boolean;
  onScanComplete?: () => void;
}

export function RunDeepScanButton({ brandId, disabled, onScanComplete }: RunDeepScanButtonProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanId, setScanId] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const { toast } = useToast();

  const handleStartScan = async () => {
    try {
      setIsScanning(true);

      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        toast({
          title: "Sign in required",
          description: "Please sign in to run a deep scan",
          variant: "destructive"
        });
        setIsScanning(false);
        return;
      }

      // Create payment session first
      const { data: paymentData, error: paymentError } = await supabase.functions.invoke(
        "create-deep-scan-payment",
        { body: { brand_id: brandId } }
      );

      if (paymentError) throw paymentError;

      // Open Stripe checkout in new tab
      if (paymentData?.url) {
        window.open(paymentData.url, '_blank');
        toast({
          title: "Payment required",
          description: "Complete payment to run deep scan ($5)",
        });
      }

      setIsScanning(false);
    } catch (error) {
      console.error("Error starting scan payment:", error);
      toast({
        title: "Error",
        description: "Failed to initialize payment",
        variant: "destructive"
      });
      setIsScanning(false);
    }
  };

  const handleScanComplete = () => {
    setIsScanning(false);
    setScanId(null);
    if (onScanComplete) {
      onScanComplete();
    }
  };

  return (
    <>
      <Button
        onClick={handleStartScan}
        disabled={disabled || isScanning}
        className="w-full gap-2"
        variant="default"
      >
        <Sparkles className="h-4 w-4" />
        {isScanning ? "Opening payment..." : "Run Deep Scan ($5)"}
      </Button>
      <p className="text-xs text-muted-foreground text-center mt-2">
        One-time payment • Instant investigation
      </p>

      {scanId && (
        <DeepScanModal
          scanId={scanId}
          brandId={brandId}
          open={!!scanId}
          onClose={handleScanComplete}
        />
      )}

      <UpgradeModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
      />
    </>
  );
}
