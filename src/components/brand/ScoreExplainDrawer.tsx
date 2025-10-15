import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";

type Breakdown = {
  window?: { from?: string; to?: string };
  coeffs?: {
    recency?: Record<string, number>;
    verification?: Record<string, number>;
  };
  norm?: { min_raw?: number; max_raw?: number };
  raw_sum?: number;
  normalized?: number;
  event_count?: number;
  recent_events_30d?: number;
  sources_uniq_90d?: number;
  per_event?: Array<{
    event_id: string;
    date: string;
    title?: string;
    canonical_url?: string;
    w_recency: number;
    w_verif: number;
    impact: number;
    contrib: number;
    category?: string;
    verification?: string;
  }>;
};

interface ScoreExplainDrawerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  breakdown?: Breakdown;
}

export function ScoreExplainDrawer({ open, onOpenChange, breakdown }: ScoreExplainDrawerProps) {
  const perEvent = breakdown?.per_event ?? [];
  
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle>Why this score?</DrawerTitle>
          <div className="text-sm text-muted-foreground space-y-1">
            <div>
              Window: {breakdown?.window?.from ?? "—"} → {breakdown?.window?.to ?? "—"}
            </div>
            <div>
              Raw sum: {breakdown?.raw_sum?.toFixed(2) ?? "—"} · 
              Normalized: {breakdown?.normalized ?? "—"} / 100 ·
              Events: {breakdown?.event_count ?? 0}
            </div>
            {breakdown?.coeffs && (
              <div className="text-xs">
                Recency weights: {JSON.stringify(breakdown.coeffs.recency)} · 
                Verification weights: {JSON.stringify(breakdown.coeffs.verification)}
              </div>
            )}
          </div>
        </DrawerHeader>
        <ScrollArea className="px-6 pb-6 max-h-[calc(85vh-120px)]">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground sticky top-0 bg-background">
              <tr className="border-b">
                <th className="py-2 text-left">Date</th>
                <th className="text-left">Title</th>
                <th className="text-left">Recency</th>
                <th className="text-left">Verif.</th>
                <th className="text-right">Impact</th>
                <th className="text-right">Contrib</th>
              </tr>
            </thead>
            <tbody>
              {perEvent.map((e) => (
                <tr key={e.event_id} className="border-b last:border-0">
                  <td className="py-2 whitespace-nowrap">
                    {new Date(e.date).toLocaleDateString()}
                  </td>
                  <td className="pr-4 max-w-xs truncate">
                    {e.canonical_url ? (
                      <a 
                        className="underline hover:no-underline" 
                        href={e.canonical_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        {e.title || "Source"}
                      </a>
                    ) : (
                      e.title || "—"
                    )}
                  </td>
                  <td>{e.w_recency.toFixed(2)}</td>
                  <td>{e.w_verif.toFixed(2)}</td>
                  <td className="text-right">{e.impact.toFixed(2)}</td>
                  <td className="text-right font-medium">{e.contrib.toFixed(2)}</td>
                </tr>
              ))}
              {perEvent.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted-foreground">
                    No event ledger found in breakdown. Score may be based on baseline only.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}
