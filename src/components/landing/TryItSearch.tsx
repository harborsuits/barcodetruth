import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";

const SUGGESTIONS = [
  { label: "Nestlé", query: "Nestlé" },
  { label: "Coca-Cola", query: "Coca-Cola" },
  { label: "Nike", query: "Nike" },
  { label: "Dove", query: "Dove" },
];

export function TryItSearch() {
  const navigate = useNavigate();

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Try it yourself</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map(({ label, query }) => (
          <button
            key={query}
            onClick={() => navigate(`/search?q=${encodeURIComponent(query)}`)}
            className="px-4 py-2 rounded-full border border-border bg-elevated-1 text-sm font-medium text-foreground hover:border-primary/40 hover:bg-elevated-2 transition-all duration-150"
          >
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}
