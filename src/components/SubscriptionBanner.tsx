import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Crown } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";

export function SubscriptionBanner() {
  const { subscribed, loading, startCheckout, subscription_end } = useSubscription();

  // Hide banner if subscribed and period hasn't ended
  const isActive = subscribed && (!subscription_end || new Date(subscription_end) > new Date());
  
  if (loading || isActive) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 p-6 mb-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <Crown className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Subscribe for Full Access</h3>
            <p className="text-muted-foreground text-sm">
              Get unlimited brand scans with a monthly subscription
            </p>
          </div>
        </div>
        <Button onClick={() => startCheckout()} size="lg" className="gap-2">
          <Crown className="h-4 w-4" />
          Subscribe Monthly
        </Button>
      </div>
    </Card>
  );
}
