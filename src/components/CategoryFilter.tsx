import { Badge } from "@/components/ui/badge";

type CategoryKey = "all" | "labor" | "environment" | "politics" | "cultural-values";

interface CategoryOption {
  key: CategoryKey;
  label: string;
}

const CAT_OPTS: CategoryOption[] = [
  { key: "all", label: "All" },
  { key: "labor", label: "Labor" },
  { key: "environment", label: "Environment" },
  { key: "politics", label: "Politics" },
  { key: "cultural-values", label: "Cultural/Values" },
];

interface CategoryFilterProps {
  value: CategoryKey;
  onChange: (value: CategoryKey) => void;
}

export default function CategoryFilter({ value, onChange }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {CAT_OPTS.map((c) => (
        <button
          key={c.key}
          onClick={() => onChange(c.key)}
          className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
            value === c.key
              ? "bg-primary text-primary-foreground border-primary shadow-sm"
              : "bg-background hover:bg-muted border-border"
          }`}
          aria-pressed={value === c.key}
          aria-label={`Filter ${c.label}`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
