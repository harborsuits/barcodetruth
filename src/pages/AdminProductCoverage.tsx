import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, ArrowLeft, Package, Database, BarChart3,
  ScanLine, HelpCircle, Upload, RefreshCw, Play
} from "lucide-react";

const CATEGORY_QUEUE = ["beverages", "snacks", "cereals", "dairy", "condiments", "frozen-foods", "sauces"];

interface CoverageMetrics {
  total_products: number;
  products_with_brand: number;
  products_with_category: number;
  total_brands: number;
  brands_with_company: number;
  total_companies: number;
  unknown_barcodes_pending: number;
  unknown_barcodes_total: number;
  top_unknown_barcodes: { barcode: string; scan_count: number; first_seen_at: string }[];
  products_by_source: Record<string, number>;
  scan_resolution_rate: number;
}

interface ImportResult {
  inserted: number;
  skipped_duplicate: number;
  brands_mapped: number;
  brands_created: number;
  total_off_products: number;
  total_pages: number;
  duration_ms: number;
  unmapped_brands_sample?: string[];
  page: number;
}

export default function AdminProductCoverage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [importing, setImporting] = useState(false);
  const [category, setCategory] = useState("beverages");
  const [country, setCountry] = useState("united-states");
  const [page, setPage] = useState(1);
  const [lastResult, setLastResult] = useState<ImportResult | null>(null);
  const [importLog, setImportLog] = useState<{ category: string; result: ImportResult }[]>([]);

  const { data: metrics, isLoading, refetch } = useQuery({
    queryKey: ["product-coverage-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_product_coverage_metrics" as any);
      if (error) throw error;
      return data as unknown as CoverageMetrics;
    },
    staleTime: 1000 * 30,
  });

  const runBulkImport = async (cat?: string) => {
    const importCategory = cat || category;
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("bulk-import-off", {
        body: { category: importCategory, country, page: cat ? 1 : page, page_size: 100 },
      });
      if (error) throw error;
      const result = data as ImportResult;
      setLastResult(result);
      setImportLog(prev => [...prev, { category: importCategory, result }]);
      if (!cat) setPage(p => p + 1);
      toast({
        title: `Import: ${importCategory}`,
        description: `+${result.inserted} products, ${result.brands_mapped} mapped, ${result.brands_created} new brands`,
      });
      refetch();
    } catch (e: any) {
      toast({ title: "Import Failed", description: e.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const pctBrand = metrics && metrics.total_products > 0
    ? Math.round((metrics.products_with_brand / metrics.total_products) * 100) : 0;
  const pctCategory = metrics && metrics.total_products > 0
    ? Math.round((metrics.products_with_category / metrics.total_products) * 100) : 0;

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Product Coverage</h1>
          <p className="text-sm text-muted-foreground">
            Bulk import, barcode coverage, and unknown barcode queue
          </p>
        </div>
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => navigate("/admin/fuzzy-review")}>
          Fuzzy Review Queue
        </Button>
      </div>

      {/* Metrics Cards */}
      {isLoading || !metrics ? (
        <Card><CardContent className="py-8"><div className="h-32 bg-muted/50 animate-pulse rounded" /></CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1"><Package className="h-4 w-4 text-primary" /><span className="text-sm font-medium">Total Products</span></div>
            <div className="text-3xl font-bold">{metrics.total_products.toLocaleString()}</div>
          </CardContent></Card>
          <Card><CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1"><ScanLine className="h-4 w-4 text-green-600 dark:text-green-400" /><span className="text-sm font-medium">Scan Resolution</span></div>
            <div className="text-3xl font-bold">{metrics.scan_resolution_rate}%</div>
          </CardContent></Card>
          <Card><CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1"><HelpCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" /><span className="text-sm font-medium">Unknown Barcodes</span></div>
            <div className="text-3xl font-bold">{metrics.unknown_barcodes_pending}</div>
            <div className="text-xs text-muted-foreground">{metrics.unknown_barcodes_total} total</div>
          </CardContent></Card>
          <Card><CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1"><Database className="h-4 w-4 text-primary" /><span className="text-sm font-medium">Companies</span></div>
            <div className="text-3xl font-bold">{metrics.total_companies}</div>
            <div className="text-xs text-muted-foreground">{metrics.brands_with_company} brands linked</div>
          </CardContent></Card>
        </div>
      )}

      {/* Coverage Bars */}
      {metrics && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" />Data Coverage</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <div className="flex justify-between text-sm"><span>Products with Brand</span><span className="font-medium">{pctBrand}% ({metrics.products_with_brand.toLocaleString()}/{metrics.total_products.toLocaleString()})</span></div>
              <Progress value={pctBrand} className="h-2" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm"><span>Products with Category</span><span className="font-medium">{pctCategory}% ({metrics.products_with_category.toLocaleString()}/{metrics.total_products.toLocaleString()})</span></div>
              <Progress value={pctCategory} className="h-2" />
            </div>
            {Object.keys(metrics.products_by_source).length > 0 && (
              <div className="pt-2 border-t">
                <span className="text-sm font-medium">Products by Source</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {Object.entries(metrics.products_by_source).map(([src, count]) => (
                    <span key={src} className="text-xs bg-muted px-2 py-1 rounded">{src}: {(count as number).toLocaleString()}</span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Category Import */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Play className="h-5 w-5" />Quick Category Import</CardTitle>
          <CardDescription>One-click import page 1 of each high-value category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_QUEUE.map((cat) => (
              <Button
                key={cat}
                variant="outline"
                size="sm"
                disabled={importing}
                onClick={() => runBulkImport(cat)}
              >
                {importing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                {cat}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Manual Bulk Import */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" />Manual Import</CardTitle>
          <CardDescription>Import products by category and country. Each run imports up to 100 products.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div><Label>Category</Label><Input value={category} onChange={e => setCategory(e.target.value)} placeholder="beverages" /></div>
            <div><Label>Country</Label><Input value={country} onChange={e => setCountry(e.target.value)} placeholder="united-states" /></div>
            <div><Label>Page</Label><Input type="number" value={page} onChange={e => setPage(Number(e.target.value))} min={1} /></div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => runBulkImport()} disabled={importing}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              Import Page {page}
            </Button>
            <Button variant="outline" onClick={() => refetch()}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
          </div>
          {lastResult && (
            <div className="text-xs bg-muted p-3 rounded space-y-1">
              <div>Inserted: {lastResult.inserted} • Dupes: {lastResult.skipped_duplicate} • Brands mapped: {lastResult.brands_mapped} • Created: {lastResult.brands_created}</div>
              <div>OFF total: {lastResult.total_off_products?.toLocaleString()} • Pages: {lastResult.total_pages} • Duration: {lastResult.duration_ms}ms</div>
              {lastResult.unmapped_brands_sample && lastResult.unmapped_brands_sample.length > 0 && (
                <div>Unmapped samples: {lastResult.unmapped_brands_sample.join(", ")}</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import Log */}
      {importLog.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Import Session Log</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {importLog.map((entry, i) => (
                <div key={i} className="flex items-center justify-between text-sm border-b pb-1">
                  <Badge variant="outline">{entry.category}</Badge>
                  <span>+{entry.result.inserted} products • {entry.result.brands_mapped} mapped • {entry.result.brands_created} new • {entry.result.duration_ms}ms</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unknown Barcodes Queue */}
      {metrics && metrics.top_unknown_barcodes?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />Top Unknown Barcodes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {metrics.top_unknown_barcodes.map((ub: any) => (
                <div key={ub.barcode} className="flex items-center justify-between text-sm border-b pb-1">
                  <code className="font-mono text-xs">{ub.barcode}</code>
                  <div className="text-right">
                    <span className="font-medium">{ub.scan_count} scans</span>
                    <span className="text-muted-foreground ml-2 text-xs">since {new Date(ub.first_seen_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
