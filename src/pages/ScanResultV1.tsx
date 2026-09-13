import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Package, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { normalizeProductBarcode } from '@/lib/productBarcode';
import { formatBrandName, formatProductName } from '@/lib/formatBrandName';
import { formatCategory } from '@/lib/formatCategory';
import { safeEvidenceUrl } from '@/lib/shoppingLens';
import { ShopperDecisionPanel } from '@/components/scan/ShopperDecisionPanel';
import { lookupApprovedProduct } from '@/lib/approvedProductLookup';

type Product = { id: string; barcode: string; name: string; brand_id: string | null; category: string | null; metadata?: unknown; data_source?: string | null; updated_at?: string | null; image_url?: string | null };
const productFields = 'id, barcode, name, brand_id, category, metadata, data_source, updated_at, image_url' as const;

export default function ScanResultV1() {
  const { barcode } = useParams<{ barcode: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state as { product?: Product; brand?: { name?: string }; justSubmitted?: boolean } | null;
  const normalizedBarcode = normalizeProductBarcode(barcode);
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const { data: product, isLoading, error, refetch } = useQuery({
    queryKey: ['approved-shopper-product-v2', normalizedBarcode], enabled: !!normalizedBarcode,
    retry: false, // Fallback may enqueue research; only retry on a shopper action.
    refetchOnWindowFocus: false, refetchOnReconnect: false, refetchOnMount: false,
    queryFn: async (): Promise<Product | null> => {
      return lookupApprovedProduct<Product>({
        barcodes: [normalizedBarcode!, barcode!],
        readByBarcode: async code => {
          const result = await supabase.from('products').select(productFields).eq('review_status', 'approved')
            .eq('barcode', code).order('updated_at', { ascending: false }).limit(1).maybeSingle();
          if (result.error) throw result.error;
          return result.data;
        },
        lookup: async () => {
          const result = await supabase.functions.invoke('smart-product-lookup', { body: { barcode: normalizedBarcode } });
          if (result.error) throw result.error;
          return result.data?.product;
        },
        readById: async id => {
          const result = await supabase.from('products').select(productFields).eq('review_status', 'approved').eq('id', id).maybeSingle();
          if (result.error) throw result.error;
          return result.data;
        },
      });
    },
  });
  const { data: brand, isLoading: brandLoading, error: brandError, refetch: refetchBrand } = useQuery({
    queryKey: ['shopper-brand-v1', product?.brand_id], enabled: !!product?.brand_id, retry: 1,
    queryFn: async () => {
      const result = await supabase.from('brands').select('id, name, slug, status, parent_company').eq('id', product!.brand_id!).maybeSingle();
      if (result.error) throw result.error;
      return result.data;
    },
  });
  if (!normalizedBarcode) return <Navigate to="/scan" replace />;
  const name = formatProductName(product?.name) || product?.name || 'Product';
  const brandName = formatBrandName(brand?.name) || null;
  const category = formatCategory(product?.category);
  if (!isLoading && !error && !product && !navState?.justSubmitted) return <Navigate to={`/unknown/${normalizedBarcode}`} replace />;
  return <div className="min-h-screen bg-background">
    <main className="max-w-2xl mx-auto px-4 py-5 sm:py-8 space-y-6 text-slate-100">
      <nav className="flex justify-between items-center" aria-label="Result navigation">
        <Button variant="ghost" onClick={() => navigate(-1)} className="pl-0 text-slate-300"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
        <Link to="/search" className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white"><Search className="h-4 w-4" />Search products</Link>
      </nav>
      {isLoading ? <section className="space-y-3" aria-label="Loading product" role="status"><p>Loading your product…</p><Skeleton className="h-32 rounded-2xl" /><Skeleton className="h-52 rounded-2xl" /></section> : error && !product ? <section role="alert" className="rounded-2xl border p-6 space-y-4">
        <h1 className="text-2xl font-semibold">We couldn’t look up this product</h1><p className="text-sm text-slate-300">The lookup failed. This does not mean the product is missing from our records.</p><Button onClick={() => void refetch()}>Try again</Button><Button variant="outline" onClick={() => navigate('/scan')}>Scan another</Button>
      </section> : !product ? <section className="rounded-2xl border p-6 space-y-4"><h1 className="text-2xl font-semibold">Submission received</h1><p>Your product details need review before we can show a confirmed record.</p><Button onClick={() => void refetch()}>Refresh result</Button></section> : <>
        <section className="rounded-2xl bg-card border border-border p-5 sm:p-6" aria-labelledby="scanned-product-name">
          <p className="text-xs uppercase tracking-widest text-teal-200 mb-4">In your basket</p>
          <div className="flex gap-4 items-center">
            {safeEvidenceUrl(product.image_url) && failedImageUrl !== product.image_url ? <img src={safeEvidenceUrl(product.image_url)!} alt="" className="w-16 h-20 object-contain rounded-xl bg-white p-1 shrink-0" onError={() => setFailedImageUrl(product.image_url!)} /> : <div className="w-16 h-20 rounded-xl bg-background/60 grid place-items-center shrink-0"><Package className="w-7 h-7 text-teal-200" /></div>}
            <div className="min-w-0"><h1 id="scanned-product-name" className="font-bold text-xl sm:text-2xl leading-tight">{name}</h1><p className="text-sm text-slate-300 mt-1">{brandLoading ? 'Loading brand…' : brandName ? `by ${brandName}` : 'Brand connection not confirmed'}</p>{category && <p className="text-xs text-slate-400 mt-1">{category}</p>}</div>
          </div>
          <p className="text-xs text-slate-400 mt-4">Barcode {product.barcode} · catalog match · confirm your exact package</p>
          {error && <p role="alert" className="text-xs text-amber-100 mt-2">The latest lookup failed; showing previously loaded details. <button className="underline" onClick={() => void refetch()}>Retry</button></p>}
          {brandError && <p role="alert" className="text-xs text-amber-100 mt-2">The brand record could not be loaded. <button className="underline" onClick={() => void refetchBrand()}>Retry brand</button></p>}
          {brand && !['active', 'ready'].includes(brand.status || '') && <p className="text-xs text-slate-300 mt-2">This brand profile is incomplete. The product checks below remain available.</p>}
        </section>
        <ShopperDecisionPanel key={normalizedBarcode} product={{ name, barcode: product.barcode, brandId: brand?.id, brandName, parentCompany: brand?.parent_company, metadata: product.metadata, dataSource: product.data_source, updatedAt: product.updated_at }} />
        <div className="grid sm:grid-cols-2 gap-3"><Button asChild variant="outline" className="h-12 rounded-xl"><Link to="/scan">Scan another product<ArrowRight className="h-4 w-4 ml-2" /></Link></Button><Button asChild variant="ghost" className="h-12 rounded-xl"><Link to="/">Your next shop</Link></Button></div>
        {!brand?.id && <Link className="inline-block text-sm underline text-slate-300" to={`/unknown/${normalizedBarcode}`}>Suggest missing brand details</Link>}
      </>}
    </main>
  </div>;
}
