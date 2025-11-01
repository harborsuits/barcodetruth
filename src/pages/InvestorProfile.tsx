import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Building2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePreloadRelated } from "@/hooks/usePreloadRelated";

export default function InvestorProfile() {
  const { id } = useParams<{ id: string }>();
  
  // Enable smart pre-loading for related entities
  usePreloadRelated({ investorId: id });

  // Fetch shareholder data and their holdings
  const { data: shareholderData, isLoading } = useQuery({
    queryKey: ['investor', id],
    queryFn: async () => {
      if (!id) return null;

      // Get shareholder holdings from company_shareholders
      const { data: holdings, error } = await supabase
        .from('company_shareholders')
        .select('holder_name, holder_type, company_id, pct, holder_wikidata_qid')
        .eq('holder_name', decodeURIComponent(id));

      if (error) {
        console.error('[InvestorProfile] Error fetching holdings:', error);
        throw error;
      }
      
      if (!holdings || holdings.length === 0) return null;

      // Get company details for each holding
      const companyIds = [...new Set(holdings.map(h => h.company_id))];
      const { data: companies } = await supabase
        .from('companies')
        .select('id, name, logo_url, is_public, ticker, wikidata_qid')
        .in('id', companyIds);

      // Also get brands for these companies
      const { data: brands } = await supabase
        .from('brands')
        .select('id, name, logo_url, wikidata_qid')
        .in('wikidata_qid', companies?.map(c => c.wikidata_qid).filter(Boolean) || []);

      // Merge the data
      return holdings.map(holding => {
        const company = companies?.find(c => c.id === holding.company_id);
        const brand = brands?.find(b => b.wikidata_qid === company?.wikidata_qid);
        
        return {
          ...holding,
          company,
          brand // Include brand info for linking
        };
      });
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="container max-w-4xl mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!shareholderData || shareholderData.length === 0) {
    return (
      <div className="container max-w-4xl mx-auto p-6">
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold">Investor not found</h1>
        </div>
      </div>
    );
  }

  const holderName = shareholderData[0].holder_name;
  const holderType = shareholderData[0].holder_type;

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      <Link to="/">
        <Button variant="ghost" size="sm" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </Link>

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{holderName}</h1>
            {holderType && (
              <p className="text-sm text-muted-foreground capitalize">{holderType}</p>
            )}
          </div>
        </div>
      </div>

      {/* Investment Portfolio */}
      <div className="rounded-2xl border p-6">
        <h2 className="text-xl font-semibold mb-4">Investment Portfolio</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Companies and brands where {holderName} holds shares
        </p>

        <div className="space-y-4">
          {shareholderData.map((holding, idx) => {
            const company = holding.company;
            const brand = holding.brand;
            const linkTo = brand?.id ? `/brand/${brand.id}` : '#';
            const hasLink = brand?.id;

            return (
              <div key={`${holding.company_id}-${idx}`} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    {(brand?.logo_url || company?.logo_url) && (
                      <img
                        src={brand?.logo_url || company?.logo_url || ''}
                        alt={brand?.name || company?.name || 'Company logo'}
                        className="h-10 w-10 object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                    <div className="flex-1">
                      {hasLink ? (
                        <Link to={linkTo}>
                          <h3 className="font-semibold hover:underline">
                            {brand?.name || company?.name || 'Unknown Company'}
                          </h3>
                        </Link>
                      ) : (
                        <h3 className="font-semibold">
                          {company?.name || 'Unknown Company'}
                        </h3>
                      )}
                      {company?.ticker && (
                        <p className="text-xs text-muted-foreground">
                          {company.ticker} • {company.is_public ? 'Public' : 'Private'}
                        </p>
                      )}
                    </div>
                  </div>
                  {holding.pct !== null && holding.pct > 0 && (
                    <div className="text-right ml-4">
                      <div className="font-semibold">{holding.pct.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">Stake</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
