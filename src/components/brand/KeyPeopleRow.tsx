import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Users } from "lucide-react";
import type { KeyPerson } from "@/hooks/useKeyPeople";

interface KeyPeopleRowProps {
  people: KeyPerson[];
  emptyMessage?: string;
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

export function KeyPeopleRow({ people, emptyMessage }: KeyPeopleRowProps) {

  if (!people || people.length === 0) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-lg">Key People</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          {emptyMessage || "Key people data is being enriched from Wikidata. Check back shortly."}
        </p>
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
