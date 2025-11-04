import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, XCircle } from 'lucide-react';

interface DataCompletenessProps {
  hasLogo: boolean;
  hasDescription: boolean;
  hasWikidataQid: boolean;
}

export function DataCompletenessBadge({ hasLogo, hasDescription, hasWikidataQid }: DataCompletenessProps) {
  const missingItems: string[] = [];
  
  if (!hasLogo) missingItems.push('Logo');
  if (!hasDescription) missingItems.push('Description');
  if (!hasWikidataQid) missingItems.push('Wikipedia data');

  const isComplete = missingItems.length === 0;
  const isPartial = missingItems.length > 0 && missingItems.length < 3;
  const isEmpty = missingItems.length === 3;

  if (isComplete) {
    return (
      <Badge variant="default" className="gap-1.5">
        <CheckCircle className="h-3 w-3" />
        Complete data
      </Badge>
    );
  }

  if (isPartial) {
    return (
      <Badge variant="secondary" className="gap-1.5">
        <AlertCircle className="h-3 w-3" />
        Partial data - Missing: {missingItems.join(', ')}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="gap-1.5">
      <XCircle className="h-3 w-3" />
      No enriched data yet
    </Badge>
  );
}
