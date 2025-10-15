import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";

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
    source_name?: string;
    source_domain?: string;
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
                <th className="text-left">Event & Source</th>
                <th className="text-center">Recency</th>
                <th className="text-center">Verif.</th>
                <th className="text-right">Impact</th>
                <th className="text-right">Contrib</th>
              </tr>
            </thead>
            <tbody>
              {perEvent.map((e) => {
                // Determine if this is an official source
                const isOfficial = e.verification === 'official' || 
                  e.source_domain?.match(/\.(gov|mil)$/) ||
                  ['fda.gov', 'cpsc.gov', 'sec.gov', 'fsis.usda.gov', 'epa.gov', 'osha.gov'].some(d => 
                    e.source_domain?.includes(d)
                  );
                
                return (
                  <tr key={e.event_id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-3 whitespace-nowrap align-top text-xs text-muted-foreground">
                      {new Date(e.date).toLocaleDateString()}
                    </td>
                    <td className="pr-4 py-3 max-w-md">
                      <div className="space-y-1">
                        <div className="font-medium">
                          {e.title || "Untitled event"}
                        </div>
                        {e.canonical_url ? (
                          <a 
                            className="text-sm text-primary hover:underline flex items-center gap-1" 
                            href={e.canonical_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="w-3 h-3" />
                            {e.source_domain || e.source_name || "View source"}
                            {isOfficial && (
                              <Badge variant="outline" className="ml-2 text-xs bg-success/10 text-success border-success/20">
                                Official
                              </Badge>
                            )}
                          </a>
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            {e.source_name || "No source available"}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="text-center text-xs tabular-nums">{e.w_recency.toFixed(2)}</td>
                    <td className="text-center text-xs tabular-nums">{e.w_verif.toFixed(2)}</td>
                    <td className="text-right text-xs tabular-nums">{e.impact.toFixed(2)}</td>
                    <td className="text-right font-medium text-xs tabular-nums">{e.contrib.toFixed(2)}</td>
                  </tr>
                );
              })}
              {perEvent.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center">
                    <div className="text-muted-foreground">
                      <p className="font-medium mb-1">No verified events or sources</p>
                      <p className="text-sm">We only show scores with cited evidence. This brand has no verified event yet.</p>
                    </div>
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
