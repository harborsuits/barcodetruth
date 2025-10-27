import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Zap, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ScanLimitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scansRemaining: number;
  resetDate?: Date;
}

export function ScanLimitModal({ open, onOpenChange, scansRemaining, resetDate }: ScanLimitModalProps) {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    navigate("/settings?tab=subscription");
    onOpenChange(false);
  };

  const daysUntilReset = resetDate 
    ? Math.ceil((resetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 30;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="rounded-full bg-primary/10 p-4">
              <Lock className="h-8 w-8 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-center text-2xl">
            You've reached your scan limit
          </DialogTitle>
          <DialogDescription className="text-center space-y-4 pt-4">
            <div className="text-base">
              You've used all <strong>{scansRemaining + 5}/5 free scans</strong> this month.
            </div>
            
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Resets in {daysUntilReset} days</span>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 mt-4">
              <div className="flex items-start gap-3">
                <Zap className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="text-left space-y-2">
                  <p className="font-semibold text-foreground">Upgrade for unlimited scans</p>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Unlimited product scans</li>
                    <li>• Real-time score updates</li>
                    <li>• Priority support</li>
                    <li>• Advanced analytics</li>
                  </ul>
                </div>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-col gap-2">
          <Button onClick={handleUpgrade} className="w-full" size="lg">
            Upgrade to Pro
          </Button>
          <Button 
            onClick={() => onOpenChange(false)} 
            variant="ghost" 
            className="w-full"
          >
            Maybe later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
