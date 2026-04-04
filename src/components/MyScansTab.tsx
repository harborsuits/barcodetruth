import { useEffect, useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Package, Clock, AlertCircle, Archive, FolderOpen } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { analytics } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";
import {
  type RecentScan,
  RECENT_SCANS_KEY,
  ARCHIVED_SCANS_KEY,
  readStoredScans,
  writeStoredScans,
  buildHistoryNavigationState,
  upsertStoredScan,
} from "@/lib/recentScans";

const MAX_SCANS = 20;

export default function MyScansTab() {
  const [items, setItems] = useState<RecentScan[]>([]);
  const [archived, setArchived] = useState<RecentScan[]>([]);
  const [showArchive, setShowArchive] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const all = readStoredScans(RECENT_SCANS_KEY);
    setItems(all.slice(0, MAX_SCANS));
    setArchived(readStoredScans(ARCHIVED_SCANS_KEY));
    analytics.trackMyScansOpened(all.length);
  }, []);

  const handleArchive = (upc: string) => {
    const item = items.find((s) => s.upc === upc);
    if (!item) return;

    const newItems = items.filter((s) => s.upc !== upc);
    const newArchived = [item, ...archived.filter((s) => s.upc !== upc)].slice(0, 50);

    setItems(newItems);
    setArchived(newArchived);
    writeStoredScans(newItems, RECENT_SCANS_KEY);
    writeStoredScans(newArchived, ARCHIVED_SCANS_KEY);
    analytics.track('scan_archived', { upc });
  };

  const handleArchiveAll = () => {
    const newArchived = [...items, ...archived].reduce((acc: RecentScan[], s) => {
      if (!acc.find((a) => a.upc === s.upc)) acc.push(s);
      return acc;
    }, []).slice(0, 50);

    setArchived(newArchived);
    setItems([]);
    writeStoredScans([], RECENT_SCANS_KEY);
    writeStoredScans(newArchived, ARCHIVED_SCANS_KEY);
    analytics.track('scans_archived_all', { count: items.length });
  };

  const handleRestore = (upc: string) => {
    const item = archived.find((s) => s.upc === upc);
    if (!item) return;

    const newArchived = archived.filter((s) => s.upc !== upc);
    const newItems = [item, ...items].slice(0, MAX_SCANS);

    setArchived(newArchived);
    setItems(newItems);
    writeStoredScans(newArchived, ARCHIVED_SCANS_KEY);
    writeStoredScans(newItems, RECENT_SCANS_KEY);
  };

  const handleRescan = async (scan: RecentScan) => {
    analytics.trackMyScansClickRescan(scan.upc);

    const normalizedBarcode = /^\d{12}$/.test(scan.upc) ? `0${scan.upc}` : scan.upc;
    const barcodes = Array.from(new Set([scan.upc, normalizedBarcode]));

    const { data: product } = await supabase
      .from("products")
      .select("id, barcode, name, brand_id, category")
      .in("barcode", barcodes)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let brand = scan.brand ?? null;

    if (product?.brand_id) {
      const { data: dbBrand } = await supabase
        .from("brands")
        .select("id, name, slug, status, logo_url, website, parent_company")
        .eq("id", product.brand_id)
        .maybeSingle();
      if (dbBrand) brand = dbBrand;
    }

    const resolvedScan: RecentScan = {
      ...scan,
      product_name: product?.name || scan.product_name,
      brand_name: brand?.name || scan.brand_name,
      product: product || scan.product || { barcode: scan.upc, name: scan.product_name, brand_id: brand?.id ?? null },
      brand,
    };

    if (brand?.id && (brand.status === "ready" || brand.status === "active")) {
      navigate(`/brand/${brand.slug || brand.id}`, {
        state: {
          ...buildHistoryNavigationState(resolvedScan),
          scannedBrandId: brand.id,
          scannedBrandName: brand.name,
        },
      });
      return;
    }

    navigate(`/scan-result/${scan.upc}`, {
      state: buildHistoryNavigationState(resolvedScan),
    });
  };

  const activeList = showArchive ? archived : items;

  if (!items.length && !archived.length) {
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
      <div className="flex items-center gap-2 mb-4">
        <Button
          size="sm"
          variant={!showArchive ? "default" : "outline"}
          onClick={() => setShowArchive(false)}
          className="flex items-center gap-1.5"
        >
          <Clock className="w-3.5 h-3.5" />
          Recent ({items.length})
        </Button>
        <Button
          size="sm"
          variant={showArchive ? "default" : "outline"}
          onClick={() => setShowArchive(true)}
          className="flex items-center gap-1.5"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          Archived ({archived.length})
        </Button>
        <div className="flex-1" />
        {!showArchive && items.length > 0 && (
          <Button size="sm" variant="ghost" onClick={handleArchiveAll} className="text-xs">
            Archive All
          </Button>
        )}
      </div>

      {activeList.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          {showArchive ? "No archived scans" : "No recent scans"}
        </div>
      )}

      {activeList.map((s, idx) => (
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
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium truncate">{s.product_name || "Unknown product"}</h3>
                    {(s.status === 'pending' || s.status === 'under_investigation' || s.status === 'created') && (
                      <span className="flex items-center gap-1 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full flex-shrink-0">
                        <AlertCircle className="w-3 h-3" />
                        Pending
                      </span>
                    )}
                  </div>
                  {s.brand_name && <p className="text-xs text-muted-foreground mt-0.5">{s.brand_name}</p>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-shrink-0">
                <Clock className="w-3.5 h-3.5" />
                <span>{formatDistanceToNow(new Date(s.timestamp), { addSuffix: true })}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex items-center justify-between pt-0 gap-2">
            <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">{s.upc}</code>
            <div className="flex items-center gap-2">
              {showArchive ? (
                <Button size="sm" variant="ghost" onClick={() => handleRestore(s.upc)} className="text-xs">
                  Restore
                </Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => handleArchive(s.upc)} title="Archive">
                  <Archive className="w-4 h-4" />
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={() => handleRescan(s)}>
                View Again
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
