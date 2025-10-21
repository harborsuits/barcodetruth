import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Users } from "lucide-react";

interface KeyPerson {
  role: string;
  name: string;
  image_url?: string;
  source: string;
}

interface KeyPeopleRowProps {
  people?: KeyPerson[];
}

const roleLabels: Record<string, string> = {
  chief_executive_officer: "CEO",
  chairperson: "Chair",
  founder: "Founder"
};

export function KeyPeopleRow({ people }: KeyPeopleRowProps) {
  if (!people || people.length === 0) {
    return null;
  }

  // Group founders
  const executives = people.filter(p => p.role !== 'founder');
  const founders = people.filter(p => p.role === 'founder');

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
        {executives.map((person, index) => (
          <TooltipProvider key={index}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 cursor-help">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={person.image_url} alt={person.name} />
                    <AvatarFallback className="text-xs">
                      {person.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-sm font-medium">{person.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {roleLabels[person.role] || person.role}
                    </div>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Source: {person.source}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}

        {founders.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {founders.slice(0, 3).map((person, index) => (
                <TooltipProvider key={index}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Avatar className="h-8 w-8 border-2 border-background cursor-help">
                        <AvatarImage src={person.image_url} alt={person.name} />
                        <AvatarFallback className="text-xs">
                          {person.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs font-medium">{person.name}</p>
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
