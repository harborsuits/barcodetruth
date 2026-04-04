export type RecentScan = {
  upc: string;
  product_name: string;
  timestamp: number;
  brand_name?: string;
  status?: string;
  product?: {
    id?: string;
    barcode?: string;
    name?: string;
    brand_id?: string | null;
    category?: string | null;
  };
  brand?: {
    id?: string;
    name?: string;
    slug?: string | null;
    status?: string | null;
    logo_url?: string | null;
    website?: string | null;
    parent_company?: string | null;
  } | null;
};

export const RECENT_SCANS_KEY = "recent_scans";
export const ARCHIVED_SCANS_KEY = "archived_scans";

function normalizeScan(scan: RecentScan): RecentScan {
  return {
    ...scan,
    product: scan.product ?? {
      barcode: scan.upc,
      name: scan.product_name,
      brand_id: scan.brand?.id ?? null,
    },
    brand:
      scan.brand ??
      (scan.brand_name
        ? {
            name: scan.brand_name,
          }
        : null),
  };
}

export function readStoredScans(key = RECENT_SCANS_KEY): RecentScan[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map((scan) => normalizeScan(scan as RecentScan)) : [];
  } catch {
    return [];
  }
}

export function writeStoredScans(scans: RecentScan[], key = RECENT_SCANS_KEY) {
  localStorage.setItem(key, JSON.stringify(scans));
}

export function upsertStoredScan(entry: RecentScan, key = RECENT_SCANS_KEY, max = 20) {
  const normalized = normalizeScan(entry);
  const current = readStoredScans(key);
  const updated = [normalized, ...current.filter((scan) => scan.upc !== normalized.upc)].slice(0, max);
  writeStoredScans(updated, key);
  return updated;
}

export function buildHistoryNavigationState(scan: RecentScan) {
  const normalized = normalizeScan(scan);
  return {
    product: normalized.product,
    brand: normalized.brand,
    source: "history",
  };
}
