import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Database, Download, RefreshCw, Play, ArrowLeft } from "lucide-react";
import { FEATURES } from "@/lib/featureFlags";

export default function AdminSeeding() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [csvUrl, setCsvUrl] = useState("");
  const [categories, setCategories] = useState("soft-drinks\nyogurts\ncereals\nsnacks\nbeverages");
  const [stats, setStats] = useState<{
    staged: number;
    merged: number;
    remaining: number | null;
    enriched: number;
  }>({
    staged: 0,
    merged: 0,
    remaining: null,
    enriched: 0
  });

  if (!FEATURES.SEEDING_ENABLED) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Product Seeding Pipeline</CardTitle>
            <CardDescription>Seeding is disabled in production</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const seedFromCSV = async () => {
    if (!csvUrl.trim()) {
      toast({ title: "Error", description: "Please enter a CSV URL", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      console.log('[AdminSeeding] Invoking seed-products with CSV mode');
      const { data, error } = await supabase.functions.invoke("seed-products", {
        body: { mode: "csv", csv_url: csvUrl }
      });

      console.log('[AdminSeeding] Response:', { data, error });
      if (error) throw error;

      const n = data?.staged ?? data?.staged_count ?? data?.inserted ?? data?.count ?? 0;
      toast({ title: "Success", description: `Staged ${n} products from CSV` });
      setStats(prev => ({ ...prev, staged: prev.staged + n }));
      
      // Auto-refresh remaining count
      await refreshRemainingCount();
    } catch (e: any) {
      const msg = (e?.message || '').toLowerCase().includes('fetch')
        ? 'Network/CORS error. Try Shift+Reload and run again.'
        : e?.message || 'Failed to seed';
      toast({ title: "CSV Seed Failed", description: msg, variant: "destructive" });
      console.error('[seed-products] fetch error', e);
    } finally {
      setLoading(false);
    }
  };

  const refreshRemainingCount = async () => {
    try {
      const { count, error } = await supabase
        .from('staging_products')
        .select('*', { count: 'exact', head: true });
      
      if (!error && count !== null) {
        setStats(prev => ({ ...prev, remaining: count }));
      }
    } catch (e) {
      console.error('Failed to refresh count:', e);
    }
  };

  const seedFromOpenFoodFacts = async () => {
    const catList = categories.split("\n").map(s => s.trim()).filter(Boolean);
    if (!catList.length) {
      toast({ title: "Error", description: "Please enter at least one category", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      console.log('[AdminSeeding] Invoking seed-products with OpenFoodFacts mode');
      // Reduce limit and categories to avoid timeout
      const { data, error } = await supabase.functions.invoke("seed-products", {
        body: { 
          mode: "openfoodfacts", 
          categories: catList.slice(0, 2), // Only 2 categories at a time
          limit: 100  // Reduced from 500 to avoid timeout
        }
      });

      console.log('[AdminSeeding] Response:', { data, error });
      if (error) throw error;

      const n = data?.staged ?? data?.staged_count ?? data?.inserted ?? data?.count ?? 0;
      toast({ 
        title: "Success", 
        description: `Staged ${n} products from ${catList.slice(0,2).length} categories. Run again for more.` 
      });
      setStats(prev => ({ ...prev, staged: prev.staged + n }));
      
      // Auto-refresh remaining count
      await refreshRemainingCount();
    } catch (e: any) {
      const msg = (e?.message || '').toLowerCase().includes('fetch')
        ? 'Network/CORS error. Try Shift+Reload and run again.'
        : e?.message || 'Failed to seed';
      toast({ title: "OpenFoodFacts Seed Failed", description: msg, variant: "destructive" });
      console.error('[seed-products] fetch error', e);
    } finally {
      setLoading(false);
    }
  };

  const mergeStaging = async (dryRun = false) => {
    setLoading(true);
    try {
      console.log(`[AdminSeeding] Invoking merge-products (dry_run=${dryRun})`);
      const { data, error } = await supabase.functions.invoke("merge-products", {
        body: { batch_size: 200, dry_run: dryRun },
      });

      console.log('[AdminSeeding] Merge response:', data);

      if (error) throw error;

      const result = data as {
        ok: boolean;
        merged: number;
        skipped_unmapped: number;
        remaining: number;
        created_brands: number;
        sample_unmapped: string[];
      };

      if (!result.ok) {
        throw new Error("Merge failed");
      }

      // Update session stats (only if not dry run)
      if (!dryRun) {
        setStats(prev => ({
          ...prev,
          merged: prev.merged + result.merged,
          enriched: prev.enriched + result.created_brands,
          remaining: result.remaining,
        }));
      }

      const unmappedSummary = result.sample_unmapped?.length 
        ? `\n\nUnmapped examples: ${result.sample_unmapped.slice(0, 3).join(", ")}` 
        : "";

      toast({
        title: dryRun ? "Preview Complete" : "Merge Complete",
        description: `Merged: ${result.merged} • New brands: ${result.created_brands} • Skipped: ${result.skipped_unmapped} • Remaining: ${result.remaining}${unmappedSummary}`,
      });

      if (!dryRun) {
        await refreshRemainingCount();
      }
    } catch (error: any) {
      console.error("[AdminSeeding] Merge error:", error);
      toast({
        title: "Merge Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const runEnrichmentQueue = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("run-enrichment-queue");

      if (error) throw error;

      const processed = data?.processed ?? data?.count ?? 0;
      const succeeded = data?.succeeded ?? data?.success ?? 0;
      const failed = data?.failed ?? Math.max(0, processed - succeeded);
      toast({
        title: "Enrichment Complete",
        description: `Processed ${processed} brands: ${succeeded} succeeded, ${failed} failed`
      });
      setStats(prev => ({ ...prev, enriched: prev.enriched + succeeded }));
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin")}
            title="Back to Admin Dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Product Seeding Pipeline</h1>
            <p className="text-muted-foreground">
              Safe, staged product imports with throttled enrichment
            </p>
          </div>
        </div>
      </div>

      <Card>
          <CardHeader>
            <CardTitle>Session Stats</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-2xl font-bold">{stats.staged}</div>
              <div className="text-xs text-muted-foreground">Staged</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.merged}</div>
              <div className="text-xs text-muted-foreground">Merged</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.remaining ?? "—"}</div>
              <div className="text-xs text-muted-foreground">Remaining</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.enriched}</div>
              <div className="text-xs text-muted-foreground">Enriched</div>
            </div>
          </CardContent>
        </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Seed from CSV
            </CardTitle>
            <CardDescription>
              Load products from a CSV file (barcode, name, brand, category)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="csv-url">CSV URL</Label>
              <Input
                id="csv-url"
                placeholder="https://example.com/products.csv"
                value={csvUrl}
                onChange={(e) => setCsvUrl(e.target.value)}
              />
            </div>
            <Button onClick={seedFromCSV} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Seed from CSV
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Seed from OpenFoodFacts
            </CardTitle>
            <CardDescription>
              Load products from OpenFoodFacts categories (up to 500 per run)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="categories">Categories (one per line)</Label>
              <Textarea
                id="categories"
                rows={5}
                placeholder="soft-drinks&#10;yogurts&#10;cereals"
                value={categories}
                onChange={(e) => setCategories(e.target.value)}
              />
            </div>
            <Button onClick={seedFromOpenFoodFacts} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              Seed from OpenFoodFacts
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Merge Staging → Products
            </CardTitle>
            <CardDescription>
              Merge up to 200 staged products into the products table (idempotent)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-2">
              <Button 
                onClick={() => mergeStaging(true)}
                disabled={loading || stats.remaining === 0}
                variant="outline"
              >
                Preview Merge
              </Button>
              <Button 
                onClick={() => mergeStaging(false)}
                disabled={loading || stats.remaining === 0}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Merge {Math.min(200, stats.remaining || 200)} Products
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              Run Enrichment Queue
            </CardTitle>
            <CardDescription>
              Process up to 15 brands from the enrichment queue (throttled)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={runEnrichmentQueue} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Run Queue (15 brands)
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
