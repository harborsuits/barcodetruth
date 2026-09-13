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
    <section className="bg-background/40 rounded-xl border border-border p-4 space-y-3" aria-labelledby="ownership-heading">
      <h4 id="ownership-heading" className="font-semibold flex items-center gap-2"><Building2 className="h-4 w-4" />Company connection on file</h4>
      {error ? <div role="alert" className="space-y-2"><p className="text-sm">Ownership records couldn't be loaded.</p><Button variant="outline" size="sm" onClick={() => void refetch()}>Try again</Button></div> : records?.length ? (
        <>
          {records.map(row => {
            const url = sourceLink(row.source_url);
            return <div key={row.id} className="text-sm space-y-1">
              <p className="font-medium">{row.name || row.parent_name || 'Company name unavailable'}</p>
              {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-teal-200 underline">Read the ownership source</a> : <p className="text-sm text-amber-100">Unconfirmed: we don’t have a supporting source yet.</p>}
              <details className="text-xs text-slate-400 pt-2"><summary className="cursor-pointer">Record details</summary><div className="space-y-1 pt-2">
                {!row.name && row.parent_name && <p>Name has not been linked to a company record.</p>}
                <p>Listed relationship: {row.relationship?.replace(/_/g, ' ') || 'unspecified'}</p>
                <p>Recorded review date: {row.last_verified_at ? row.last_verified_at.slice(0, 10) : 'unavailable'}</p>
                <p>This record does not establish the complete ownership chain.</p>
              </div></details>
            </div>;
          })}
          <p className="text-xs text-slate-400">Check the source for the relationship and date. Ownership can change.</p>
        </>
      ) : <div className="text-sm space-y-1"><p>Ownership not yet confirmed.</p>{parentCompany && <p className="text-xs text-slate-400">Unverified parent name in the brand record: {parentCompany}</p>}</div>}
    </section>
  );
}
