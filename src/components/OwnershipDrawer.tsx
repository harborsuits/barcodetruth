import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, ExternalLink, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

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

export function OwnershipDrawer({ brandId, brandName }: OwnershipDrawerProps) {
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

  if (!hasOwnership && !isLoading) {
    return null;
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Building2 className="h-4 w-4" />
          {isLoading ? 'Loading...' : `Owned by ${data?.upstream[0]?.brand.name}`}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Corporate Ownership</SheetTitle>
          <SheetDescription>
            How {brandName} fits into larger corporate structures
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {isLoading ? (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </>
          ) : (
            <>
              {/* Ownership Chain */}
              {data?.upstream && data.upstream.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium">
                    {data.upstream.length === 1 ? 'Direct Owner' : 'Corporate Chain'}
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold">{brandName}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    </div>
                    {data.upstream.map((parent, idx) => (
                      <div key={parent.brand.id} className="ml-4 space-y-2 border-l-2 pl-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{parent.brand.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {parent.relationship.replace('_', ' ')}
                            </p>
                          </div>
                          {parent.brand.website && (
                            <a
                              href={parent.brand.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-muted-foreground hover:text-foreground"
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
                          {parent.confidence >= 90 ? (
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
                          )}
                        </div>
                      </div>
                    ))}
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
