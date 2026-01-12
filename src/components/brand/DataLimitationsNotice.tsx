import { AlertCircle, Clock, HelpCircle, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export type LimitationType = 
  | 'no-data'           // No data found at all
  | 'sparse-data'       // Some data but limited
  | 'ownership-unclear' // Ownership structure not documented
  | 'no-recent-events'  // No events in timeframe
  | 'private-company'   // Private company with limited disclosures
  | 'collecting';       // Data collection in progress

interface DataLimitationsNoticeProps {
  type: LimitationType;
  brandName?: string;
  className?: string;
}

const LIMITATION_CONTENT: Record<LimitationType, {
  icon: typeof AlertCircle;
  title: string;
  description: string;
  subtext?: string;
}> = {
  'no-data': {
    icon: Search,
    title: "We haven't indexed this brand yet",
    description: "This brand isn't in our database yet. We're constantly growing our coverage.",
    subtext: "Help us by suggesting it — we'll try to add it."
  },
  'sparse-data': {
    icon: HelpCircle,
    title: "Limited public information available",
    description: "We found some data for this brand, but coverage is limited. This may improve over time as we index more sources.",
    subtext: "Absence of events doesn't mean absence of issues — it may mean limited public reporting."
  },
  'ownership-unclear': {
    icon: HelpCircle,
    title: "Ownership structure not publicly documented",
    description: "We couldn't determine the ownership structure for this brand. This is common for private companies or complex corporate structures.",
    subtext: "Private equity, licensing arrangements, and minority stakes may not be shown."
  },
  'no-recent-events': {
    icon: Clock,
    title: "No verified events in the last 90 days",
    description: "We haven't found any publicly reported and verified events for this brand recently.",
    subtext: "This doesn't mean nothing happened — it means nothing was publicly reported and verified by our sources."
  },
  'private-company': {
    icon: AlertCircle,
    title: "Private company — limited disclosures",
    description: "This appears to be a private company. Private companies aren't required to file public disclosures, so data may be limited.",
    subtext: "Public companies typically have more available data due to SEC filing requirements."
  },
  'collecting': {
    icon: Search,
    title: "Data collection in progress",
    description: "We're still gathering information about this brand. Check back later for a more complete picture.",
    subtext: "Initial profiles are built within a few hours of first scan."
  }
};

export function DataLimitationsNotice({ type, brandName, className }: DataLimitationsNoticeProps) {
  const content = LIMITATION_CONTENT[type];
  const Icon = content.icon;

  return (
    <div className={cn(
      "rounded-lg border border-amber-500/30 bg-amber-500/5 p-4",
      className
    )}>
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
        <div className="space-y-1">
          <h4 className="font-medium text-amber-800 dark:text-amber-200">
            {content.title}
          </h4>
          <p className="text-sm text-amber-700/80 dark:text-amber-300/80">
            {content.description}
          </p>
          {content.subtext && (
            <p className="text-xs text-amber-600/70 dark:text-amber-400/70 italic pt-1">
              {content.subtext}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
