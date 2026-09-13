import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Info, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Candidate = { brand_id: string; brand_name: string; alt_group: string };

export function AlternativesSection({ brandId, brandName }: { brandId: string; brandName: string }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['alternative-candidates-v1', brandId],
    queryFn: async () => {
      const result = await supabase.rpc('get_smart_alternatives' as never, { p_brand_id: brandId, p_limit: 6 } as never, { get: true });
      if (result.error) throw result.error;
      // Old endpoints inferred ethical superiority from company type and missing scores.
      // Only display the explicit candidate contract, without presenting a recommendation.
      return ((result.data || []) as unknown as Candidate[]).filter(row => row.alt_group === 'candidate');
    },
    enabled: !!brandId,
    retry: 1,
    staleTime: 600_000,
  });
  return (
    <Card><CardContent className="pt-6 space-y-3">
      <h2 className="text-lg font-semibold">Alternatives to {brandName}</h2>
      <p className="text-sm text-muted-foreground">A supported recommendation needs a relevant product, checked ownership, and evidence that matches your preferences.</p>
      {isLoading ? <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading alternatives" /> : error ? (
        <div role="alert" className="space-y-2">
          <p className="text-sm">We couldn't load alternatives. This is a lookup error, not a finding about this brand.</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>Try again</Button>
        </div>
      ) : (
        <>
          <p className="text-sm flex gap-2"><Info className="h-4 w-4 shrink-0 mt-0.5" />No verified recommendation is available in this view yet.</p>
          {!!data?.length && <div className="space-y-2 border-t pt-3">
            <h3 className="text-sm font-semibold">Brands to research in the same recorded subcategory</h3>
            <p className="text-xs text-muted-foreground">These are research leads. Ownership, individual product suitability, and fit with your values still need checking.</p>
            {data.map(row => <Link key={row.brand_id} to={`/brand/${row.brand_id}`} className="block rounded-md border p-3 text-sm hover:bg-muted">{row.brand_name}</Link>)}
          </div>}
        </>
      )}
    </CardContent></Card>
  );
}
