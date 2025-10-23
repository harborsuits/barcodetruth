import { Building2, Info, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TopHolder {
  holder_name?: string;
  name?: string;
  holder_type?: string;
  type?: string;
  percent_owned?: number;
  percent?: number;
  holder_url?: string;
  official_url?: string;
  wikipedia_url?: string;
  logo_url?: string;
  source?: string;
}

interface Subsidiary {
  brand_id: string;
  brand_name: string;
  logo_url?: string;
  relationship: string;
  confidence: number;
}

interface UnifiedOwnershipDisplayProps {
  header: {
    brand_id: string;
    direct_parent_company_id?: string;
    direct_parent_name?: string;
    ultimate_parent_company_id?: string;
    ultimate_parent_name?: string;
    is_ultimate_parent: boolean;
    chain_depth?: number;
  };
  subsidiaries?: Subsidiary[];
}

export function UnifiedOwnershipDisplay({ 
  header,
  subsidiaries
}: UnifiedOwnershipDisplayProps) {
  const { is_ultimate_parent } = header;

  // Only show if there are subsidiaries to display
  if (!subsidiaries || subsidiaries.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
        {is_ultimate_parent ? 'Brands & Companies Owned' : 'Sister Brands'} ({subsidiaries.length})
      </h4>
      <p className="text-xs text-muted-foreground">
        {is_ultimate_parent 
          ? 'This company owns or controls the following brands and entities.'
          : 'These brands share the same parent company.'}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {subsidiaries.slice(0, 10).map((sub) => (
          <a
            key={sub.brand_id}
            href={`/brand/${sub.brand_id}`}
            className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border hover:bg-muted/70 transition-colors"
          >
            {sub.logo_url ? (
              <img 
                src={sub.logo_url} 
                alt={`${sub.brand_name} logo`}
                className="w-10 h-10 rounded object-contain bg-background p-1 flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded bg-background flex items-center justify-center flex-shrink-0">
                <Building2 className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h5 className="font-medium truncate">{sub.brand_name}</h5>
              <Badge variant="outline" className="text-xs capitalize">
                {sub.relationship.replace(/_/g, ' ')}
              </Badge>
            </div>
          </a>
        ))}
      </div>
      {subsidiaries.length > 10 && (
        <p className="text-xs text-muted-foreground text-center">
          + {subsidiaries.length - 10} more brands
        </p>
      )}
    </div>
  );
}