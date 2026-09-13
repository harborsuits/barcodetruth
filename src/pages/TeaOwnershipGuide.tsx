import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useShoppingLens } from '@/hooks/useShoppingLens';
import { shoppingReasons } from '@/lib/shoppingLens';

const records = {
  bigelow: {
    name: 'Bigelow Tea',
    owner: 'Bigelow family',
    relationship: 'Family ownership, according to the company',
    summary: 'Bigelow says the business remains entirely owned and operated by the Bigelow family. The reviewed source does not disclose each family member’s stake or a complete legal holding structure.',
    source: 'https://www.bigelowtea.com/pages/our-story',
    sourceName: 'Bigelow: Our story',
    product: 'Bigelow English Breakfast Black Tea',
    productSource: 'https://www.bigelowtea.com/products/english-breakfast-black-tea',
  },
  twinings: {
    name: 'Twinings',
    owner: 'Associated British Foods group',
    relationship: 'Corporate group',
    summary: 'Associated British Foods lists Twinings in its grocery portfolio and records acquiring it in 1964. This establishes the group relationship; the intervening legal entities are not mapped here.',
    source: 'https://www.abf.co.uk/our-businesses/food/grocery',
    sourceName: 'ABF: Grocery businesses',
    product: 'Twinings English Breakfast',
    productSource: 'https://twiningsusa.com/products/english-breakfast',
  },
};
type TeaBrand = keyof typeof records;

function OwnershipCard({ brand }: { brand: TeaBrand }) {
  const record = records[brand];
  return <Card><CardContent className="pt-6 space-y-3">
    <h2 className="text-xl font-semibold">{record.name}</h2>
    <p className="text-xs text-muted-foreground">{record.relationship}</p>
    <p className="text-lg font-semibold text-primary">{record.owner}</p>
    <p className="text-sm text-muted-foreground leading-relaxed">{record.summary}</p>
    <a className="block text-sm underline" href={record.source} target="_blank" rel="noopener noreferrer">{record.sourceName}</a>
    {brand === 'twinings' && <div className="border-t pt-3 space-y-2 text-sm text-muted-foreground">
      <a className="block underline" href="https://www.abf.co.uk/about-us/our-history" target="_blank" rel="noopener noreferrer">ABF history: the 1964 acquisition</a>
      <p>ABF is publicly listed. Wittington Investments is a shareholder of ABF, a separate relationship from the Twinings group connection.</p>
      <a className="block underline" href="https://www.abf.co.uk/investors/shareholder-information" target="_blank" rel="noopener noreferrer">ABF shareholder information</a>
      <p>ABF announced a proposed retail and food demerger. Its September 10, 2026 update expects completion in December 2027; this is a future plan.</p>
      <a className="block underline" href="https://www.abf.co.uk/media/news/2026/trading-update-september-2026" target="_blank" rel="noopener noreferrer">ABF: September 10, 2026 update</a>
    </div>}
    <Link className="block text-sm underline" to={`/ownership/${brand}`}>Ownership page</Link>
  </CardContent></Card>;
}

export default function TeaOwnershipGuide() {
  const { guide } = useParams<{ guide: string }>();
  const [currentBrand, setCurrentBrand] = useState<TeaBrand>('twinings');
  const [reason, setReason] = useShoppingLens();
  const selectedGuide = guide === 'bigelow' || guide === 'twinings' ? guide : null;
  const alternative: TeaBrand = currentBrand === 'twinings' ? 'bigelow' : 'twinings';
  if (guide && !selectedGuide) return <main className="max-w-2xl mx-auto p-6"><h1 className="text-xl font-semibold">Ownership guide unavailable</h1><Link to="/compare/english-breakfast-tea" className="underline">See the tea comparison</Link></main>;
  return <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-widest text-primary">A sourced shopping comparison</p>
      <h1 className="font-display text-3xl sm:text-4xl font-bold">{selectedGuide ? `Who owns ${records[selectedGuide].name}?` : 'English Breakfast tea. Different ownership.'}</h1>
      <p className="text-muted-foreground">Sources checked September 12, 2026. Company sources describe different parts of the ownership picture.</p>
    </div>
    {selectedGuide ? <>
      <OwnershipCard brand={selectedGuide} />
      <Button asChild><Link to="/compare/english-breakfast-tea">Compare the two tea brands</Link></Button>
    </> : <>
      {reason !== 'ownership' && <div className="rounded-xl border border-amber-200/20 bg-amber-200/5 p-4 space-y-2"><p className="text-sm">You chose “{shoppingReasons.find(item => item.id === reason)?.label}”. This guide only establishes a difference in ownership; a match for your selected reason has not been checked.</p><Button variant="outline" size="sm" onClick={() => setReason('ownership')}>Compare ownership instead</Button></div>}
      <section className="border rounded-xl p-5 space-y-4" aria-labelledby="preference-heading">
        <h2 id="preference-heading" className="text-lg font-semibold">I want a tea from a different ownership group</h2>
        <p className="text-sm text-muted-foreground">Choose the brand you currently buy:</p>
        <div className="flex flex-wrap gap-2">
          {(['twinings','bigelow'] as const).map(brand => <Button key={brand} variant={currentBrand === brand ? 'default' : 'outline'} aria-pressed={currentBrand === brand} onClick={() => setCurrentBrand(brand)}>{records[brand].name}</Button>)}
        </div>
        <div className="space-y-2" aria-live="polite">
          <p className="font-semibold">An option to compare: {records[alternative].product}</p>
          <p className="text-sm text-muted-foreground">Both official product pages describe English Breakfast black tea in tea bags. Their ownership groups differ according to the sources below.</p>
          <a className="block text-sm underline" href={records[alternative].productSource} target="_blank" rel="noopener noreferrer">Check the alternative’s official product details</a>
          <a className="block text-sm underline" href={records[currentBrand].productSource} target="_blank" rel="noopener noreferrer">Check your current product’s official details</a>
        </div>
      </section>
      <div className="grid md:grid-cols-2 gap-4"><OwnershipCard brand="twinings" /><OwnershipCard brand="bigelow" /></div>
    </>}
    <section className="border-t pt-5 space-y-2">
      <h2 className="font-semibold">What this comparison establishes</h2>
      <p className="text-sm text-muted-foreground">The sources support a similar product category and different ownership groups. Ownership alone does not establish better labor, environmental, political, or social performance. Check the actual label for your dietary needs and preferred blend. Store availability, equivalent pricing, and package barcodes have not been verified.</p>
      <p className="text-sm text-muted-foreground">This researched guide is separate from the automated barcode catalog. It does not claim that a scan of either package has been verified.</p>
    </section>
    <Link to="/" className="inline-block text-sm underline">Back to search</Link>
  </main>;
}
