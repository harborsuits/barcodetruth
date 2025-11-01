import { User } from "lucide-react";
import { Link } from "react-router-dom";

type Person = {
  name: string;
  role: string;
  photoUrl?: string;
};

export function KeyPeopleSimple({ people }: { people: Person[] }) {
  if (!people?.length) return null;
  
  return (
    <div className="rounded-2xl border p-4">
      <h3 className="text-sm font-medium mb-3">Key people</h3>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {people.map((p) => (
          <li key={p.name}>
            <Link
              to={`/person/${encodeURIComponent(p.name)}`}
              className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-secondary/50 transition-colors"
            >
              {p.photoUrl ? (
                <img
                  src={p.photoUrl}
                  className="w-10 h-10 rounded-full object-cover"
                  alt={p.name}
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <User className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
              <div className="text-sm">
                <span className="font-medium hover:underline">{p.name}</span>
                <div className="text-xs text-muted-foreground">{p.role}</div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
