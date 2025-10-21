import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, ExternalLink, Globe } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface OwnershipCardProps {
  companyInfo: {
    ownership?: {
      parent_name: string;
      relationship: string;
      confidence: number;
      source: string;
      company?: {
        id: string;
        name: string;
        ticker?: string;
        exchange?: string;
        is_public: boolean;
        country?: string;
        description?: string;
        logo_url?: string;
        wikidata_qid?: string;
      };
    }[];
  } | null;
}

export function OwnershipCard({ companyInfo }: OwnershipCardProps) {
  const ownership = companyInfo?.ownership?.[0];

  if (!ownership) {
    return (
      <Card className="p-6 bg-muted/30">
        <div className="flex items-start gap-3">
          <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <h3 className="font-semibold text-sm mb-1">Parent Company</h3>
            <p className="text-sm text-muted-foreground">Not yet verified</p>
            <button className="text-xs text-primary hover:underline mt-2">
              Suggest correction
            </button>
          </div>
        </div>
      </Card>
    );
  }

  const company = ownership.company;
  const confidence = Math.round(ownership.confidence * 100);

  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        {company?.logo_url ? (
          <img 
            src={company.logo_url} 
            alt={`${company.name} logo`}
            className="w-12 h-12 rounded-lg object-contain bg-muted p-2"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
            <Building2 className="h-6 w-6 text-muted-foreground" />
          </div>
        )}

        <div className="flex-1 space-y-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold">{ownership.parent_name}</h3>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-xs">
                      {ownership.source === 'wikidata' ? 'Wikidata' : ownership.source}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      Source: {ownership.source}<br />
                      Confidence: {confidence}%
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            <p className="text-xs text-muted-foreground capitalize">
              {ownership.relationship.replace(/_/g, ' ')}
            </p>
          </div>

          {company && (
            <div className="flex flex-wrap gap-3 text-sm">
              {company.country && (
                <div className="flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{company.country}</span>
                </div>
              )}

              {company.is_public && company.ticker && (
                <Badge variant="secondary" className="text-xs">
                  Public: {company.exchange || 'Exchange'}: {company.ticker}
                </Badge>
              )}

              {!company.is_public && (
                <Badge variant="secondary" className="text-xs">
                  Private
                </Badge>
              )}
            </div>
          )}

          {company?.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {company.description}
            </p>
          )}

          {company?.wikidata_qid && (
            <a
              href={`https://www.wikidata.org/wiki/${company.wikidata_qid}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              View on Wikidata <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </Card>
  );
}
