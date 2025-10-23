import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, PlayCircle, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function AdminBatchEnrich() {
  const [batchSize, setBatchSize] = useState(50);
  const queryClient = useQueryClient();

  // Get enrichment coverage stats
  const { data: coverage, isLoading: loadingCoverage } = useQuery({
    queryKey: ['enrichment-coverage'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_enrichment_coverage');
      if (error) throw error;
      return data as {
        total_brands: number;
        has_wikidata_qid: number;
        has_company_record: number;
        has_ownership: number;
        has_key_people: number;
        has_shareholders: number;
        coverage_percent: number;
        stale_count: number;
        brands_needing_enrichment: Array<{ id: string; name: string; wikidata_qid: string }>;
      };
    },
    refetchInterval: 30000, // Refresh every 30s during batch processing
  });


  // Batch enrichment mutation
  const batchEnrich = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const { data, error } = await supabase.functions.invoke('batch-enrich-catalog', {
        body: { limit: batchSize, dry_run: dryRun }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.dry_run) {
        toast.info(`Dry Run Complete`, {
          description: `Found ${data.total} brands to process`
        });
      } else {
        toast.success(`Batch Enrichment Complete`, {
          description: `${data.succeeded} succeeded, ${data.failed} failed`
        });
        queryClient.invalidateQueries({ queryKey: ['enrichment-coverage'] });
      }
    },
    onError: (error) => {
      toast.error('Batch enrichment failed', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  const coveragePercent = coverage?.coverage_percent || 0;
  const needsEnrichment = (coverage?.has_wikidata_qid ?? 0) - (coverage?.has_company_record ?? 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Batch Brand Enrichment</h1>
          <p className="text-muted-foreground mt-1">
            Enrich all brands with Wikidata to populate ownership, key people, and shareholders
          </p>
        </div>
      </div>

      {/* Coverage Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Enrichment Coverage</CardTitle>
          <CardDescription>
            Current state of brand profile data across your catalog
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingCoverage ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Overall Coverage</span>
                  <span className="font-semibold">{coveragePercent}%</span>
                </div>
                <Progress value={coveragePercent} className="h-2" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4">
                <div className="space-y-1">
                  <div className="text-2xl font-bold">{coverage?.total_brands}</div>
                  <div className="text-xs text-muted-foreground">Total Brands</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-blue-600">{coverage?.has_wikidata_qid}</div>
                  <div className="text-xs text-muted-foreground">With Wikidata QID</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-green-600">{coverage?.has_company_record}</div>
                  <div className="text-xs text-muted-foreground">Company Records</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold">{coverage?.has_ownership}</div>
                  <div className="text-xs text-muted-foreground">Ownership Links</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold">{coverage?.has_key_people}</div>
                  <div className="text-xs text-muted-foreground">Key People</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold">{coverage?.has_shareholders}</div>
                  <div className="text-xs text-muted-foreground">Shareholders</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-amber-600">{coverage?.stale_count}</div>
                  <div className="text-xs text-muted-foreground">Stale (14+ days)</div>
                </div>
              </div>

              {needsEnrichment > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{needsEnrichment} brands</strong> have Wikidata QIDs but no company records.
                    These need enrichment to populate ownership and key people data.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Batch Processing */}
      <Card>
        <CardHeader>
          <CardTitle>Batch Process</CardTitle>
          <CardDescription>
            Enrich multiple brands at once. Start with a dry run to preview changes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium">Batch Size</label>
              <select
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                className="w-full mt-1 px-3 py-2 border rounded-md"
                disabled={batchEnrich.isPending}
              >
                <option value={10}>10 brands</option>
                <option value={25}>25 brands</option>
                <option value={50}>50 brands</option>
                <option value={100}>100 brands (all)</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => batchEnrich.mutate(true)}
              disabled={batchEnrich.isPending || needsEnrichment === 0}
              variant="outline"
            >
              {batchEnrich.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <PlayCircle className="h-4 w-4 mr-2" />
              )}
              Dry Run
            </Button>
            <Button
              onClick={() => batchEnrich.mutate(false)}
              disabled={batchEnrich.isPending || needsEnrichment === 0}
            >
              {batchEnrich.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Start Enrichment
            </Button>
          </div>

          {batchEnrich.data && (
            <Alert>
              <AlertDescription>
                <div className="space-y-2">
                  <div className="font-semibold">
                    {batchEnrich.data.dry_run ? 'Dry Run Results' : 'Enrichment Results'}
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Total</div>
                      <div className="text-lg font-semibold">{batchEnrich.data.total}</div>
                    </div>
                    {!batchEnrich.data.dry_run && (
                      <>
                        <div>
                          <div className="text-muted-foreground">Succeeded</div>
                          <div className="text-lg font-semibold text-green-600">
                            {batchEnrich.data.succeeded}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Failed</div>
                          <div className="text-lg font-semibold text-red-600">
                            {batchEnrich.data.failed}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  {batchEnrich.data.errors && batchEnrich.data.errors.length > 0 && (
                    <div className="mt-4 space-y-1">
                      <div className="font-semibold text-sm">Errors:</div>
                      {batchEnrich.data.errors.slice(0, 5).map((err: any, i: number) => (
                        <div key={i} className="text-xs text-red-600">
                          {err.brand_name}: {err.error}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Brands Needing Enrichment */}
      {coverage?.brands_needing_enrichment && coverage.brands_needing_enrichment.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Brands Needing Enrichment</CardTitle>
            <CardDescription>Next {coverage.brands_needing_enrichment.length} brands to process (oldest/stale first)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {coverage.brands_needing_enrichment.map((brand) => (
                <div key={brand.id} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <div className="font-medium">{brand.name}</div>
                    <div className="text-xs text-muted-foreground">{brand.wikidata_qid}</div>
                  </div>
                  <Badge variant="outline">Pending</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
