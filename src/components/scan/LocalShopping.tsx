import { useState } from 'react';
import { MapPin, ArrowUpRight, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Manually reviewed business sources. These are discovery listings, not inventory
// feeds or claimed substitutes for the scanned SKU. No sponsored listings exist.
const farms = [
  { name: 'Beth’s Farm Market', town: 'Warren, Maine', description: 'The farm’s site describes a market with seasonal fruit, vegetables and greens.', url: 'https://www.bethsfarmmarket.com/' },
  { name: 'Spear Spring Farm', town: 'Warren, Maine', description: 'The farm’s site describes vegetables and a seasonal store featuring its products and other Maine producers.', url: 'https://www.spearspringfarm.com/' },
];

export function LocalShopping() {
  const [area, setArea] = useState('');
  return <section className="space-y-5" aria-labelledby="local-shopping-title">
    <div className="space-y-2">
      <h3 id="local-shopping-title" className="text-xl font-bold">Find farms and markets</h3>
      <p className="text-sm text-slate-300 leading-relaxed">Enter an area to look for places selling fresh produce. Check stock and opening hours before you go.</p>
    </div>
    <div className="space-y-2">
      <label htmlFor="local-area" className="text-sm font-medium">Town and state, or ZIP code</label>
      <Input id="local-area" value={area} onChange={event => setArea(event.target.value)} maxLength={100} placeholder="e.g. Warren, Maine" className="rounded-lg h-12" />
      <Button asChild={!!area.trim()} disabled={!area.trim()} variant="outline" className="w-full rounded-lg h-11">
        {area.trim() ? <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`farm stands farmers markets near ${area.trim()}`)}`} target="_blank" rel="noopener noreferrer"><MapPin className="h-4 w-4 mr-2" />Search Google Maps<ArrowUpRight className="h-4 w-4 ml-2" /></a> : <span>Enter an area above</span>}
      </Button>
      <p className="text-xs text-slate-400">Your search area is sent to Google Maps when you open the link. Device location is not used.</p>
    </div>
    <details className="space-y-3 border-t border-border pt-4">
      <summary className="font-semibold cursor-pointer">Two examples in Warren, Maine</summary><p className="text-xs text-slate-400">Business listings, not nearby matches. Current stock is unknown. Neither listing is sponsored.</p>
      {farms.map(farm => <article key={farm.name} className="rounded-xl border border-border bg-background/50 p-4 space-y-2">
        <div className="flex gap-2 items-center"><Store className="h-4 w-4 text-teal-200" /><h5 className="font-semibold">{farm.name}</h5></div>
        <p className="text-xs text-teal-200">{farm.town}</p>
        <p className="text-sm text-slate-300">{farm.description}</p>
        <a className="inline-flex items-center gap-1 text-sm underline underline-offset-4" href={farm.url} target="_blank" rel="noopener noreferrer">Visit the farm’s website<ArrowUpRight className="h-3 w-3" /></a>
        <p className="text-xs text-slate-400">Source reviewed September 13, 2026 · current stock unconfirmed</p>
      </article>)}
      <a href="https://realmaine.com/members/" target="_blank" rel="noopener noreferrer" className="block text-sm underline underline-offset-4">Explore more producers in the Real Maine directory</a>
    </details>
  </section>;
}
