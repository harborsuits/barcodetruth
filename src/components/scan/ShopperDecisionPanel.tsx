import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ArrowUpRight, Bookmark, Check, FileText, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useShoppingLens } from '@/hooks/useShoppingLens';
import { alternativeRequirements, findIngredientMention, labelIngredients, mentionsShoppingTopic, parseShopNotes, safeEvidenceUrl, SHOP_NOTES_KEY, shoppingReasons } from '@/lib/shoppingLens';
import { reviewedCompanyActions } from '@/data/reviewedCompanyActions';
import { ShoppingReasonPicker } from './ShoppingReasonPicker';
import { OwnershipReveal } from './OwnershipReveal';
import { LocalShopping } from './LocalShopping';
import { AlternativesSection } from '@/components/brand/AlternativesSection';

export type ShopperProduct = {
  name: string; barcode: string; brandId?: string | null; brandName?: string | null;
  parentCompany?: string | null; metadata?: unknown; dataSource?: string | null; updatedAt?: string | null;
};

export function RecallCheck({ expanded = false }: { expanded?: boolean }) {
  return <section className="rounded-xl border border-amber-200/20 bg-amber-200/5 p-4 space-y-3" aria-label="Product safety check">
    <div className="flex items-start gap-3"><ShieldAlert className="h-5 w-5 text-amber-200 shrink-0 mt-0.5" /><div>
      <h3 className="text-sm font-semibold text-amber-100">Recall status has not been checked for this package</h3>
      <p className="text-xs text-slate-300 mt-1 leading-relaxed">A brand record cannot tell us whether your particular lot is affected.</p>
    </div></div>
    {expanded && <ol className="list-decimal pl-5 text-sm text-slate-300 space-y-2">
      <li>Find the product name, package size and barcode in the official notice.</li>
      <li>Compare the lot code, best-by date and establishment number when the notice specifies them.</li>
      <li>If your package is covered, follow the notice’s instructions.</li>
    </ol>}
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
      <a className="underline underline-offset-4" href="https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts" target="_blank" rel="noopener noreferrer">FDA notices ↗</a>
      <a className="underline underline-offset-4" href="https://www.fsis.usda.gov/recalls" target="_blank" rel="noopener noreferrer">USDA meat, poultry & egg product notices ↗</a>
    </div>
  </section>;
}

function IngredientFacts({ product }: { product: ShopperProduct }) {
  const [term, setTerm] = useState('');
  const ingredients = labelIngredients(product.metadata);
  const finding = findIngredientMention(ingredients, term);
  const isOpenFoodFacts = product.dataSource === 'openfoodfacts';
  const metadata = product.metadata && typeof product.metadata === 'object' ? product.metadata as Record<string, unknown> : {};
  const nutrition = metadata.nutrition && typeof metadata.nutrition === 'object' ? metadata.nutrition as Record<string, unknown> : {};
  const nutrients = [ ['sugars', 'Sugars'], ['salt', 'Salt'], ['saturated-fat', 'Saturated fat'] ].flatMap(([key, label]) => {
    const amount = nutrition[`${key}_100g`];
    return isOpenFoodFacts && typeof amount === 'number' && Number.isFinite(amount) && amount >= 0 && amount <= 100
      ? [{ label, amount }] : [];
  });
  return <div className="space-y-4">
    <div><h3 className="text-xl font-bold">Start with what’s in the package.</h3><p className="text-sm text-slate-300 mt-2">Ingredients and nutrition belong to this product. A company’s political or environmental record does not tell you whether a food meets your needs.</p></div>
    {ingredients ? <>
      <div className="rounded-xl border p-4 space-y-3 bg-background/40">
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-200">Recorded ingredients · check against your label</p>
        <p className="text-sm leading-relaxed">{ingredients}</p>
        <p className="text-xs text-slate-400">{isOpenFoodFacts ? 'Source: Open Food Facts community database.' : 'Original label source has not been verified.'} {product.updatedAt ? `Catalog record updated ${product.updatedAt.slice(0, 10)}.` : ''} This is not a label verification date.</p>
        {isOpenFoodFacts && <a className="block text-sm underline" href={`https://world.openfoodfacts.org/product/${product.barcode}`} target="_blank" rel="noopener noreferrer">Open the source product record ↗</a>}
      </div>
      {!!nutrients.length && <div><p className="text-xs text-slate-400 mb-2">Recorded values per 100 g / 100 ml · confirm the basis on your label</p><dl className="grid grid-cols-3 gap-2">{nutrients.map(nutrient => <div key={nutrient.label} className="rounded-lg bg-background/50 p-3"><dt className="text-xs text-slate-300">{nutrient.label}</dt><dd className="font-semibold mt-1">{Number(nutrient.amount.toFixed(2))} g</dd></div>)}</dl></div>}
      <div className="space-y-2"><label htmlFor="ingredient-term" className="text-sm font-medium">Look for an ingredient in this text</label><Input id="ingredient-term" placeholder="e.g. palm oil" maxLength={80} value={term} onChange={event => setTerm(event.target.value)} className="rounded-lg h-11" />
        {term.trim().length >= 2 && <p className="text-sm rounded-lg bg-muted p-3" role="status">{finding === 'mentioned' ? `“${term.trim()}” appears in the recorded ingredient text.` : `The exact text “${term.trim()}” was not found. This does not establish that the ingredient or allergen is absent.`}</p>}
      </div>
    </> : <div className="rounded-xl border border-dashed p-4 space-y-2"><h4 className="font-semibold">The ingredient label is missing from this record.</h4><p className="text-sm text-slate-300">Use the current package or the manufacturer’s product page. We cannot make a dietary match from the brand name.</p></div>}
    <p className="text-xs text-slate-400 leading-relaxed">Text search does not detect all ingredient names, allergens or cross-contact. Check the current package and manufacturer’s allergen information before relying on a dietary choice.</p>
  </div>;
}

const topics = [
  { id: 'politics', label: 'Political spending', detail: 'Look for the spender, recipient, amount and date. Company spending, a connected PAC and an executive’s personal donations are different records.' },
  { id: 'inclusion', label: 'LGBTQ+ inclusion', detail: 'Look for a specific policy or action, who it applies to, when it happened and any response or change.' },
  { id: 'reproductive', label: 'Reproductive rights', detail: 'Look for documented benefits, policy positions or political spending tied to this issue. A general political label is not enough.' },
  { id: 'religion', label: 'Religious freedom', detail: 'Look for documented policies and actions. A founder’s or employee’s religion does not establish a company’s political position.' },
  { id: 'labor', label: 'Worker treatment', detail: 'Distinguish a worker or union allegation from an agency finding, settlement or company response.' },
  { id: 'environment', label: 'Environmental action', detail: 'Look for documented practices and outcomes. A marketing pledge alone does not establish environmental performance.' },
] as const;

function CompanyActions({ brandId, brandName }: { brandId?: string | null; brandName?: string | null }) {
  const [topic, setTopic] = useState<typeof topics[number]['id']>('politics');
  const selected = topics.find(item => item.id === topic)!;
  const category = topic === 'labor' || topic === 'environment' || topic === 'politics' ? topic : 'social';
  const reviewed = reviewedCompanyActions.filter(item => item.brandId === brandId && item.topic === topic);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['shopper-source-reports-v1', brandId, category], enabled: !!brandId, retry: 1,
    queryFn: async () => {
      const result = await supabase.from('brand_events')
        .select('event_id, title, description, category, event_date, source_url, disputed, company_response_summary, company_response_url')
        .eq('brand_id', brandId!).eq('category', category).eq('is_irrelevant', false).eq('is_test', false)
        .eq('feed_visible', true).is('duplicate_of', null).not('source_url', 'is', null)
        .order('event_date', { ascending: false, nullsFirst: false }).limit(60);
      if (result.error) throw result.error;
      return (result.data || []).filter(item => safeEvidenceUrl(item.source_url));
    },
  });
  const reports = data?.filter(item => mentionsShoppingTopic(`${item.title || ''} ${item.description}`, topic)).slice(0, 4);
  return <div className="space-y-4">
    <div><h3 className="text-xl font-bold">Your values. Specific company actions.</h3><p className="text-sm text-slate-300 mt-2">Choose an issue to examine. You decide what supports your priorities.</p></div>
    <label htmlFor="company-topic" className="block text-sm font-medium">What do you want to look into?</label>
    <select id="company-topic" value={topic} onChange={event => setTopic(event.target.value as typeof topic)} className="w-full rounded-lg bg-background border border-border p-3 text-sm">
      {topics.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
    </select>
    <p className="text-sm text-slate-300 leading-relaxed">{selected.detail}</p>
    {reviewed.map(item => <article key={item.id} className="rounded-xl border border-teal-200/30 bg-teal-200/5 p-4 space-y-3">
      <p className="text-xs text-teal-200">{item.kind} · {item.actor}</p>
      <h4 className="font-semibold">{item.title}</h4><p className="text-sm text-slate-200">{item.detail}</p>
      <p className="text-xs text-slate-300 leading-relaxed">{item.limit}</p>
      <p className="text-xs text-slate-400">{item.period} · source reviewed {item.reviewedAt}</p>
      <a href={item.source} target="_blank" rel="noopener noreferrer" className="block text-sm underline">Read the company’s source ↗</a>
      {item.additionalSource && <a href={item.additionalSource} target="_blank" rel="noopener noreferrer" className="block text-sm underline">{item.additionalLabel} ↗</a>}
    </article>)}
    <div className="border-t pt-4 space-y-3">
      <h4 className="font-semibold">Related reading for {brandName || 'this brand'}</h4>
      <p className="text-xs text-slate-400">Keyword matches in up to 60 recent catalog records. These are leads to inspect; relevance, allegations and findings still need review.</p>
      {!brandId ? <p className="text-sm">No brand is linked to this product yet.</p> : isLoading ? <p className="text-sm" role="status">Loading linked reports…</p> : error ? <div role="alert"><p className="text-sm">Reports could not be loaded.</p><Button variant="outline" size="sm" onClick={() => void refetch()}>Retry reports</Button></div> : !reports?.length ? <p className="text-sm rounded-xl border border-dashed p-4">No additional reports mentioning this topic were found in the records checked. This is not a complete review.</p> : reports.map(item => <article key={item.event_id} className="rounded-xl border bg-background/40 p-4 space-y-2">
        <p className="text-xs text-slate-400">Report date: {item.event_date?.slice(0, 10) || 'not recorded'}{item.disputed ? ' · Disputed record' : ''}</p>
        <p className="text-sm font-medium leading-relaxed">{item.title || item.description}</p>
        <a href={safeEvidenceUrl(item.source_url)!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm underline underline-offset-4">Read {new URL(item.source_url!).hostname.replace(/^www\./, '')}<ArrowUpRight className="h-3 w-3" /></a>
        {item.company_response_summary && <p className="text-xs text-slate-300">Recorded company response: {item.company_response_summary}</p>}
        {safeEvidenceUrl(item.company_response_url) && <a href={safeEvidenceUrl(item.company_response_url)!} target="_blank" rel="noopener noreferrer" className="block text-sm underline">Read the company response</a>}
      </article>)}
    </div>
    <p className="text-xs text-slate-400">Issue selections stay in this page’s memory. They are not saved to an account or used for ad targeting.</p>
  </div>;
}

export function ShopperDecisionPanel({ product }: { product: ShopperProduct }) {
  const [reason, setReason] = useShoppingLens();
  const [saveMessage, setSaveMessage] = useState('');
  const selected = shoppingReasons.find(item => item.id === reason)!;
  const brand = product.brandName?.toLowerCase() || '';
  const teaOwnershipMatch = reason === 'ownership' && ['twinings', 'bigelow', 'bigelow tea'].includes(brand) && /english breakfast/i.test(product.name);
  function saveCheck() {
    try {
      const notes = parseShopNotes(localStorage.getItem(SHOP_NOTES_KEY)).filter(note => note.barcode !== product.barcode);
      localStorage.setItem(SHOP_NOTES_KEY, JSON.stringify([{ barcode: product.barcode, name: product.name.slice(0, 250), reason, savedAt: new Date().toISOString() }, ...notes].slice(0, 30)));
      setSaveMessage('Saved on this device. Find it under “Your next shop” on the home page.');
    } catch { setSaveMessage('This browser could not save the check. Try again with device storage available.'); }
  }
  return <div className="space-y-5">
    <section className="space-y-3" aria-labelledby="shopper-priority">
      <div><p className="text-xs uppercase tracking-widest text-teal-200 mb-2">Make this useful to you</p><h2 id="shopper-priority" className="text-2xl sm:text-3xl font-bold">What would make you switch?</h2><p className="text-sm text-slate-300 mt-2">Start with the reason that matters today.</p></div>
      <ShoppingReasonPicker value={reason} onChange={next => { setReason(next); setSaveMessage(''); }} />
    </section>
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-5" aria-label={selected.label}>
      {reason === 'ownership' && <>
        <div><h3 className="text-xl font-bold">Follow your purchase beyond the label.</h3><p className="text-sm text-slate-300 mt-2">Different brands can share an owner. Check the connection before choosing a different label.</p></div>
        {product.brandId ? <OwnershipReveal brandId={product.brandId} brandName={product.brandName || 'this brand'} parentCompany={product.parentCompany} /> : <p className="text-sm">A confirmed brand and ownership record is not available for this product yet.</p>}
      </>}
      {reason === 'ingredients' && <IngredientFacts key={product.barcode} product={product} />}
      {reason === 'recalls' && <><h3 className="text-xl font-bold">Check your package, not just the brand.</h3><RecallCheck expanded /></>}
      {reason === 'values' && <CompanyActions key={product.brandId || product.barcode} brandId={product.brandId} brandName={product.brandName} />}
      {reason === 'local' && <LocalShopping />}
    </section>
    {reason !== 'recalls' && <RecallCheck />}
    {reason !== 'local' && <section className="rounded-2xl border border-teal-200/20 bg-teal-200/5 p-5 space-y-4" aria-labelledby="switch-heading">
      <div className="flex items-center gap-2 text-teal-100"><ArrowRight className="h-5 w-5" /><h3 id="switch-heading" className="text-lg font-semibold">What to look for instead</h3></div>
      <p className="text-sm text-slate-200">{alternativeRequirements[reason]}</p>
      {teaOwnershipMatch ? <div className="space-y-2"><p className="text-sm font-semibold">Bigelow and Twinings: a sourced ownership comparison</p><p className="text-sm text-slate-300">Both sell English Breakfast tea bags. The reviewed sources identify different ownership groups. Compare the actual pack and blend before buying.</p><Button asChild variant="outline" className="rounded-lg"><Link to="/compare/english-breakfast-tea">Compare the tea options<ArrowRight className="h-4 w-4 ml-2" /></Link></Button></div> : <>
        <p className="text-sm text-slate-300">We do not yet have a checked product alternative for this reason.</p>
        <div className="flex flex-wrap gap-2"><Button asChild variant="outline" className="rounded-lg"><Link to="/search">Look up another product</Link></Button>{reason === 'ownership' && <Button asChild variant="ghost" className="rounded-lg"><Link to="/compare/english-breakfast-tea">See a researched tea example</Link></Button>}</div>
      </>}
      {product.brandId && <details className="border-t border-border pt-3"><summary className="text-sm cursor-pointer">Explore catalog leads · fit still needs checking</summary><div className="mt-3"><AlternativesSection brandId={product.brandId} brandName={product.brandName || 'this brand'} /></div></details>}
    </section>}
    <section className="rounded-xl border border-border p-4 space-y-3">
      <div className="flex gap-3 items-start"><Bookmark className="h-5 w-5 text-teal-200 shrink-0 mt-1" /><div><h3 className="font-semibold">Keep this for your next shop</h3><p className="text-sm text-slate-300 mt-1">Save this product and “{selected.short.toLowerCase()}” to a checklist on this device.</p></div></div>
      <Button variant="outline" className="w-full rounded-lg" onClick={saveCheck}>{saveMessage.startsWith('Saved') ? <Check className="h-4 w-4 mr-2" /> : <Bookmark className="h-4 w-4 mr-2" />}Save this check</Button>
      {saveMessage && <p role="status" className="text-sm">{saveMessage}</p>}
      <p className="text-xs text-slate-400">Device only · no account needed · this does not subscribe you to alerts</p>
    </section>
    <details className="text-xs text-slate-400"><summary className="cursor-pointer flex items-center gap-2"><FileText className="h-3.5 w-3.5" />How recommendations and sponsorship work</summary><p className="mt-2 leading-relaxed">A recommendation needs evidence for the reason you chose. Local listings do not establish ingredient safety, political alignment or current stock. These listings are unpaid. Any future paid placement must be labeled “Ad”; payment must not change the evidence or create a match.</p></details>
  </div>;
}
