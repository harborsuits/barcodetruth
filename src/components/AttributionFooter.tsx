import { AlertCircle, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ReportIssue } from './ReportIssue';

export function AttributionFooter() {
  return (
    <Card className="mt-8 border-l-4 border-l-blue-500">
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium">About This Information</p>
            <p className="text-sm text-muted-foreground">
              Barcode Truth aggregates information from public sources and news outlets. 
              We cite all sources and do not make independent factual claims. 
              Event verification levels indicate source reliability, not editorial judgment.
            </p>
            <div className="flex items-center gap-4 pt-2">
              <ReportIssue 
                subjectType="brand" 
                subjectId="general"
                trigger={
                  <button className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                    Report incorrect information
                    <ExternalLink className="h-3 w-3" />
                  </button>
                }
              />
              <a 
                href="/privacy" 
                className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                Privacy Policy
                <ExternalLink className="h-3 w-3" />
              </a>
              <a 
                href="/terms" 
                className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                Terms of Service
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
