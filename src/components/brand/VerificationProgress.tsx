import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Building2, FileSearch, BarChart3, Clock } from "lucide-react";
import type { ProfileTierData } from "@/hooks/useProfileTier";

interface VerificationProgressProps {
  tierData: ProfileTierData;
  enrichmentStage?: string | null;
}

const stageConfig: Record<string, { label: string; progress: number }> = {
  'pending': { label: 'Queued for verification', progress: 10 },
  'wiki': { label: 'Fetching Wikipedia data', progress: 25 },
  'ownership': { label: 'Mapping ownership structure', progress: 40 },
  'evidence': { label: 'Gathering evidence', progress: 60 },
  'scoring': { label: 'Calculating scores', progress: 80 },
  'done': { label: 'Verification complete', progress: 100 },
};

export function VerificationProgress({ tierData, enrichmentStage }: VerificationProgressProps) {
  const { completeness } = tierData;
  const stage = enrichmentStage || 'pending';
  const stageInfo = stageConfig[stage] || stageConfig.pending;

  // Determine what's missing
  const missingItems: string[] = [];
  if (!completeness.has_description) missingItems.push('description');
  if (completeness.evidence_count < 3) missingItems.push('evidence');
  if (!completeness.has_pillars) missingItems.push('scores');

  return (
    <Card className="border-dashed border-muted-foreground/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          Verification in Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          We're actively gathering and verifying information about this brand.
        </p>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {stageInfo.label}
            </span>
            <span className="font-medium">{stageInfo.progress}%</span>
          </div>
          <Progress value={stageInfo.progress} className="h-2" />
        </div>

        {/* What's being gathered */}
        {missingItems.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Currently gathering
            </p>
            <div className="flex flex-wrap gap-2">
              {missingItems.includes('evidence') && (
                <div className="flex items-center gap-1.5 text-xs bg-muted/50 rounded-md px-2 py-1">
                  <FileSearch className="h-3 w-3" />
                  <span>News & Sources</span>
                </div>
              )}
              {missingItems.includes('scores') && (
                <div className="flex items-center gap-1.5 text-xs bg-muted/50 rounded-md px-2 py-1">
                  <BarChart3 className="h-3 w-3" />
                  <span>Impact Scores</span>
                </div>
              )}
              {missingItems.includes('description') && (
                <div className="flex items-center gap-1.5 text-xs bg-muted/50 rounded-md px-2 py-1">
                  <Building2 className="h-3 w-3" />
                  <span>Company Info</span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
