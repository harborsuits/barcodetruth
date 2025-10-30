import { useEffect, useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Package, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type RecentScan = { 
  upc: string; 
  product_name: string; 
  timestamp: number;
  brand_name?: string;
};

export default function MyScansTab() {
  const [items, setItems] = useState<RecentScan[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const raw = localStorage.getItem("recent_scans");
    setItems(raw ? JSON.parse(raw) : []);
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Recent Scans</h2>
        <span className="text-sm text-muted-foreground">{items.length} total</span>
      </div>
      
      {items.map((s, idx) => (
        <Card key={`${s.upc}-${idx}`} className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
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
              onClick={() => navigate(`/scan?upc=${s.upc}`)}
            >
              View Again
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
