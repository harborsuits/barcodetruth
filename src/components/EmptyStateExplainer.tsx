import { Search, HelpCircle, Clock, Building2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReportIssue } from '@/components/ReportIssue';
import { cn } from '@/lib/utils';

export type EmptyStateType = 
  | 'search-no-results'
  | 'brand-not-indexed'
  | 'product-not-found'
  | 'no-events'
  | 'no-ownership'
  | 'no-subsidiaries';

interface EmptyStateExplainerProps {
  type: EmptyStateType;
  searchQuery?: string;
  brandName?: string;
  className?: string;
  onSuggest?: () => void;
}

const EMPTY_STATE_CONTENT: Record<EmptyStateType, {
  icon: typeof Search;
  title: string;
  description: string;
  subtext: string;
  showSuggest?: boolean;
}> = {
  'search-no-results': {
    icon: Search,
    title: "We don't have this yet",
    description: "This product or brand isn't in our database — but we're growing daily.",
    subtext: "Not all products are indexed yet. Suggest it and we'll try to add it.",
    showSuggest: true
  },
  'brand-not-indexed': {
    icon: Building2,
    title: "Brand not yet indexed",
    description: "We haven't gathered data for this brand yet. Our database covers major brands first.",
    subtext: "Suggest this brand and we'll prioritize adding it.",
    showSuggest: true
  },
  'product-not-found': {
    icon: Package,
    title: "Product not recognized",
    description: "We couldn't match this barcode to a product in our database.",
    subtext: "You can help by telling us what this product is.",
    showSuggest: true
  },
  'no-events': {
    icon: Clock,
    title: "No events found",
    description: "We haven't found any publicly reported events for this brand in our timeframe.",
    subtext: "This doesn't mean nothing happened — it means nothing was publicly reported and verified by our sources yet."
  },
  'no-ownership': {
    icon: HelpCircle,
    title: "Ownership information unavailable",
    description: "We couldn't determine the ownership structure for this brand.",
    subtext: "Private equity, licensing arrangements, and complex corporate structures may not be documented publicly."
  },
  'no-subsidiaries': {
    icon: Building2,
    title: "No known subsidiaries",
    description: "We haven't identified any subsidiary brands for this company.",
    subtext: "Some companies operate under a single brand, or their subsidiaries may not be publicly documented."
  }
};

export function EmptyStateExplainer({ 
  type, 
  searchQuery, 
  brandName,
  className,
  onSuggest 
}: EmptyStateExplainerProps) {
  const content = EMPTY_STATE_CONTENT[type];
  const Icon = content.icon;

  return (
    <div className={cn("text-center py-8 space-y-4", className)}>
      <div className="flex justify-center">
        <div className="p-3 rounded-full bg-muted">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
      </div>
      
      <div className="space-y-2">
        <h3 className="font-semibold text-foreground">{content.title}</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          {content.description}
        </p>
        <p className="text-sm text-muted-foreground/70 max-w-md mx-auto italic">
          {content.subtext}
        </p>
      </div>

      {content.showSuggest && (
        <div className="pt-2">
          <ReportIssue
            subjectType={type === 'product-not-found' ? 'product' : 'brand'}
            subjectId={searchQuery || brandName || 'unknown'}
            trigger={
              <Button variant="outline" size="sm" onClick={onSuggest}>
                Suggest this {type === 'product-not-found' ? 'product' : 'brand'}
              </Button>
            }
          />
        </div>
      )}
    </div>
  );
}
