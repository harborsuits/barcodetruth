import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bookmark, X } from 'lucide-react';
import { parseShopNotes, SHOP_NOTES_KEY, shoppingReasons } from '@/lib/shoppingLens';
import { useShoppingLens } from '@/hooks/useShoppingLens';

export function NextShop() {
  const [, setReason] = useShoppingLens();
  const { hash } = useLocation();
  const section = useRef<HTMLElement>(null);
  const [notes, setNotes] = useState(() => { try { return parseShopNotes(localStorage.getItem(SHOP_NOTES_KEY)); } catch { return []; } });
  const [error, setError] = useState('');
  useEffect(() => {
    if (hash !== '#saved-products') return;
    const frame = requestAnimationFrame(() => {
      section.current?.focus({ preventScroll: true });
      section.current?.scrollIntoView({ block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [hash]);
  if (!notes.length && hash !== '#saved-products') return null;
  return <section ref={section} tabIndex={-1} id="saved-products" className="rounded-2xl border bg-card p-5 space-y-3 my-5 scroll-mt-24" aria-labelledby="next-shop-heading">
    <h2 id="next-shop-heading" className="text-xl font-semibold flex gap-2 items-center"><Bookmark className="h-5 w-5 text-teal-200" />Saved for later</h2>
    <p className="text-sm text-slate-300">Reopen a product and the question you saved. Stored in this browser; no automatic alerts.</p>
    {!notes.length && <p className="text-sm text-slate-300">Nothing saved yet. <Link to="/search?tab=products" className="text-teal-200 underline underline-offset-4">Find a product</Link>, then choose “Save for later” on its result.</p>}
    {notes.map(note => <div key={note.barcode} className="flex gap-3 items-center rounded-xl border p-3">
      <Link to={`/scan-result/${note.barcode}`} onClick={() => setReason(note.reason)} className="flex-1 min-w-0 hover:underline"><p className="font-medium text-sm">{note.name}</p><p className="text-xs text-teal-200 mt-1">{shoppingReasons.find(reason => reason.id === note.reason)?.short}</p></Link>
      <button type="button" aria-label={`Remove ${note.name} from this device`} className="p-3 rounded-lg hover:bg-muted" onClick={() => {
        const next = notes.filter(item => item.barcode !== note.barcode);
        try { localStorage.setItem(SHOP_NOTES_KEY, JSON.stringify(next)); setNotes(next); setError(''); }
        catch { setError('This browser could not update the saved checklist.'); }
      }}><X className="h-4 w-4" /></button>
    </div>)}
    {error && <p role="alert" className="text-sm">{error}</p>}
  </section>;
}
