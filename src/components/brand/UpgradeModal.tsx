import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Zap } from "lucide-react";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
}

export function UpgradeModal({ open, onClose }: UpgradeModalProps) {
  const handleUpgrade = () => {
    // Navigate to pricing/subscription page
    window.location.href = "/settings?tab=subscription";
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Upgrade to Continue Scanning
          </DialogTitle>
          <DialogDescription>
            You've used your free Deep Scans this month
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-semibold mb-1">Free Plan</h4>
                <p className="text-sm text-muted-foreground">2 Deep Scans per month</p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg border-2 border-primary bg-primary/5">
            <div className="flex items-start gap-3">
              <Zap className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-semibold mb-1">Supporter Plan</h4>
                <p className="text-sm text-muted-foreground mb-2">10 Deep Scans per month</p>
                <p className="text-sm font-medium">+ All premium features</p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-semibold mb-1">Pro Plan</h4>
                <p className="text-sm text-muted-foreground mb-2">Unlimited Deep Scans</p>
                <p className="text-sm font-medium">+ Priority support</p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button onClick={onClose} variant="outline" className="w-full sm:w-auto">
            Not Now
          </Button>
          <Button onClick={handleUpgrade} className="w-full sm:w-auto">
            View Plans
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
