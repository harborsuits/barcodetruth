import { PublicHero } from "@/components/public-home/PublicHero";
import { HowItWorksThreeStep } from "@/components/public-home/HowItWorksThreeStep";
import { TrustStrip } from "@/components/public-home/TrustStrip";
import { InstallCTA } from "@/components/public-home/InstallCTA";
import { PublicFAQ } from "@/components/public-home/PublicFAQ";
import { PublicFooter } from "@/components/public-home/PublicFooter";
import { Link } from 'react-router-dom';

export default function PublicHome() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="max-w-5xl mx-auto px-4 sm:px-6">
        <PublicHero />
        <section className="rounded-xl border border-border bg-card p-6 space-y-2" aria-labelledby="coverage-title">
          <h2 id="coverage-title" className="text-lg font-semibold">Start with packaged food and drinks</h2>
          <p className="text-sm text-muted-foreground">This is our first coverage focus. Some products have a brand record but no confirmed owner, and many categories do not yet have a supported alternative. Check the sources and dates on the record before relying on it.</p>
          <Link className="inline-block pt-2 text-sm text-primary underline" to="/compare/english-breakfast-tea">See a sourced comparison: Bigelow and Twinings tea</Link>
        </section>
        <HowItWorksThreeStep />
        <TrustStrip />
        <InstallCTA />
        <PublicFAQ />
      </main>
      <PublicFooter />
    </div>
  );
}
