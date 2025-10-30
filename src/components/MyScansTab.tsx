import { useEffect, useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Package, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { analytics } from "@/lib/analytics";

type RecentScan = { 
  upc: string; 
  product_name: string; 
  timestamp: number;
  brand_name?: string;
};

const MAX_SCANS = 20;

export default function MyScansTab() {
  const [items, setItems] = useState<RecentScan[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const raw = localStorage.getItem("recent_scans");
    const all = raw ? JSON.parse(raw) : [];
    const capped = all.slice(0, MAX_SCANS);
    setItems(capped);
    analytics.trackMyScansOpened(capped.length);
  }, []);

  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Package className="w-16 h-16 text-muted-foreground/40 mb-4" />
        <h3 className="font-semibold text-lg mb-2">No scans yet</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Scan a product barcode to start building your history
        </p>
        <Button onClick={() => navigate("/scan")} variant="default">
          Start Scanning
        </Button>
      </div>
    );
  }

  const handleClear = () => {
    localStorage.removeItem("recent_scans");
    setItems([]);
    analytics.track('my_scans_cleared', { previous_count: items.length });
  };

  const handleRescan = (upc: string) => {
    analytics.trackMyScansClickRescan(upc);
    navigate(`/scan?upc=${upc}`);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Recent Scans</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{items.length} total</span>
          {items.length > 0 && (
            <Button size="sm" variant="ghost" onClick={handleClear}>
              Clear history
            </Button>
          )}
        </div>
      </div>
      
      {items.map((s, idx) => (
        <Card key={`${s.upc}-${idx}`} className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {s.brand_name ? (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm flex-shrink-0">
                    {s.brand_name[0].toUpperCase()}
                  </div>
                ) : null}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">
                    {s.product_name || "Unknown product"}
                  </h3>
                  {s.brand_name && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {s.brand_name}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-shrink-0">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {formatDistanceToNow(new Date(s.timestamp), { addSuffix: true })}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex items-center justify-between pt-0">
            <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
              {s.upc}
            </code>
            <Button 
              size="sm" 
              variant="secondary" 
              onClick={() => handleRescan(s.upc)}
            >
              View Again
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
