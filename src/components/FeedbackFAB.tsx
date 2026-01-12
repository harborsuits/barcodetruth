import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReportIssue } from '@/components/ReportIssue';
import { cn } from '@/lib/utils';

interface FeedbackFABProps {
  brandId?: string;
  brandName?: string;
  className?: string;
}

export function FeedbackFAB({ brandId, brandName, className }: FeedbackFABProps) {
  return (
    <div className={cn("fixed bottom-20 right-4 z-40", className)}>
      <ReportIssue
        subjectType="brand"
        subjectId={brandId || 'general'}
        trigger={
          <Button
            size="sm"
            variant="outline"
            className="shadow-lg bg-background/95 backdrop-blur-sm border-primary/20 hover:border-primary/40 gap-2"
          >
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Something wrong?</span>
            <span className="sm:hidden">Report</span>
          </Button>
        }
      />
    </div>
  );
}
