import { User } from "lucide-react";

type Person = {
  name: string;
  role: string;
  photoUrl?: string;
};

const wikiUrlFromName = (name: string) =>
  `https://en.wikipedia.org/wiki/${encodeURIComponent(name.replace(/ /g, "_"))}`;

export function KeyPeopleSimple({ people }: { people: Person[] }) {
  if (!people?.length) return null;
  
  return (
    <div className="rounded-2xl border p-4">
      <h3 className="text-sm font-medium mb-3">Key people</h3>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {people.map((p) => (
          <li key={p.name} className="flex items-center gap-3">
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
              <a
                href={wikiUrlFromName(p.name)}
                target="_blank"
                rel="noreferrer"
                className="font-medium underline-offset-2 hover:underline"
              >
                {p.name}
              </a>
              <div className="text-xs text-muted-foreground">{p.role}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
