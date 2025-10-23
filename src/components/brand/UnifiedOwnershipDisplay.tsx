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
  ownershipHeader: {
    brand_id: string;
    direct_parent_company_id?: string;
    direct_parent_name?: string;
    ultimate_parent_company_id?: string;
    ultimate_parent_name?: string;
    is_ultimate_parent: boolean;
    chain_depth?: number;
  };
  shareholders?: TopHolder[];
  subsidiaries?: Subsidiary[];
}

export function UnifiedOwnershipDisplay({ 
  ownershipHeader,
  shareholders,
  subsidiaries
}: UnifiedOwnershipDisplayProps) {
  const { is_ultimate_parent, direct_parent_name } = ownershipHeader;

  return (
    <div className="space-y-6">
      {/* Ownership Status Banner - Single Source of Truth */}
      <Alert className="border-primary/20 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription className="text-foreground">
          {is_ultimate_parent ? (
            <>
              <Badge variant="outline" className="bg-primary/5 border-primary/20 mr-2">
                <Building2 className="w-3 h-3 mr-1" />
                Ultimate Parent
              </Badge>
              <span className="font-semibold">Top of ownership chain</span> — This entity has no parent company.
            </>
          ) : direct_parent_name ? (
            <>
              <span className="font-semibold">Owned by: </span>
              <span className="text-primary font-semibold">{direct_parent_name}</span>
            </>
          ) : (
            <span>Ownership relationship verification in progress</span>
          )}
        </AlertDescription>
      </Alert>

      {/* Top Shareholders - if available */}
      {shareholders && shareholders.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Top Institutional Shareholders
          </h4>
          <p className="text-xs text-muted-foreground">
            Major holders of publicly traded shares. Asset managers like BlackRock and Vanguard are institutional investors, not parent companies.
          </p>
          {shareholders.slice(0, 10).map((holder, idx) => {
            const name = holder.name || holder.holder_name || 'Unknown';
            const type = holder.type || holder.holder_type || 'institutional';
            const percent = holder.percent ?? holder.percent_owned;
            const url = holder.official_url || holder.holder_url;
            
            return (
              <div key={idx} className="p-4 rounded-lg bg-muted/50 border hover:bg-muted/70 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {holder.logo_url && (
                      <img 
                        src={holder.logo_url}
                        alt={name}
                        className="w-10 h-10 rounded object-contain bg-background p-1 flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h5 className="font-semibold truncate">{name}</h5>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs capitalize">
                          {type}
                        </Badge>
                        {typeof percent === 'number' && (
                          <Badge variant="secondary" className="font-mono text-xs">
                            {percent.toFixed(2)}%
                          </Badge>
                        )}
                      </div>
                      {(url || holder.wikipedia_url) && (
                        <div className="flex gap-2 mt-2">
                          {url && (
                            <a 
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                            >
                              Website <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          {holder.wikipedia_url && (
                            <a 
                              href={holder.wikipedia_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                            >
                              Wikipedia <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Subsidiaries/Brands Owned - Bidirectional Reinforcement */}
      {subsidiaries && subsidiaries.length > 0 && (
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
      )}

      {/* Data Attribution */}
      <Alert variant="default" className="bg-muted/30">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs text-muted-foreground">
          Ownership data is sourced from public filings, corporate disclosures, and verified third-party sources. 
          Data may be approximate and represents the most recent available information.
        </AlertDescription>
      </Alert>
    </div>
  );
}