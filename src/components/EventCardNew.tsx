import { ExternalLink } from "lucide-react";

type Category = "labor"|"environment"|"politics"|"social";
type Verification = "official"|"corroborated"|"unverified" | null;

export type EventLike = {
  id: string;
  brand_id: string;
  title: string;
  source_name?: string | null;
  source_url?: string | null;
  category: Category;
  occurred_at?: string | null;
  delta?: number | null;
  verification?: Verification;
};

function scoreTone(n?: number | null) {
  if (n == null) return "text-[var(--muted)]";
  if (n >= 7) return "text-[var(--success)]";
  if (n <= -7) return "text-[var(--danger)]";
  return "text-[var(--warn)]";
}

function relTime(iso?: string | null) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 36e5);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}

export function EventCardNew({ e }: { e: EventLike }) {
  const v = e.verification;
  const badge =
    v === "official" ? "bg-green-600 text-white"
    : v === "corroborated" ? "bg-blue-600/10 text-blue-700 border border-blue-600/20"
    : v === "unverified" ? "bg-neutral-600/10 text-neutral-700 border border-neutral-600/20"
    : "bg-neutral-600/10 text-neutral-700";

  const cat =
    e.category === "environment" ? "text-emerald-700"
    : e.category === "labor" ? "text-rose-700"
    : e.category === "politics" ? "text-indigo-700"
    : "text-amber-700";

  return (
    <div className="group rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 transition-all duration-150 ease-[var(--ease)] hover:shadow-[var(--shadow-md)]">
      <div className="flex items-start gap-3">
        <div className={"mt-1 h-2 w-2 shrink-0 rounded-full " + (
          e.category==="environment" ? "bg-emerald-500" :
          e.category==="labor" ? "bg-rose-500" :
          e.category==="politics" ? "bg-indigo-500" : "bg-amber-500"
        )}/>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={"text-xs font-medium " + cat}>
              {e.category.charAt(0).toUpperCase() + e.category.slice(1)}
            </span>
            {v && (
              <span className={"text-[11px] px-1.5 py-0.5 rounded-md " + badge}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </span>
            )}
            {!!e.delta && (
              <span className={"ml-1 text-xs font-semibold " + scoreTone(e.delta)}>
                {e.delta > 0 ? `+${e.delta}` : e.delta}
              </span>
            )}
            {e.occurred_at && (
              <span className="ml-auto text-xs text-[var(--muted)]">{relTime(e.occurred_at)}</span>
            )}
          </div>
          <div className="mt-1 line-clamp-2 text-sm font-medium">
            {e.title}
          </div>

          {(e.source_name || e.source_url) && (
            <a
              className="mt-2 inline-flex items-center gap-1 text-xs text-blue-700 hover:underline"
              href={e.source_url ?? "#"}
              target="_blank" rel="noreferrer"
            >
              {e.source_name ?? e.source_url}
              <ExternalLink size={14} className="opacity-70 group-hover:opacity-100" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
