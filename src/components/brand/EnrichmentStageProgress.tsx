import { Check, Loader2, Clock, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { formatDistanceToNow } from "date-fns";

// Enrichment stages in order
const ENRICHMENT_STAGES = [
  { key: 'started', label: 'Starting enrichment' },
  { key: 'wikidata_search', label: 'Searching Wikidata' },
  { key: 'identity_validation', label: 'Validating identity' },
  { key: 'wikipedia_fallback', label: 'Checking Wikipedia' },
  { key: 'writing_profile', label: 'Building profile' },
  { key: 'computing_score', label: 'Computing score' },
  { key: 'done', label: 'Complete' },
] as const;

type EnrichmentStageKey = typeof ENRICHMENT_STAGES[number]['key'] | 'failed' | null;

interface EnrichmentStageProgressProps {
  stage: EnrichmentStageKey;
  stageUpdatedAt: string | null;
  startedAt: string | null;
  status: string;
  brandName?: string;
}

export function EnrichmentStageProgress({ 
  stage, 
  stageUpdatedAt, 
  startedAt,
  status,
  brandName 
}: EnrichmentStageProgressProps) {
  // Find current stage index
  const currentIndex = stage 
    ? ENRICHMENT_STAGES.findIndex(s => s.key === stage)
    : 0;
  
  // Calculate progress percentage
  const progress = stage === 'done' 
    ? 100 
    : stage === 'failed'
    ? 0
    : Math.max(10, ((currentIndex + 1) / ENRICHMENT_STAGES.length) * 100);
  
  // Check if stale (> 2 minutes since last update)
  const isStale = stageUpdatedAt 
    ? (Date.now() - new Date(stageUpdatedAt).getTime()) > 2 * 60 * 1000
    : startedAt 
    ? (Date.now() - new Date(startedAt).getTime()) > 2 * 60 * 1000
    : false;

  // Determine display based on status
  const isFailed = status === 'failed';
  const isBuilding = status === 'stub' || status === 'building';
  const isComplete = status === 'ready';

  if (isComplete) {
    return null; // Don't show progress for ready brands
  }

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <Progress value={progress} className="h-2" />
      
      {/* Stage list */}
      <div className="space-y-1.5">
        {ENRICHMENT_STAGES.map((stageItem, index) => {
          const isCurrentStage = stageItem.key === stage;
          const isPastStage = currentIndex > index;
          const isFutureStage = currentIndex < index;
          
          return (
            <div 
              key={stageItem.key}
              className={`flex items-center gap-2 text-xs transition-opacity ${
                isFutureStage ? 'opacity-40' : ''
              }`}
            >
              {isPastStage || (stageItem.key === 'done' && stage === 'done') ? (
                <Check className="h-3 w-3 text-primary flex-shrink-0" />
              ) : isCurrentStage ? (
                <Loader2 className="h-3 w-3 text-primary animate-spin flex-shrink-0" />
              ) : (
                <div className="h-3 w-3 rounded-full border border-muted-foreground/30 flex-shrink-0" />
              )}
              <span className={isCurrentStage ? 'text-primary font-medium' : 'text-muted-foreground'}>
                {stageItem.label}
              </span>
            </div>
          );
        })}
      </div>
      
      {/* Freshness indicator */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
        <Clock className="h-3 w-3" />
        {stageUpdatedAt ? (
          <span>
            Last update: {formatDistanceToNow(new Date(stageUpdatedAt), { addSuffix: true })}
          </span>
        ) : startedAt ? (
          <span>
            Started {formatDistanceToNow(new Date(startedAt), { addSuffix: true })}
          </span>
        ) : (
          <span>Waiting to start...</span>
        )}
      </div>
      
      {/* Stale warning */}
      {isStale && isBuilding && (
        <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          <span>Still working—retrying automatically</span>
        </div>
      )}
      
      {/* Failed state */}
      {isFailed && (
        <div className="flex items-center gap-2 text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 p-2 rounded">
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          <span>Verification pending—we'll retry automatically</span>
        </div>
      )}
    </div>
  );
}
