import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Crown, DollarSign } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";

export function SubscriptionBanner() {
  const { subscribed, loading, startCheckout } = useSubscription();

  if (loading || subscribed) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 p-6 mb-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <Crown className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Choose Your Plan</h3>
            <p className="text-muted-foreground text-sm">
              Pay a deposit or subscribe monthly for unlimited brand scans
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => startCheckout("deposit")} size="lg" variant="outline" className="gap-2">
            <DollarSign className="h-4 w-4" />
            Pay Deposit
          </Button>
          <Button onClick={() => startCheckout("subscription")} size="lg" className="gap-2">
            <Crown className="h-4 w-4" />
            Subscribe Monthly
          </Button>
        </div>
      </div>
    </Card>
  );
}
