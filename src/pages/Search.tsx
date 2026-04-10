import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search as SearchIcon, Package, Building2, Tag, ShieldCheck, ShieldAlert, ShieldX, Clock, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyStateExplainer } from "@/components/EmptyStateExplainer";
import { searchCatalog, type ProductSearchResult, type BrandSearchResult } from "@/lib/searchCatalog";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";
import { toast } from "sonner";
import { formatCategory } from "@/lib/formatCategory";

interface CompanySearchResult {
  id: string;
  name: string;
  country: string | null;
  brand_count: number;
}

interface BrandScore {
  brand_id: string;
  score: number;
}

// --- Verdict logic (same thresholds as LiveScanDemo) ---
function getVerdict(score: number | null) {
  if (score === null) return { label: "Analyzing", icon: Clock, className: "text-muted-foreground", bg: "bg-muted/50" };
  if (score >= 65) return { label: "Good", icon: ShieldCheck, className: "text-success", bg: "bg-success/10" };
  if (score >= 40) return { label: "Mixed", icon: ShieldAlert, className: "text-warning", bg: "bg-warning/10" };
  return { label: "Avoid", icon: ShieldX, className: "text-destructive", bg: "bg-destructive/10" };
}

// --- Product grouping helpers ---
const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

interface ProductGroup {
  name: string;
  category?: string;
  brand_id?: string;
  count: number;
  firstBarcode: string;
  barcodes: string[];
}

function groupProducts(products: ProductSearchResult[]): ProductGroup[] {
  const map = new Map<string, ProductGroup>();
  for (const p of products) {
    const key = normalize(p.name) + '|' + (p.brand_id || '');
    const existing = map.get(key);
    if (existing) {
      existing.count++;
      existing.barcodes.push(p.barcode);
    } else {
      map.set(key, {
        name: p.name,
        category: p.category,
        brand_id: p.brand_id,
        count: 1,
        firstBarcode: p.barcode,
        barcodes: [p.barcode],
      });
    }
  }
  return Array.from(map.values());
}

// --- XSS protection ---
const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] || m)
  );

const highlightMatch = (name: string, q: string) => {
  const escapedName = escapeHtml(name);
  if (!q.trim()) return escapedName;
  const escapedQuery = escapeHtml(q);
  const regex = new RegExp(`(${escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return escapedName.replace(regex, '<mark class="bg-primary/20">$1</mark>');
};

// --- Verdict badge component (fixed-size to prevent layout shift) ---
function VerdictBadge({ score, loading }: { score: number | null; loading: boolean }) {
  return (
    <div className="min-w-[80px] h-[28px] flex items-center justify-center">
      {loading ? (
        <div className="h-5 w-16 bg-muted animate-pulse rounded-full" />
      ) : score !== null ? (
        (() => {
          const v = getVerdict(score);
          const Icon = v.icon;
          return (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${v.bg} ${v.className}`}>
              <Icon className="h-3 w-3" />
              {v.label}
            </span>
          );
        })()
      ) : null}
    </div>
  );
}

// --- Featured brand card ---
function FeaturedBrandCard({ brand, score, loading, onClick }: {
  brand: BrandSearchResult;
  score: number | null;
  loading: boolean;
  onClick: () => void;
}) {
  const v = getVerdict(score);
  const Icon = v.icon;
  return (
    <Card
      className="cursor-pointer border-2 border-primary/20 hover:border-primary/40 transition-colors mb-4"
      onClick={onClick}
      role="button"
      aria-label={`View ${brand.name} brand profile`}
    >
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${v.bg}`}>
              {loading ? <Skeleton className="h-5 w-5 rounded-full" /> : <Icon className={`h-5 w-5 ${v.className}`} />}
            </div>
            <div>
              <div className="font-semibold text-lg">{brand.name}</div>
              {brand.parent_company && (
                <div className="text-sm text-muted-foreground">by {brand.parent_company}</div>
              )}
            </div>
          </div>
          <VerdictBadge score={score} loading={loading} />
        </div>
        {!loading && score !== null && (
          <div className="text-sm text-muted-foreground mt-1">
            Score: {Math.round(score)}/100
          </div>
        )}
        <div className="text-xs text-muted-foreground/70 mt-2">
          This applies to all products from this brand
        </div>
        <div className="flex items-center gap-1 mt-3 text-sm text-primary font-medium">
          View full breakdown <ArrowRight className="h-3.5 w-3.5" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Search() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<ProductSearchResult[]>([]);
  const [brands, setBrands] = useState<BrandSearchResult[]>([]);
  const [companies, setCompanies] = useState<CompanySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<"brands" | "products" | "companies">("brands");
  const [brandScores, setBrandScores] = useState<Map<string, number>>(new Map());
  const [scoresLoading, setScoresLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 300);
  const urlTabSet = useRef(false);

  // URL sync on mount
  useEffect(() => {
    const q = searchParams.get('q') || '';
    const tab = searchParams.get('tab') as "brands" | "products" | "companies" | null;
    if (q) setQuery(q);
    if (tab) {
      setActiveTab(tab);
      urlTabSet.current = true;
    }
  }, []);

  // Update URL when query or tab changes
  useEffect(() => {
    const params: any = {};
    if (query) params.q = query;
    if (activeTab !== "brands") params.tab = activeTab;
    setSearchParams(params, { replace: true });
  }, [query, activeTab, setSearchParams]);

  // Perform search when debounced query changes
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setProducts([]);
      setBrands([]);
      setCompanies([]);
      setBrandScores(new Map());
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    Promise.all([
      searchCatalog(debouncedQuery),
      searchCompanies(debouncedQuery),
    ])
      .then(([catalogResults, companyResults]) => {
        setProducts(catalogResults.products);
        setBrands(catalogResults.brands);
        setCompanies(companyResults);

        // Auto-select brands tab when brand results exist (unless URL specified tab)
        if (!urlTabSet.current && catalogResults.brands.length > 0) {
          setActiveTab("brands");
        } else if (!urlTabSet.current && catalogResults.brands.length === 0 && catalogResults.products.length > 0) {
          setActiveTab("products");
        }
        urlTabSet.current = false;
      })
      .catch(error => {
        console.error("Search error:", error);
        toast.error("Search failed. Please try again.");
      })
      .finally(() => {
        setIsSearching(false);
      });
  }, [debouncedQuery]);

  // Fetch brand scores after brands arrive
  useEffect(() => {
    if (brands.length === 0) {
      setBrandScores(new Map());
      return;
    }
    const brandIds = brands.map(b => b.id);
    setScoresLoading(true);
    supabase
      .from("brand_scores")
      .select("brand_id, score")
      .in("brand_id", brandIds)
      .then(({ data, error }) => {
        if (!error && data) {
          const map = new Map<string, number>();
          for (const row of data as unknown as BrandScore[]) {
            map.set(row.brand_id, row.score);
          }
          setBrandScores(map);
        }
        setScoresLoading(false);
      });
  }, [brands]);

  // Group products for display
  const groupedProducts = useMemo(() => groupProducts(products), [products]);

  const totalResults = products.length + brands.length + companies.length;
  const showFeatured = brands.length === 1 && totalResults > 0;

  return (
    <div className="min-h-screen bg-background">
      <main className="container max-w-2xl mx-auto px-4 py-6">
        <div className="mb-6 relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="search"
            placeholder="Search products, brands, and companies..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            autoFocus
          />
        </div>

        {isSearching && (
          <div className="text-center py-8 text-muted-foreground">Searching...</div>
        )}

        {!isSearching && query && totalResults === 0 && (
          <EmptyStateExplainer type="search-no-results" searchQuery={query} />
        )}

        {!isSearching && !query && (
          <div className="text-center py-8 space-y-2">
            <p className="text-muted-foreground">Start typing to search for products, brands, and companies</p>
            <p className="text-xs text-muted-foreground/70">Not all products are indexed yet — we're growing daily</p>
          </div>
        )}

        {!isSearching && totalResults > 0 && (
          <>
            {/* Featured brand card when exactly one brand result */}
            {showFeatured && (
              <FeaturedBrandCard
                brand={brands[0]}
                score={brandScores.get(brands[0].id) ?? null}
                loading={scoresLoading}
                onClick={() => navigate(`/brand/${brands[0].id}`)}
              />
            )}

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="brands">
                  <Tag className="h-3.5 w-3.5 mr-1" />
                  Brands ({brands.length})
                </TabsTrigger>
                <TabsTrigger value="products">
                  <Package className="h-3.5 w-3.5 mr-1" />
                  Products ({groupedProducts.length})
                </TabsTrigger>
                <TabsTrigger value="companies">
                  <Building2 className="h-3.5 w-3.5 mr-1" />
                  Companies ({companies.length})
                </TabsTrigger>
              </TabsList>

              {/* Brands tab */}
              <TabsContent value="brands" className="space-y-2 max-h-[70vh] overflow-y-auto">
                {brands.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No brands found</div>
                ) : (
                  brands.map((brand) => (
                    <Card
                      key={brand.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => navigate(`/brand/${brand.id}`)}
                      role="button"
                      aria-label={`View ${brand.name} brand profile`}
                    >
                      <CardContent className="pt-4 pb-3">
                        <div className="flex items-start gap-3">
                          <Tag className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div
                                className="font-medium"
                                dangerouslySetInnerHTML={{ __html: highlightMatch(brand.name, query) }}
                              />
                              <VerdictBadge
                                score={brandScores.get(brand.id) ?? null}
                                loading={scoresLoading}
                              />
                            </div>
                            {brand.parent_company && (
                              <div className="text-sm text-muted-foreground mt-1">
                                Parent: {brand.parent_company}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              {/* Products tab — deduplicated */}
              <TabsContent value="products" className="space-y-2 max-h-[70vh] overflow-y-auto">
                {groupedProducts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No products found</div>
                ) : (
                  groupedProducts.map((group) => (
                    <Card
                      key={group.firstBarcode}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => navigate(`/scan-result/${group.firstBarcode}`)}
                      role="button"
                      aria-label={`View ${group.name}`}
                    >
                      <CardContent className="pt-4 pb-3">
                        <div className="flex items-start gap-3">
                          <Package className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div
                              className="font-medium"
                              dangerouslySetInnerHTML={{ __html: highlightMatch(group.name, query) }}
                            />
                            <div className="flex items-center gap-2 mt-1">
                              {formatCategory(group.category) && (
                                <span className="text-sm text-muted-foreground">
                                  {formatCategory(group.category)}
                                </span>
                              )}
                              {group.count > 1 && (
                                <span className="text-xs text-muted-foreground/70">
                                  • {group.count} sizes &amp; packages
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              {/* Companies tab */}
              <TabsContent value="companies" className="space-y-2 max-h-[70vh] overflow-y-auto">
                {companies.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No companies found</div>
                ) : (
                  companies.map((company) => (
                    <Card
                      key={company.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => navigate(`/search?q=${encodeURIComponent(company.name)}&tab=brands`)}
                      role="button"
                      aria-label={`View ${company.name}`}
                    >
                      <CardContent className="pt-4 pb-3">
                        <div className="flex items-start gap-3">
                          <Building2 className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div
                              className="font-medium"
                              dangerouslySetInnerHTML={{ __html: highlightMatch(company.name, query) }}
                            />
                            <div className="flex items-center gap-2 mt-1">
                              {company.country && (
                                <span className="text-sm text-muted-foreground">{company.country}</span>
                              )}
                              {company.brand_count > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  {company.brand_count} brand{company.brand_count !== 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
}

async function searchCompanies(q: string): Promise<CompanySearchResult[]> {
  if (!q.trim()) return [];
  try {
    const { data, error } = await supabase
      .from("companies" as any)
      .select("id, name, country")
      .ilike("name", `%${q}%`)
      .limit(10);
    if (error) throw error;
    return ((data || []) as unknown as { id: string; name: string; country: string | null }[]).map(c => ({
      ...c,
      brand_count: 0,
    }));
  } catch {
    return [];
  }
}
