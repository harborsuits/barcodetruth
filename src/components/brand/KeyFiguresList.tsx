import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "lucide-react";

type KeyPerson = {
  name: string;
  position: string | null;
  image_url?: string | null;
};

interface KeyFiguresListProps {
  people: KeyPerson[];
  companyName?: string | null;
}

export function KeyFiguresList({ people, companyName }: KeyFiguresListProps) {
  if (!people.length) {
    return null;
  }

  // Show max 8 people
  const displayPeople = people.slice(0, 8);

  return (
    <div className="space-y-3">
      {companyName && (
        <h3 className="text-sm font-semibold">Key figures at {companyName}</h3>
      )}
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {displayPeople.map((person, idx) => (
          <li key={`${person.name}-${idx}`} className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              {person.image_url ? (
                <AvatarImage src={person.image_url} alt={person.name} />
              ) : null}
              <AvatarFallback className="bg-muted">
                <User className="h-4 w-4 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{person.name}</p>
              {person.position && (
                <p className="text-xs text-muted-foreground truncate">
                  {person.position}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
