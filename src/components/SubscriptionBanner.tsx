import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Crown, Scan } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useScanLimit } from "@/hooks/useScanLimit";

export function SubscriptionBanner() {
  const { subscribed, loading: subLoading, startCheckout, subscription_end } = useSubscription();
  const { scans_remaining, scans_used, loading: limitLoading, is_subscribed } = useScanLimit();

  // Hide banner if subscribed and period hasn't ended
  const isActive = subscribed && (!subscription_end || new Date(subscription_end) > new Date());
  
  if (subLoading || limitLoading) return null;

  // Show upgrade prompt if free user (authenticated or anonymous with low scans)
  if (!isActive && scans_remaining <= 2) {
    return (
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 p-6 mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <Crown className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">
                {scans_remaining === 0 ? 'Out of Free Scans' : 'Almost Out of Free Scans'}
              </h3>
              <p className="text-muted-foreground text-sm">
                {is_subscribed 
                  ? `You've used ${scans_used} of 5 free scans this month. Subscribe for unlimited access.`
                  : `You have ${scans_remaining} free scan${scans_remaining === 1 ? '' : 's'} remaining. Sign up for unlimited access!`
                }
              </p>
            </div>
          </div>
          <Button onClick={() => startCheckout()} size="lg" className="gap-2">
            <Crown className="h-4 w-4" />
            {is_subscribed ? '$5/month' : 'Sign Up Free'}
          </Button>
        </div>
      </Card>
    );
  }

  return null;
}
