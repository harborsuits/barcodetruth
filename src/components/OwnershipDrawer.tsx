import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, ExternalLink, ArrowRight, HelpCircle, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState } from "react";

interface BrandNode {
  id: string;
  name: string;
  wikidata_qid?: string;
  website?: string;
}

interface OwnershipData {
  brand: BrandNode;
  upstream: Array<{
    brand: BrandNode;
    relationship: string;
    confidence: number;
    sources: Array<{ name: string; url: string | null }>;
  }>;
  downstream_siblings: BrandNode[];
  confidence: number;
  sources: Array<{ name: string; url: string | null }>;
}

interface OwnershipDrawerProps {
  brandId: string;
  brandName: string;
}

const relationshipLabels: Record<string, string> = {
  'brand_of': 'brand of',
  'division_of': 'division of',
  'subsidiary_of': 'subsidiary of',
  'acquired_by': 'acquired by',
};

const getRelationshipLabel = (relationship: string): string => {
  return relationshipLabels[relationship] || relationship.replace('_', ' ');
};

export function OwnershipDrawer({ brandId, brandName }: OwnershipDrawerProps) {
  const [helpOpen, setHelpOpen] = useState(false);
  
  const { data, isLoading } = useQuery<OwnershipData>({
    queryKey: ['ownership-trail', brandId],
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-ownership-trail?brand_id=${brandId}`
      );
      if (!response.ok) throw new Error('Failed to fetch ownership data');
      return response.json();
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  const hasOwnership = data?.upstream && data.upstream.length > 0;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Building2 className="h-4 w-4" />
          {isLoading ? (
            'Loading...'
          ) : hasOwnership ? (
            `Owned by ${data.upstream[0].brand.name}`
          ) : (
            'Ownership info'
          )}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Corporate Ownership</SheetTitle>
          <SheetDescription>
            {hasOwnership 
              ? `How ${brandName} fits into larger corporate structures`
              : `Checking corporate records for ${brandName}`
            }
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {isLoading ? (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </>
          ) : !hasOwnership ? (
            <div className="text-center py-8 space-y-3">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium">No ownership data yet</p>
                <p className="text-xs text-muted-foreground">
                  We're checking corporate records. This usually appears within 24 hours.
                </p>
              </div>
              <p className="text-xs text-muted-foreground pt-2">
                You can still view alternatives now.
              </p>
              <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 mt-2">
                    <HelpCircle className="h-4 w-4" />
                    Why we sometimes can't find ownership
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>How We Determine Corporate Ownership</DialogTitle>
                    <DialogDescription className="space-y-3 pt-2">
                      <p>
                        We automatically pull ownership data from public sources like Wikidata, Wikipedia, and regulatory filings. 
                        This covers most major brands and parent companies.
                      </p>
                      <p>
                        However, some brands may not have ownership information immediately available because:
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>They're privately held companies with limited public disclosure</li>
                        <li>They're new brands we haven't indexed yet</li>
                        <li>The ownership structure is complex or in transition</li>
                        <li>They're local or regional brands with less public documentation</li>
                      </ul>
                      <p>
                        We continuously enrich our database, so ownership information typically appears within 24 hours of the first scan.
                      </p>
                    </DialogDescription>
                  </DialogHeader>
                </DialogContent>
              </Dialog>
            </div>
          ) : (
            <>
              {/* Ownership Chain */}
              {data?.upstream && data.upstream.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium">
                        {data.upstream.length === 1 ? 'Direct Owner' : 'Corporate Chain'}
                      </h3>
                      {data.upstream.length > 1 && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button 
                              className="text-muted-foreground hover:text-foreground"
                              aria-label="Learn about corporate chains"
                            >
                              <Info className="h-3.5 w-3.5" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72 text-xs">
                            <p className="font-medium mb-1">Corporate Chain Explained</p>
                            <p className="text-muted-foreground">
                              We trace ownership through multiple levels to show you the ultimate parent company. 
                              This helps you make informed decisions about who profits from your purchase.
                            </p>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                    {data.upstream.length === 3 && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs text-muted-foreground cursor-help">
                              Showing top 3 levels
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="space-y-2">
                            <p className="text-xs">We cap at 3 for clarity</p>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              disabled 
                              className="text-xs h-7"
                            >
                              See more levels (coming soon)
                            </Button>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold">{brandName}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    </div>
                    {data.upstream.map((parent, idx) => {
                      const isTopParent = idx === data.upstream.length - 1;
                      const isSingleHop = data.upstream.length === 1;
                      return (
                        <div key={parent.brand.id} className="ml-4 space-y-2 border-l-2 pl-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium">{parent.brand.name}</p>
                                {!isSingleHop && (
                                  <Badge 
                                    variant={isTopParent ? "secondary" : "outline"} 
                                    className="text-xs"
                                    aria-label={`Level ${idx + 1} of ${data.upstream.length}`}
                                  >
                                    {idx + 1}/{data.upstream.length}
                                  </Badge>
                                )}
                                {isTopParent && data.upstream.length > 1 && (
                                  <Badge variant="secondary" className="text-xs ml-auto">
                                    Top Parent
                                  </Badge>
                                )}
                              </div>
                              <Badge 
                                variant="outline" 
                                className="text-xs capitalize w-fit"
                                aria-label={`Relationship: ${getRelationshipLabel(parent.relationship)}`}
                              >
                                {getRelationshipLabel(parent.relationship)}
                              </Badge>
                            </div>
                            {parent.brand.website && (
                              <a
                                href={parent.brand.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-muted-foreground hover:text-foreground"
                                aria-label={`Visit ${parent.brand.name} website`}
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {parent.sources.map((source, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {source.name}
                              </Badge>
                            ))}
                            {parent.confidence && parent.confidence < 95 && (
                              parent.confidence >= 90 ? (
                                <Badge variant="default" className="text-xs">
                                  High confidence ({parent.confidence}%)
                                </Badge>
                              ) : parent.confidence >= 70 ? (
                                <Badge variant="secondary" className="text-xs">
                                  {parent.confidence}% confidence
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">
                                  Low confidence ({parent.confidence}%)
                                </Badge>
                              )
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sibling Brands */}
              {data?.downstream_siblings && data.downstream_siblings.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium">
                    Other Brands Under {data.upstream[0]?.brand.name}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {data.downstream_siblings.slice(0, 10).map((sibling) => (
                      <Badge key={sibling.id} variant="secondary">
                        {sibling.name}
                      </Badge>
                    ))}
                    {data.downstream_siblings.length > 10 && (
                      <Badge variant="outline">+{data.downstream_siblings.length - 10} more</Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Sources & Confidence */}
              {data?.sources && data.sources.length > 0 && (
                <div className="space-y-2 rounded-lg bg-muted p-3 text-xs">
                  <p className="font-medium">Data Sources</p>
                  <div className="space-y-1">
                    {data.sources.map((source, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span>{source.name}</span>
                        {source.url && (
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
