import { PublicHero } from "@/components/public-home/PublicHero";
import { ExampleStrip } from "@/components/public-home/ExampleStrip";
import { HowItWorksThreeStep } from "@/components/public-home/HowItWorksThreeStep";
import { SampleVerdict } from "@/components/public-home/SampleVerdict";
import { AlternativesPreview } from "@/components/public-home/AlternativesPreview";
import { TrustStrip } from "@/components/public-home/TrustStrip";
import { InstallCTA } from "@/components/public-home/InstallCTA";
import { PublicFAQ } from "@/components/public-home/PublicFAQ";
import { PublicFooter } from "@/components/public-home/PublicFooter";

export default function PublicHome() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="max-w-5xl mx-auto px-4 sm:px-6">
        <PublicHero />
        <ExampleStrip />
        <HowItWorksThreeStep />
        <SampleVerdict />
        <AlternativesPreview />
        <TrustStrip />
        <InstallCTA />
        <PublicFAQ />
      </main>
      <PublicFooter />
    </div>
  );
}
