import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  ExternalLink, 
  AlertCircle,
  Radio,
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
import { getConfidenceLabel } from "@/lib/getConfidenceLabel";
import { ReasonProofList } from "@/components/brand/ReasonProofList";

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

  // Fetch score data (same pattern as ScanResultV1)
  const { data: scoreData } = useQuery({
    queryKey: ["brand_score_building", brand.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("brand_scores" as any)
        .select("score, score_labor, score_environment, score_politics, score_social")
        .eq("brand_id", brand.id)
        .maybeSingle();
      return data as any;
    },
    enabled: !!brand.id,
  });

  const score = scoreData?.score ?? null;
  const confidence = getConfidenceLabel(completeness);
  const parentName = displayProfile?.parent_display_name || brand.parent_company;

  const reasons = buildReasons({
    scores: {
      score_labor: scoreData?.score_labor,
      score_environment: scoreData?.score_environment,
      score_politics: scoreData?.score_politics,
      score_social: scoreData?.score_social,
      overall: score,
    },
    parentName,
    brandName: displayName,
  });

  return (
    <div className="container max-w-md mx-auto px-4 py-6 space-y-4">
      {/* ─── Brand Identity ─── */}
      <BrandIdentityHeader
        brandName={displayName}
        logoUrl={displayProfile?.logo_url || brand.logo_url}
        website={brand.website}
        badge={<Badge variant="outline" className="text-xs"><Radio className="h-3 w-3 mr-1" />Live profile</Badge>}
        subtitle={categoryLabel || undefined}
      />

      {/* ─── Provisional Score + Confidence ─── */}
      {score !== null ? (
        <Card className="border-primary/20">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <div className="text-4xl font-bold text-foreground">
                {Math.round(score)}
              </div>
              <div className="flex flex-col gap-1">
                <Badge variant="secondary" className="text-xs w-fit">
                  Preliminary · evolving
                </Badge>
                <span className={`text-xs ${confidence.className}`}>
                  Confidence: {confidence.label} ({completeness}% coverage)
                </span>
              </div>
            </div>

            {/* Top reasons */}
            {reasons.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium text-foreground mb-1.5">Why this score (so far)</p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                  {reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-5 pb-5">
            <p className="text-sm text-muted-foreground">
              {totalEvents > 0
                ? `Limited data — ${totalEvents} record${totalEvents !== 1 ? "s" : ""} analyzed`
                : `Searching public databases for ${displayName}`
              }
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Live accountability profile — updated continuously from public records
            </p>
          </CardContent>
        </Card>
      )}

      {/* ─── Stats line ─── */}
      {totalEvents > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Based on {totalEvents} public records across {dimsCovered} categor{dimsCovered !== 1 ? "ies" : "y"}
        </p>
      )}

      {/* ─── Ownership ─── */}
      <OwnershipRevealBuilding brandId={brand.id} brandName={displayName} parentCompany={parentName} />

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
        Based on public records. Coverage expands weekly.
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

// Ownership reveal for building profiles
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
