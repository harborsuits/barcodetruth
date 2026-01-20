import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, Globe, RefreshCw, Sparkles } from "lucide-react";
import { useIdentityCandidates, useVerifyBrandIdentity, useSelectCandidate, IdentityCandidate } from "@/hooks/useIdentityCandidates";
import { toast } from "sonner";

interface IdentityFixCardProps {
  brandId: string;
  brandName: string;
}

const REASON_LABELS: Record<string, string> = {
  domain_exact_match: 'Website match',
  domain_partial_match: 'Partial website match',
  name_exact_match: 'Name exact match',
  name_high_similarity: 'Name very similar',
  name_partial_match: 'Name similar',
  name_contains: 'Name contains',
  valid_entity_type: 'Company type',
  has_description: 'Has description',
  invalid_entity_type: 'Not a company',
};

export function IdentityFixCard({ brandId, brandName }: IdentityFixCardProps) {
  const { data: candidates, isLoading: candidatesLoading } = useIdentityCandidates(brandId);
  const verifyMutation = useVerifyBrandIdentity();
  const selectMutation = useSelectCandidate();
  const [showCandidates, setShowCandidates] = useState(false);

  const handleAutoFix = async () => {
    try {
      const result = await verifyMutation.mutateAsync({ brandId, autoApply: true });
      
      if (result.auto_applied) {
        toast.success('Identity verified!', {
          description: `Matched to ${result.candidates[0]?.candidate_name || 'entity'} with ${result.new_confidence} confidence.`
        });
        // Page will refresh via query invalidation
      } else if (result.candidates.length > 0) {
        setShowCandidates(true);
        toast.info('Found candidates', {
          description: 'Please select the correct entity below.'
        });
      } else {
        toast.warning('No matches found', {
          description: 'Unable to find matching entities in our database.'
        });
      }
    } catch (error) {
      console.error('Auto-fix error:', error);
      toast.error('Verification failed', {
        description: 'Please try again or report this issue.'
      });
    }
  };

  const handleSelectCandidate = async (candidate: IdentityCandidate) => {
    try {
      await selectMutation.mutateAsync({ 
        brandId, 
        candidateQid: candidate.candidate_qid 
      });
      toast.success('Identity updated!', {
        description: `${brandName} now linked to ${candidate.candidate_name}.`
      });
      // Page will refresh via query invalidation
    } catch (error) {
      console.error('Select candidate error:', error);
      toast.error('Update failed', {
        description: 'Please try again.'
      });
    }
  };

  const displayCandidates = showCandidates 
    ? (verifyMutation.data?.candidates || []).slice(0, 5)
    : (candidates || []).slice(0, 3);

  const isLoading = verifyMutation.isPending || selectMutation.isPending;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Fix brand identity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Help us match "{brandName}" to the correct company entity.
        </p>

        {/* Auto-fix button */}
        <Button
          onClick={handleAutoFix}
          disabled={isLoading}
          className="w-full"
          variant="default"
        >
          {verifyMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Auto-Fix
            </>
          )}
        </Button>

        {/* Candidates list */}
        {displayCandidates.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Or select the correct entity:
            </p>
            {displayCandidates.map((candidate, index) => (
              <CandidateRow
                key={candidate.candidate_qid || index}
                candidate={candidate as IdentityCandidate}
                onSelect={handleSelectCandidate}
                isLoading={selectMutation.isPending}
              />
            ))}
          </div>
        )}

        {candidatesLoading && !showCandidates && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CandidateRow({ 
  candidate, 
  onSelect, 
  isLoading 
}: { 
  candidate: IdentityCandidate;
  onSelect: (c: IdentityCandidate) => void;
  isLoading: boolean;
}) {
  const reasons = Array.isArray(candidate.reasons) ? candidate.reasons : [];
  const positiveReasons = reasons.filter(r => !r.includes('invalid'));

  return (
    <div className="p-3 rounded-lg border bg-background hover:border-primary/50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{candidate.candidate_name}</span>
            <Badge variant="outline" className="text-xs shrink-0">
              {candidate.score}%
            </Badge>
          </div>
          
          {candidate.candidate_domain && (
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <Globe className="h-3 w-3" />
              {candidate.candidate_domain}
            </div>
          )}
          
          {positiveReasons.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {positiveReasons.slice(0, 3).map((reason, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {REASON_LABELS[reason] || reason}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => onSelect(candidate)}
          disabled={isLoading || candidate.is_selected}
          className="shrink-0"
        >
          {candidate.is_selected ? (
            <>
              <CheckCircle className="h-3 w-3 mr-1" />
              Selected
            </>
          ) : (
            'Select'
          )}
        </Button>
      </div>
    </div>
  );
}
