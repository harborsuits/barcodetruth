import { Link } from 'react-router-dom';
import { MapPin, ArrowRight } from 'lucide-react';
import { PublicHero } from '@/components/public-home/PublicHero';
import { HowItWorksThreeStep } from '@/components/public-home/HowItWorksThreeStep';
import { PublicFAQ } from '@/components/public-home/PublicFAQ';
import { PublicFooter } from '@/components/public-home/PublicFooter';
import { NextShop } from '@/components/public-home/NextShop';
import { LocalShopping } from '@/components/scan/LocalShopping';
import { useShoppingLens } from '@/hooks/useShoppingLens';

export default function PublicHome() {
  const [, setReason] = useShoppingLens();
  return <div className="min-h-screen bg-background text-slate-100">
    <main className="max-w-2xl mx-auto px-4 sm:px-6">
      <PublicHero />
      <NextShop />
      <HowItWorksThreeStep />
      <section className="rounded-2xl border bg-card p-5 space-y-2" aria-labelledby="compare-example">
        <h2 id="compare-example" className="text-lg font-semibold">Would a different brand make a difference?</h2>
        <p className="text-sm text-slate-300">See who owns Bigelow and Twinings, and compare two English Breakfast teas.</p>
        <Link to="/compare/english-breakfast-tea" onClick={() => setReason('ownership')} className="inline-flex items-center gap-2 text-sm text-teal-200 underline underline-offset-4 pt-2">Compare the two teas<ArrowRight className="h-4 w-4" /></Link>
      </section>
      <details id="local-shopping" className="group rounded-2xl border bg-card p-5 mt-4 scroll-mt-20">
        <summary className="cursor-pointer list-none flex gap-3 items-center"><MapPin className="h-5 w-5 text-teal-200 shrink-0" /><span className="flex-1"><span className="block font-semibold">Prefer a farm or market?</span><span className="block text-sm text-slate-300 mt-1">Find places to shop in your area.</span></span><ArrowRight className="h-4 w-4 group-open:rotate-90 transition-transform" /></summary>
        <div className="mt-5 border-t pt-5"><LocalShopping /></div>
      </details>
      <PublicFAQ />
      <p className="text-xs text-slate-400 pb-4 leading-relaxed">Starting with food and drinks. Sources, dates and coverage limits are shown with the information. <Link to="/why-trust-us" className="underline underline-offset-4">How we use sources</Link></p>
    </main>
    <PublicFooter />
  </div>;
}
