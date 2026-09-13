import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ScanLine, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { normalizeProductBarcode } from '@/lib/productBarcode';
import { useShoppingLens } from '@/hooks/useShoppingLens';

export function PublicHero() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const [, setReason] = useShoppingLens();
  return <section className="pt-8 pb-7 sm:pt-14 sm:pb-10 space-y-6">
    <div className="space-y-4">
      <p className="flex items-center gap-2 text-sm font-semibold tracking-widest text-teal-200"><ScanLine className="h-5 w-5" /> BARCODETRUTH</p>
      <h1 className="font-bold text-4xl sm:text-5xl leading-[1.1] tracking-tight">Know more about<br className="hidden sm:block" /> what you buy.</h1>
      <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl">Find a product. See its ingredients, who owns the brand, and the company’s actions—all in one place.</p>
    </div>
    <form role="search" className="rounded-2xl border bg-card p-4 sm:p-5 space-y-4" onSubmit={event => {
      event.preventDefault();
      const text = query.trim();
      if (!text) return;
      setReason('ownership');
      const barcode = normalizeProductBarcode(text);
      navigate(barcode ? `/scan-result/${barcode}` : `/search?q=${encodeURIComponent(text)}&tab=products`);
    }}>
      <label htmlFor="home-search" className="block font-semibold">What are you buying?</label>
      <div className="flex gap-2">
        <Input id="home-search" type="search" placeholder="Product, brand or barcode" value={query} onChange={event => setQuery(event.target.value)} maxLength={200} className="h-12 rounded-lg min-w-0 bg-background" />
        <Button type="submit" disabled={!query.trim()} className="h-12 rounded-lg px-4 bg-teal-200 text-slate-950 hover:bg-teal-100"><Search className="h-4 w-4 sm:mr-2" /><span className="sr-only sm:not-sr-only">Search</span></Button>
      </div>
      <Button asChild variant="outline" className="w-full h-12 rounded-lg"><Link to="/scan" onClick={() => setReason('ownership')}><ScanLine className="h-4 w-4 mr-2" />Scan a barcode</Link></Button>
      <p className="text-xs text-slate-400">Search without an account. Sign in to use the scanner.</p>
    </form>
    <p className="text-sm text-slate-300">Just looking around? <Link to="/scan-result/0044000044268" onClick={() => setReason('ingredients')} className="text-teal-200 underline underline-offset-4">Try a real product example</Link></p>
    <p className="text-xs text-slate-400">Information varies by product. Each result shows what we know and what is missing.</p>
  </section>;
}
