import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Building2, 
  Globe, 
  ExternalLink, 
  MessageSquarePlus,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Circle,
  Bell,
  Search
} from "lucide-react";
import { useState } from "react";
import { SuggestEvidenceDialog } from "@/components/SuggestEvidenceDialog";
import { ReportIssueDialog } from "@/components/ReportIssueDialog";
import type { ProfileStateData } from "@/hooks/useProfileState";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BrandIdentityHeader } from "@/components/brand/BrandIdentityHeader";
import { PowerProfitCard } from "@/components/brand/PowerProfitCard";

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


// Human-readable source checklist instead of abstract "evidence domains"
const SOURCES_CHECKED = [
  { key: 'osha', label: 'OSHA', fullName: 'Workplace Safety' },
  { key: 'epa', label: 'EPA', fullName: 'Environmental' },
  { key: 'fda', label: 'FDA', fullName: 'Product Safety' },
  { key: 'fec', label: 'FEC', fullName: 'Political Spending' },
  { key: 'ftc', label: 'FTC', fullName: 'Consumer Protection' },
];

function SourceChecklist({ progress }: { progress: ProfileStateData['progress'] }) {
  // Map progress to source coverage heuristic
  const totalEvents = progress.total_events || 0;
  const dimsCovered = progress.dimensions_covered || 0;
  
  // Simple heuristic: mark sources as checked based on dimensions and event count
  const sourceStatus = {
    osha: dimsCovered >= 1,
    epa: dimsCovered >= 2,
    fda: totalEvents >= 3,
    fec: dimsCovered >= 3,
    ftc: totalEvents >= 5,
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sources checked</p>
      <div className="grid grid-cols-1 gap-1.5">
        {SOURCES_CHECKED.map((source) => {
          const checked = sourceStatus[source.key as keyof typeof sourceStatus];
          return (
            <div 
              key={source.key} 
              className={`flex items-center gap-2.5 px-3 py-2 ${
                checked ? 'bg-success/5' : 'bg-muted/30'
              }`}
            >
              {checked ? (
                <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground/30 flex-shrink-0" />
              )}
              <span className={`text-sm font-medium ${checked ? 'text-foreground' : 'text-muted-foreground/60'}`}>
                {source.label}
              </span>
              <span className="text-xs text-muted-foreground ml-auto">
                {source.fullName}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BuildingProfile({ brand, stateData }: BuildingProfileProps) {
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const { progress } = stateData;

  // Calculate a rough confidence signal
  const totalEvents = progress.total_events || 0;
  const dimsCovered = progress.dimensions_covered || 0;
  const earlySignal = dimsCovered >= 2 && totalEvents >= 3;

  return (
    <div className="container max-w-md mx-auto px-4 py-6 space-y-4">
      {/* ─── Brand Identity ─── */}
      <BrandIdentityHeader
        brandName={brand.name}
        logoUrl={brand.logo_url}
        website={brand.website}
        badge={<Badge variant="outline" className="text-xs"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Building</Badge>}
      />

      {/* ─── Status: Consumer-friendly, not "rating withheld" ─── */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Search className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground">
                Checking sources…
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                {earlySignal 
                  ? `Found ${totalEvents} signals across ${dimsCovered} categories. Final score arriving shortly.`
                  : `Searching government databases for ${brand.name}. This usually takes a few minutes.`
                }
              </p>
              {earlySignal && (
                <div className="mt-2 flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin text-primary" />
                  <span className="text-xs text-primary font-medium">Building confidence…</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Ownership Reveal (the viral hook — show immediately) ─── */}
      <OwnershipRevealBuilding brandId={brand.id} brandName={brand.name} parentCompany={brand.parent_company} />

      {/* ─── Source Checklist (human-readable, not "evidence domains") ─── */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <SourceChecklist progress={progress} />
        </CardContent>
      </Card>

      {/* ─── Power & Profit ─── */}
      <PowerProfitCard brandId={brand.id} brandName={brand.name} />

      {/* ─── Notify CTA ─── */}
      <Card className="bg-muted/30">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start gap-3">
            <Bell className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium">Get notified when the score is ready</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                We'll alert you when {brand.name} meets our verification threshold.
              </p>
              <Button size="sm" className="mt-3">
                <Bell className="h-4 w-4 mr-1.5" />
                Notify me
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

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

  if (isLoading) return <Skeleton className="h-16 w-full" />;

  const chain = (ownership as any)?.structure?.chain || [];
  const ultimateParent = chain.length > 1 ? chain[chain.length - 1] : null;
  const parentName = ultimateParent?.name || parentCompany;

  if (!parentName || parentName === brandName) return null;

  return (
    <div className="bg-elevated-1 border border-border p-4 flex items-center gap-3">
      <div className="w-10 h-10 bg-elevated-2 flex items-center justify-center flex-shrink-0">
        <Building2 className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Owned by</p>
        <p className="text-lg font-bold">{parentName}</p>
      </div>
    </div>
  );
}
