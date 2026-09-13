import { Building2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

interface OwnershipRevealProps { brandId: string; brandName: string; parentCompany?: string | null }

function sourceLink(value: string | null) {
  try { const url = new URL(value || ''); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; }
  catch { return null; }
}

export function OwnershipReveal({ brandId, parentCompany }: OwnershipRevealProps) {
  const { data: records, isLoading, error, refetch } = useQuery({
    queryKey: ['ownership-records-v1', brandId],
    queryFn: async () => {
      const { data, error } = await supabase.from('company_ownership')
        .select('id, parent_company_id, parent_name, relationship, source_url, last_verified_at')
        .eq('child_brand_id', brandId).eq('is_current', true);
      if (error) throw error;
      if (!data?.length) return [];
      const ids = [...new Set(data.map(row => row.parent_company_id).filter(Boolean))];
      if (!ids.length) return data.map(row => ({ ...row, name: null as string | null }));
      const companies = await supabase.from('companies').select('id, name').in('id', ids);
      if (companies.error) throw companies.error;
      return data.map(row => ({ ...row, name: companies.data.find(company => company.id === row.parent_company_id)?.name }));
    },
    enabled: !!brandId,
  });
  if (isLoading) return <Skeleton className="h-20 w-full" />;
  return (
    <section className="bg-elevated-1 border border-border p-4 space-y-3" aria-labelledby="ownership-heading">
      <h2 id="ownership-heading" className="font-semibold flex items-center gap-2"><Building2 className="h-4 w-4" />Ownership records</h2>
      {error ? <div role="alert" className="space-y-2"><p className="text-sm">Ownership records couldn't be loaded.</p><Button variant="outline" size="sm" onClick={() => void refetch()}>Try again</Button></div> : records?.length ? (
        <>
          {records.map(row => {
            const url = sourceLink(row.source_url);
            return <div key={row.id} className="text-sm space-y-1">
              <p className="font-medium">{row.name || row.parent_name || 'Company name unavailable'}</p>
              {!row.name && row.parent_name && <p className="text-xs text-muted-foreground">Unverified name; no linked company record</p>}
              <p className="text-xs text-muted-foreground">Recorded relationship: {row.relationship || 'unspecified'}</p>
              {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary underline">Inspect source</a> : <p className="text-xs text-muted-foreground">Supporting source unavailable</p>}
              <p className="text-xs text-muted-foreground">Recorded review date: {row.last_verified_at ? row.last_verified_at.slice(0, 10) : 'unavailable'}</p>
            </div>;
          })}
          <p className="text-xs text-muted-foreground">These are recorded relationships, not a verified ownership chain. Check whether the source supports the relationship and is still current.</p>
        </>
      ) : <div className="text-sm space-y-1"><p>Ownership not yet confirmed.</p>{parentCompany && <p className="text-xs text-muted-foreground">Unverified parent name in the brand record: {parentCompany}</p>}</div>}
    </section>
  );
}
