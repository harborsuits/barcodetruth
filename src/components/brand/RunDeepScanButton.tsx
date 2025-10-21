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

      const { data, error } = await supabase.functions.invoke("deep-scan-start", {
        body: { brand_id: brandId }
      });

      // Some responses may return 200 with allowed=false; treat non-200 as error only
      if (error && (data == null || data.allowed === undefined)) throw error;

      if (!data.allowed) {
        if (data.reason === "quota_exceeded") {
          setShowUpgrade(true);
        } else if (data.reason === "cooldown") {
          toast({
            title: "Please wait",
            description: data.message || "You can scan this brand again in a few hours",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Scan unavailable",
            description: "Unable to start scan. Please try again later.",
            variant: "destructive"
          });
        }
        setIsScanning(false);
        return;
      }

      setScanId(data.scan_id);
    } catch (error) {
      console.error("Error starting scan:", error);
      toast({
        title: "Error",
        description: "Failed to start deep scan",
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
        {isScanning ? "Scanning..." : "Run Deep Scan"}
      </Button>
      <p className="text-xs text-muted-foreground text-center mt-2">
        Check for new verified articles right now
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
