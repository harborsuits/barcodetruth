import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Clock, TrendingUp, History } from "lucide-react";
import { CorporateFamilyTree } from "./CorporateFamilyTree";
import { useOwnership } from "@/hooks/useOwnership";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface OperatingParent {
  parent_name: string;
  parent_company_id: string | null;
  relationship_role: string;
  confidence: number;
  source: string | null;
  source_url: string | null;
}

interface Investor {
  parent_name: string;
  parent_company_id: string | null;
  relationship_role: string;
  confidence: number;
  source: string | null;
  source_url: string | null;
  effective_from: string | null;
  effective_to: string | null;
  is_current: boolean;
}

interface WhoProfitsProps {
  brandId: string;
  brandName?: string;
  companyType?: 'public' | 'private' | 'subsidiary' | 'independent' | 'unknown' | null;
}

export function WhoProfits({ brandId, brandName = "This brand", companyType }: WhoProfitsProps) {
  // New typed ownership queries
  const { data: operatingParent, isLoading: parentLoading } = useQuery({
    queryKey: ['operating-parent', brandId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_operating_parent' as any, { p_brand_id: brandId });
      if (error) throw error;
      const rows = data as unknown as OperatingParent[];
      return rows?.[0] ?? null;
    },
    enabled: !!brandId,
    staleTime: 1000 * 60 * 30,
  });

  const { data: investors = [], isLoading: investorsLoading } = useQuery({
    queryKey: ['brand-investors', brandId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_brand_investors' as any, { p_brand_id: brandId });
      if (error) throw error;
      return (data || []) as unknown as Investor[];
    },
    enabled: !!brandId,
    staleTime: 1000 * 60 * 30,
  });

  const { data: ownershipData, isLoading: ownershipLoading } = useOwnership(brandId);

  const isLoading = parentLoading || investorsLoading;

  if (isLoading) return null;

  const hasOperatingParent = operatingParent && operatingParent.parent_name !== brandName;
  const hasInvestors = investors.length > 0;
  const siblings = ownershipData?.structure?.siblings || [];
  const isParentCompany = !hasOperatingParent && siblings.length > 0;

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Building2 className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-lg">Who Benefits from Your Purchase</h3>
      </div>

      {/* Operating Parent */}
      <div className="mb-4">
        {hasOperatingParent ? (
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-sm text-muted-foreground mb-1">Revenue flows to</p>
            <p className="text-lg font-semibold">{operatingParent.parent_name}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                {operatingParent.relationship_role?.replace(/_/g, ' ')}
              </Badge>
              {operatingParent.confidence >= 0.8 && (
                <Badge variant="secondary" className="text-xs">Verified</Badge>
              )}
              {operatingParent.source && (
                <span className="text-xs text-muted-foreground">{operatingParent.source}</span>
              )}
            </div>
          </div>
        ) : isParentCompany ? (
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-sm text-muted-foreground mb-1">Parent Company</p>
            <p className="text-lg font-semibold">{brandName}</p>
            <p className="text-xs text-muted-foreground mt-2">
              This is a parent corporation that owns multiple brands and subsidiaries.
            </p>
          </div>
        ) : companyType === 'public' ? (
          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-1 font-medium">Public Company</p>
            <p className="text-lg font-semibold">{brandName}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Publicly traded. Ownership distributed among shareholders.
            </p>
          </div>
        ) : companyType === 'independent' ? (
          <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
            <p className="text-sm text-green-700 dark:text-green-300 font-medium">Independent Brand</p>
            <p className="text-xs text-muted-foreground mt-1">
              Verified independent operation with no parent company.
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">Ownership Data Pending</p>
            </div>
            <p className="text-xs text-muted-foreground">
              We haven't verified the ownership structure yet. Check back soon.
            </p>
          </div>
        )}
      </div>

      {/* Investors / Shareholders */}
      {hasInvestors && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">Investors &amp; Shareholders</p>
          </div>
          <div className="space-y-2">
            {investors.map((inv, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                <div>
                  <p className="text-sm font-medium">{inv.parent_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {inv.relationship_role?.replace(/_/g, ' ')}
                    {inv.effective_from && ` · since ${inv.effective_from.slice(0, 4)}`}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {Math.round(inv.confidence * 100)}%
                </Badge>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2 italic">
            These entities hold shares or financial interest and do not necessarily control the company.
          </p>
        </div>
      )}

      {/* Corporate Family Tree */}
      <CorporateFamilyTree 
        brandName={brandName}
        ownershipData={ownershipData}
        isLoading={ownershipLoading}
        isParentCompany={isParentCompany}
      />
    </Card>
  );
}
