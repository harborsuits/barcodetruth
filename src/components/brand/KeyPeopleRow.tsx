import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Users, RefreshCw } from "lucide-react";
import type { KeyPerson } from "@/hooks/useKeyPeople";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

interface KeyPeopleRowProps {
  people: KeyPerson[];
  emptyMessage?: string;
  brandId?: string;
  brandName?: string;
  wikidataQid?: string;
  onRefetch?: () => void;
}

const roleLabels: Record<string, string> = {
  chief_executive_officer: "CEO",
  chairperson: "Chair",
  chairman: "Chair",
  founder: "Founder",
  // Fallback handling
  CEO: "CEO",
  Chairperson: "Chair",
  Founder: "Founder"
};

export function KeyPeopleRow({ people, emptyMessage, brandId, brandName, wikidataQid, onRefetch }: KeyPeopleRowProps) {
  const [enriching, setEnriching] = useState(false);

  const triggerManualEnrichment = async () => {
    if (!brandId || !wikidataQid) {
      toast({
        title: "Cannot enrich",
        description: "Missing brand ID or Wikidata QID",
        variant: "destructive"
      });
      return;
    }

    setEnriching(true);
    console.log('[KeyPeopleRow] Triggering manual enrichment for:', brandName);
    
    try {
      const { data, error } = await supabase.functions.invoke('enrich-brand-wiki', {
        body: {
          brand_id: brandId,
          wikidata_qid: wikidataQid,
          mode: 'full'  // Force full enrichment including key people
        }
      });

      if (error) throw error;

      toast({
        title: "Enriching...",
        description: "Fetching key people from Wikidata. This may take a few seconds."
      });

      // Wait 3 seconds then refetch
      setTimeout(() => {
        console.log('[KeyPeopleRow] Refetching after enrichment');
        onRefetch?.();
        setEnriching(false);
        toast({
          title: "Success",
          description: "Key people data updated"
        });
      }, 3000);
    } catch (error: any) {
      console.error('[KeyPeopleRow] Enrichment error:', error);
      setEnriching(false);
      toast({
        title: "Error",
        description: error.message || "Failed to enrich key people",
        variant: "destructive"
      });
    }
  };

  if (!people || people.length === 0) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-lg">Key People</h3>
        </div>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {emptyMessage || "No key people data available."}
          </p>
          {brandId && wikidataQid && (
            <Button 
              size="sm" 
              variant="outline"
              onClick={triggerManualEnrichment}
              disabled={enriching}
              className="gap-2"
            >
              {enriching ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Enriching...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3" />
                  Find Key People
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Group founders
  const executives = people.filter(p => 
    p.role !== 'founder' && p.role !== 'Founder'
  );
  const founders = people.filter(p => 
    p.role === 'founder' || p.role === 'Founder'
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Key People</h3>
        <Badge variant="outline" className="text-xs">
          Wikidata
        </Badge>
      </div>

      <div className="flex flex-wrap gap-4">
        {executives.map((person, index) => {
          // Construct Wikipedia URL from person_qid if available
          const wikiUrl = person.person_qid
            ? `https://www.wikidata.org/wiki/${person.person_qid}`
            : `https://en.wikipedia.org/wiki/${encodeURIComponent(person.person_name.replace(/ /g, '_'))}`;
          
          return (
            <TooltipProvider key={index}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <a 
                    href={wikiUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={person.image_url || undefined} alt={person.person_name} />
                      <AvatarFallback className="text-xs">
                        {person.person_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm font-medium">{person.person_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {roleLabels[person.role] || person.role.replace(/_/g, ' ')}
                      </div>
                    </div>
                  </a>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Source: {person.source}</p>
                  {person.person_qid && (
                    <p className="text-xs text-muted-foreground">Click to view on Wikidata</p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}

        {founders.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {founders.slice(0, 3).map((person, index) => (
                <TooltipProvider key={index}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Avatar className="h-8 w-8 border-2 border-background cursor-help">
                        <AvatarImage src={person.image_url || undefined} alt={person.person_name} />
                        <AvatarFallback className="text-xs">
                          {person.person_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs font-medium">{person.person_name}</p>
                      <p className="text-xs text-muted-foreground">Founder</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
            <div className="text-xs text-muted-foreground">
              {founders.length === 1 ? 'Founder' : `${founders.length} Founders`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
