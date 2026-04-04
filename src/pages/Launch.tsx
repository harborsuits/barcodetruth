import { LaunchHero } from "@/components/launch/LaunchHero";
import { LaunchHowItWorks } from "@/components/launch/LaunchHowItWorks";
import { LaunchScreenshots } from "@/components/launch/LaunchScreenshots";
import { LaunchJourney } from "@/components/launch/LaunchJourney";
import { LaunchDifferent } from "@/components/launch/LaunchDifferent";
import { LaunchAudience } from "@/components/launch/LaunchAudience";
import { LaunchFAQ } from "@/components/launch/LaunchFAQ";
import { LaunchCTA } from "@/components/launch/LaunchCTA";
import { LaunchFooter } from "@/components/launch/LaunchFooter";

export default function Launch() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LaunchHero />
      <LaunchHowItWorks />
      <LaunchScreenshots />
      <LaunchJourney />
      <LaunchDifferent />
      <LaunchAudience />
      <LaunchFAQ />
      <LaunchCTA />
      <LaunchFooter />
    </div>
  );
}
