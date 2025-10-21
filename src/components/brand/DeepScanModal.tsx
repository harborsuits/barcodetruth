import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DeepScanModalProps {
  scanId: string;
  brandId: string;
  open: boolean;
  onClose: () => void;
}

interface ScanStatus {
  status: "queued" | "running" | "success" | "error";
  result_count: number;
  error_message?: string;
}

export function DeepScanModal({ scanId, brandId, open, onClose }: DeepScanModalProps) {
  const [status, setStatus] = useState<ScanStatus>({ status: "queued", result_count: 0 });
  const { toast } = useToast();

  useEffect(() => {
    if (!open || !scanId) return;

    const pollStatus = async () => {
      try {
        const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deep-scan-status`);
        url.searchParams.set('scan_id', scanId);

        const { data: session } = await supabase.auth.getSession();
        
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.session?.access_token}`,
            'Content-Type': 'application/json',
          }
        });

        if (!response.ok) throw new Error('Failed to fetch status');

        const data = await response.json();

        setStatus({
          status: data.status,
          result_count: data.result_count || 0,
          error_message: data.error_message
        });

        // Stop polling on terminal states
        if (data.status === "success" || data.status === "error") {
          if (data.status === "success") {
            toast({
              title: "Scan complete",
              description: `Found ${data.result_count} new article${data.result_count !== 1 ? 's' : ''}`,
            });
            
            // Auto-close after showing success
            setTimeout(() => {
              onClose();
            }, 3000);
          }
        }
      } catch (error) {
        console.error("Error polling scan status:", error);
        setStatus({ status: "error", result_count: 0, error_message: String(error) });
      }
    };

    // Poll immediately then every 2 seconds
    pollStatus();
    const interval = setInterval(pollStatus, 2000);

    return () => clearInterval(interval);
  }, [scanId, open, onClose, toast]);

  const getStatusDisplay = () => {
    switch (status.status) {
      case "queued":
        return {
          icon: <Loader2 className="h-12 w-12 animate-spin text-primary" />,
          title: "Queued",
          description: "Preparing to scan..."
        };
      case "running":
        return {
          icon: <Sparkles className="h-12 w-12 animate-pulse text-primary" />,
          title: "Scanning",
          description: "Collecting fresh news articles..."
        };
      case "success":
        return {
          icon: <CheckCircle2 className="h-12 w-12 text-green-600" />,
          title: "Complete",
          description: status.result_count === 0
            ? "No new articles found in the last 90 days"
            : `Found ${status.result_count} new article${status.result_count !== 1 ? 's' : ''}`
        };
      case "error":
        return {
          icon: <XCircle className="h-12 w-12 text-destructive" />,
          title: "Scan failed",
          description: "Something went wrong. Please try again."
        };
    }
  };

  const display = getStatusDisplay();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Deep Scan</DialogTitle>
          <DialogDescription className="text-center">
            Instant investigation in progress
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          {display.icon}
          <div className="text-center space-y-2">
            <h3 className="font-semibold text-lg">{display.title}</h3>
            <p className="text-sm text-muted-foreground">{display.description}</p>
          </div>

          {status.status === "error" && status.error_message && (
            <p className="text-xs text-destructive mt-2 max-w-sm text-center">
              {status.error_message}
            </p>
          )}
        </div>

        {status.status === "success" && status.result_count > 0 && (
          <div className="flex justify-center">
            <Button onClick={onClose} variant="default">
              View Results
            </Button>
          </div>
        )}

        {status.status === "error" && (
          <div className="flex justify-center gap-2">
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
            <Button onClick={onClose}>
              Report Issue
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
