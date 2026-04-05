import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  ExternalLink, 
  AlertCircle,
  Clock,
  Search,
  BarChart3,
  MessageSquarePlus,
} from "lucide-react";
import { useState } from "react";
import { SuggestEvidenceDialog } from "@/components/SuggestEvidenceDialog";
import { ReportIssueDialog } from "@/components/ReportIssueDialog";
import type { ProfileStateData } from "@/hooks/useProfileState";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BrandIdentityHeader } from "@/components/brand/BrandIdentityHeader";
import { PowerProfitCard } from "@/components/brand/PowerProfitCard";
import { useDisplayProfile } from "@/hooks/useDisplayProfile";

interface BrandData {
  id: string;
  name: string;
  slug?: string;
  description?: string | null;
  logo_url?: string | null;
  website?: string | null;
  wikidata_qid?: string | null;
  parent_company?: string | null;
  created_at?: string;
  enrichment_stage?: string | null;
}

interface BuildingProfileProps {
  brand: BrandData;
  stateData: ProfileStateData;
}

export function BuildingProfile({ brand, stateData }: BuildingProfileProps) {
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const { progress } = stateData;
  const { data: displayProfile } = useDisplayProfile(brand.id);

  const totalEvents = progress.total_events || 0;
  const dimsCovered = progress.dimensions_covered || 0;
  const displayName = displayProfile?.display_name || brand.name;
  const categoryLabel = displayProfile?.category_label;
  const completeness = displayProfile?.profile_completeness || 0;

  return (
    <div className="container max-w-md mx-auto px-4 py-6 space-y-4">
      {/* ─── Brand Identity ─── */}
      <BrandIdentityHeader
        brandName={displayName}
        logoUrl={displayProfile?.logo_url || brand.logo_url}
        website={brand.website}
        badge={<Badge variant="outline" className="text-xs"><Clock className="h-3 w-3 mr-1" />Building profile</Badge>}
        subtitle={categoryLabel || undefined}
      />

      {/* ─── Status: What we know so far ─── */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-primary/10 flex items-center justify-center flex-shrink-0 rounded">
              <Search className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground">
                Researching this brand
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                {displayProfile?.summary || 
                  (totalEvents > 0 
                    ? `Found ${totalEvents} public record${totalEvents !== 1 ? 's' : ''}. Verifying before publishing a score.`
                    : `Searching public databases for ${displayName}. This can take a few minutes.`
                  )
                }
              </p>
            </div>
          </div>

          {/* Real progress indicator */}
          {completeness > 0 && (
            <div className="mt-4 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Research progress</span>
                <span>{completeness}%</span>
              </div>
              <div className="h-1.5 bg-border rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary/60 rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(completeness, 100)}%` }} 
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── What we found (only show if there's real data) ─── */}
      {totalEvents > 0 && (
        <Card>
          <CardContent className="pt-5 pb-5 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">What we found so far</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/30 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{totalEvents}</p>
                <p className="text-xs text-muted-foreground">Public records</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{dimsCovered}</p>
                <p className="text-xs text-muted-foreground">Categories covered</p>
              </div>
            </div>
            {dimsCovered > 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <BarChart3 className="h-3 w-3" />
                Score will publish once we verify enough sources for a confident rating.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Ownership (only if known) ─── */}
      <OwnershipRevealBuilding brandId={brand.id} brandName={displayName} parentCompany={displayProfile?.parent_display_name || brand.parent_company} />

      {/* ─── Power & Profit ─── */}
      <PowerProfitCard brandId={brand.id} brandName={displayName} />

      {/* ─── Help improve ─── */}
      <div className="flex gap-2">
        <Button 
          variant="outline" 
          size="sm"
          className="flex-1"
          onClick={() => setSuggestOpen(true)}
        >
          <ExternalLink className="h-4 w-4 mr-1.5" />
          Suggest a source
        </Button>
        <Button 
          variant="ghost" 
          size="sm"
          className="flex-1"
          onClick={() => setReportOpen(true)}
        >
          <AlertCircle className="h-4 w-4 mr-1.5" />
          Report issue
        </Button>
      </div>

      <p className="text-xs text-center text-muted-foreground px-4">
        Based on verified public records. Coverage expands weekly.
      </p>

      {/* Dialogs */}
      <SuggestEvidenceDialog 
        open={suggestOpen} 
        onOpenChange={setSuggestOpen}
        brandId={brand.id}
        brandName={brand.name}
      />
      <ReportIssueDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        brandId={brand.id}
        brandName={brand.name}
      />
    </div>
  );
}

// Ownership reveal for building profiles — show parent even before score is ready
function OwnershipRevealBuilding({ brandId, brandName, parentCompany }: { brandId: string; brandName: string; parentCompany?: string | null }) {
  const { data: ownership, isLoading } = useQuery({
    queryKey: ["ownership-reveal", brandId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_brand_ownership" as any, {
        p_brand_id: brandId,
      });
      if (error) return null;
      return data;
    },
    enabled: !!brandId,
  });

  if (isLoading) return null;

  const chain = (ownership as any)?.structure?.chain || [];
  const ultimateParent = chain.length > 1 ? chain[chain.length - 1] : null;
  const parentName = ultimateParent?.name || parentCompany;

  // Don't show anything if no ownership data — no fake "Not verified yet" 
  if (!parentName || parentName === brandName) return null;

  return (
    <div className="bg-elevated-1 border border-border rounded-lg p-4 flex items-center gap-3">
      <div className="w-10 h-10 bg-elevated-2 rounded flex items-center justify-center flex-shrink-0">
        <Building2 className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Owned by</p>
        <p className="text-lg font-bold">{parentName}</p>
      </div>
    </div>
  );
}
