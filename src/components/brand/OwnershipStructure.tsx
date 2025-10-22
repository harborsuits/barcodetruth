import { Building2, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

interface OwnershipStructureProps {
  chain: OwnershipChainNode[];
  siblings: OwnershipChainNode[];
}

export function OwnershipStructure({ chain, siblings }: OwnershipStructureProps) {
  // Chain contains parent companies - if empty, the company is independent
  if (!chain || chain.length === 0) {
    return (
      <div className="text-center py-8">
        <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
        <h4 className="font-semibold mb-2">Independent Company</h4>
        <p className="text-sm text-muted-foreground">
          This company appears to be independent with no parent organization
        </p>
        <Badge variant="outline" className="mt-3">
          Independent
        </Badge>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Control Chain */}
      <div className="space-y-3">
        {chain.map((node, idx) => (
          <div key={node.id}>
            {idx > 0 && (
              <div className="flex items-center gap-2 my-2 ml-8 text-xs text-muted-foreground">
                <ChevronRight className="h-3 w-3" />
                {node.relation && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help capitalize">
                          {node.relation.replace(/_/g, ' ')}
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
                )}
              </div>
            )}
            
            <div className="flex items-start gap-4 p-4 rounded-lg bg-background border">
              {node.logo_url ? (
                <img 
                  src={node.logo_url} 
                  alt={`${node.name} logo`}
                  className="w-12 h-12 rounded-lg object-contain bg-muted p-2"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-muted-foreground" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <h4 className="font-semibold mb-1 truncate">{node.name}</h4>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-xs capitalize">
                    {node.type}
                  </Badge>
                  
                  {node.is_public && node.ticker && (
                    <Badge variant="secondary" className="text-xs">
                      📈 {node.ticker}
                    </Badge>
                  )}
                  
                  {node.is_public && !node.ticker && (
                    <Badge variant="secondary" className="text-xs">
                      Public Company
                    </Badge>
                  )}
                  
                  {idx === 0 && (
                    <Badge variant="outline" className="text-xs">
                      Current Entity
                    </Badge>
                  )}
                  
                  {idx === chain.length - 1 && idx > 0 && (
                    <Badge className="text-xs bg-primary/10 text-primary border-primary/20">
                      Ultimate Parent
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Siblings */}
      {siblings && siblings.length > 0 && (
        <div className="mt-6 pt-4 border-t">
          <h4 className="font-semibold mb-3 text-sm text-muted-foreground">
            Sister Brands ({siblings.length})
          </h4>
          <div className="grid gap-2">
            {siblings.slice(0, 5).map((sibling) => (
              <div key={sibling.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
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
    </div>
  );
}
