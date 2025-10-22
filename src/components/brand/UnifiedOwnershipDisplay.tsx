import { Building2, ChevronRight, Info, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface OwnershipChainNode {
  id: string;
  name: string;
  type: 'brand' | 'company';
  logo_url?: string;
  is_public?: boolean;
  ticker?: string;
  relation?: string;
  percent?: number;
  source?: string;
  confidence?: number;
}

interface TopHolder {
  name: string;
  type: string;
  percent: number;
  url?: string;
  official_url?: string;
  wikipedia_url?: string;
  wikidata_qid?: string;
  logo_url?: string;
  source_name?: string;
  source_url?: string;
}

interface OwnershipDetail {
  type: 'employee' | 'family' | 'private_equity' | 'founder' | 'institutional' | 'government' | 'public_float';
  name?: string;
  percent?: number;
  description?: string;
  source?: string;
  source_url?: string;
}

interface UnifiedOwnershipDisplayProps {
  company: OwnershipChainNode | null;
  shareholders?: TopHolder[];
  ownershipDetails?: OwnershipDetail[];
  parentChain?: OwnershipChainNode[];
  siblings?: OwnershipChainNode[];
}

const OWNER_TYPE_LABELS: Record<string, string> = {
  employee: 'Employee-Owned',
  family: 'Family-Owned',
  private_equity: 'Private Equity',
  founder: 'Founder-Owned',
  institutional: 'Institutional Investors',
  government: 'Government-Owned',
  public_float: 'Public Float',
};

export function UnifiedOwnershipDisplay({ 
  company, 
  shareholders, 
  ownershipDetails, 
  parentChain,
  siblings 
}: UnifiedOwnershipDisplayProps) {
  
  if (!company) {
    return (
      <div className="text-center py-8">
        <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
        <h4 className="font-semibold mb-2">No Ownership Data</h4>
        <p className="text-sm text-muted-foreground">
          Ownership information is not yet available for this brand
        </p>
      </div>
    );
  }

  // Calculate if employee-controlled
  const employeeOwned = ownershipDetails?.find(d => d.type === 'employee');
  const isEmployeeControlled = employeeOwned && employeeOwned.percent && employeeOwned.percent > 50;

  const hasOwnershipInfo = (ownershipDetails && ownershipDetails.length > 0) || 
                           (shareholders && shareholders.length > 0);
  const hasParents = parentChain && parentChain.length > 1;

  return (
    <div className="space-y-6">
      {/* Company Header */}
      <div className="flex items-start gap-4 p-6 rounded-lg bg-background border-2">
        {company.logo_url ? (
          <img 
            src={company.logo_url} 
            alt={`${company.name} logo`}
            className="w-16 h-16 rounded-lg object-contain bg-muted p-2 flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
            <Building2 className="h-8 w-8 text-muted-foreground" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-xl mb-2">{company.name}</h3>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="capitalize">
              {company.type}
            </Badge>
            
            {company.is_public && company.ticker && (
              <Badge variant="secondary">
                📈 {company.ticker}
              </Badge>
            )}
            
            {company.is_public && !company.ticker && (
              <Badge variant="secondary">
                Public Company
              </Badge>
            )}

            {!company.is_public && (
              <Badge variant="outline">
                Private Company
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Your Purchase Supports Banner */}
      {hasOwnershipInfo && (
        <Alert className="border-primary/20 bg-primary/5">
          <Info className="h-4 w-4 text-primary" />
          <AlertDescription className="text-foreground">
            <span className="font-semibold">Your purchase supports: </span>
            {isEmployeeControlled ? (
              <>The employees and workers of {company.name}</>
            ) : company.is_public ? (
              <>Public shareholders of {company.name}</>
            ) : (
              <>{company.name} and its stakeholders</>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Ownership Breakdown - Private Company Details */}
      {ownershipDetails && ownershipDetails.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Ownership Breakdown
          </h4>
          {ownershipDetails.map((detail, idx) => (
            <div key={idx} className="p-4 rounded-lg bg-muted/50 border">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h5 className="font-semibold">
                      {detail.name || OWNER_TYPE_LABELS[detail.type] || detail.type}
                    </h5>
                    {detail.percent && (
                      <Badge variant="secondary" className="font-mono">
                        {detail.percent.toFixed(1)}%
                      </Badge>
                    )}
                  </div>
                  {detail.description && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {detail.description}
                    </p>
                  )}
                  {detail.source && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-muted-foreground">
                        Source: {detail.source}
                      </span>
                      {detail.source_url && (
                        <a 
                          href={detail.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                        >
                          View <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ownership Breakdown - Public Company Shareholders */}
      {shareholders && shareholders.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Top Shareholders
          </h4>
          {shareholders.map((holder, idx) => (
            <div key={idx} className="p-4 rounded-lg bg-muted/50 border hover:bg-muted/70 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {holder.logo_url && (
                    <img 
                      src={holder.logo_url}
                      alt={holder.name}
                      className="w-10 h-10 rounded object-contain bg-background p-1 flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h5 className="font-semibold truncate">{holder.name}</h5>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {holder.type}
                      </Badge>
                      <Badge variant="secondary" className="font-mono text-xs">
                        {holder.percent.toFixed(2)}%
                      </Badge>
                    </div>
                    {(holder.official_url || holder.wikipedia_url) && (
                      <div className="flex gap-2 mt-2">
                        {holder.official_url && (
                          <a 
                            href={holder.official_url}
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
          ))}
        </div>
      )}

      {/* Parent Chain - if multi-level */}
      {hasParents && (
        <div className="space-y-3">
          <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Corporate Structure
          </h4>
          <div className="space-y-2">
            {parentChain.map((node, idx) => (
              <div key={node.id}>
                {idx > 0 && (
                  <div className="flex items-center gap-2 my-2 ml-8 text-xs text-muted-foreground">
                    <ChevronRight className="h-3 w-3" />
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help capitalize">
                            {node.relation?.replace(/_/g, ' ')}
                            {node.percent && ` (${node.percent.toFixed(1)}%)`}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">
                            Source: {node.source || 'Unknown'}<br />
                            Confidence: {node.confidence ? Math.round(node.confidence * 100) : 0}%
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}
                
                <div className="flex items-center gap-3 p-3 rounded-lg bg-background border">
                  {node.logo_url ? (
                    <img 
                      src={node.logo_url} 
                      alt={`${node.name} logo`}
                      className="w-10 h-10 rounded object-contain bg-muted p-1"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <h5 className="font-medium truncate">{node.name}</h5>
                    {idx === parentChain.length - 1 && idx > 0 && (
                      <Badge variant="outline" className="text-xs mt-1">
                        Ultimate Parent
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Siblings */}
      {siblings && siblings.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Sister Brands ({siblings.length})
          </h4>
          <div className="grid gap-2">
            {siblings.slice(0, 5).map((sibling) => (
              <div key={sibling.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                {sibling.logo_url ? (
                  <img 
                    src={sibling.logo_url} 
                    alt={`${sibling.name} logo`}
                    className="w-8 h-8 rounded object-contain bg-background p-1"
                  />
                ) : (
                  <div className="w-8 h-8 rounded bg-background flex items-center justify-center">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <span className="text-sm font-medium">{sibling.name}</span>
              </div>
            ))}
            {siblings.length > 5 && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                + {siblings.length - 5} more brands
              </p>
            )}
          </div>
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
