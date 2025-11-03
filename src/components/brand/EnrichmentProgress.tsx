import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

interface EnrichmentProgressProps {
  brandName: string;
  status: 'idle' | 'enriching' | 'complete' | 'failed';
  message: string;
  step: number;
  totalSteps: number;
}

export function EnrichmentProgress({ 
  brandName, 
  status, 
  message, 
  step, 
  totalSteps 
}: EnrichmentProgressProps) {
  if (status === 'idle') return null;

  const progressPercent = (step / totalSteps) * 100;

  return (
    <div className="container py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {status === 'enriching' && (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Enriching {brandName}
              </>
            )}
            {status === 'complete' && (
              <>
                <CheckCircle className="h-5 w-5 text-green-500" />
                Enrichment Complete!
              </>
            )}
            {status === 'failed' && (
              <>
                <XCircle className="h-5 w-5 text-destructive" />
                Enrichment Failed
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{message}</p>
          {status === 'enriching' && (
            <Progress value={progressPercent} className="w-full" />
          )}
          {status === 'complete' && (
            <p className="text-sm text-muted-foreground">
              Page will refresh automatically...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
