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
      <Card className="p-6 bg-muted/30 border-2">
        <div className="flex items-start gap-3">
          <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <h3 className="font-semibold mb-1">Parent Company</h3>
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
    <Card className="p-6 border-2 border-primary/20 bg-primary/5">
      {/* Prominent header */}
      <div className="mb-4 pb-4 border-b">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Your purchase supports
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          When you buy this brand, profits flow to its parent company
        </p>
      </div>

      <div className="flex items-start gap-4">
        {company?.logo_url ? (
          <img 
            src={company.logo_url} 
            alt={`${company.name} logo`}
            className="w-16 h-16 rounded-lg object-contain bg-background p-2 border-2"
          />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center border-2">
            <Building2 className="h-8 w-8 text-muted-foreground" />
          </div>
        )}

        <div className="flex-1 space-y-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-bold text-xl">{ownership.parent_name}</h4>
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
            
            <p className="text-sm text-muted-foreground capitalize font-medium">
              {ownership.relationship.replace(/_/g, ' ')}
            </p>
          </div>

          {company && (
            <div className="flex flex-wrap gap-3 text-sm">
              {company.country && (
                <div className="flex items-center gap-1.5 font-medium">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span>{company.country}</span>
                </div>
              )}

              {company.is_public && company.ticker && (
                <Badge variant="secondary" className="font-medium">
                  Public: {company.exchange || 'Exchange'}: {company.ticker}
                </Badge>
              )}

              {!company.is_public && (
                <Badge variant="secondary">
                  Private Company
                </Badge>
              )}
            </div>
          )}

          {company?.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {company.description}
            </p>
          )}

          {company?.wikidata_qid && (
            <a
              href={`https://www.wikidata.org/wiki/${company.wikidata_qid}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline font-medium"
            >
              Learn more about {ownership.parent_name} <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    </Card>
  );
}
