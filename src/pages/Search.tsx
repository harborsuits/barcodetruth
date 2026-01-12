import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search as SearchIcon, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyStateExplainer } from "@/components/EmptyStateExplainer";
import { searchCatalog, type ProductSearchResult, type BrandSearchResult } from "@/lib/searchCatalog";
import { useDebounce } from "@/hooks/useDebounce";
import { toast } from "sonner";

export default function Search() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<ProductSearchResult[]>([]);
  const [brands, setBrands] = useState<BrandSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<"products" | "brands">("products");
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  // URL sync on mount
  useEffect(() => {
    const q = searchParams.get('q') || '';
    const tab = searchParams.get('tab') as "products" | "brands" | null;
    if (q) setQuery(q);
    if (tab) setActiveTab(tab);
  }, []);

  // Update URL when query or tab changes
  useEffect(() => {
    const params: any = {};
    if (query) params.q = query;
    if (activeTab !== "products") params.tab = activeTab;
    setSearchParams(params, { replace: true });
  }, [query, activeTab, setSearchParams]);

  // Perform search when debounced query changes
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setProducts([]);
      setBrands([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchCatalog(debouncedQuery)
      .then(response => {
        setProducts(response.products);
        setBrands(response.brands);
      })
      .catch(error => {
        console.error("Search error:", error);
        toast.error("Search failed. Please try again.");
      })
      .finally(() => {
        setIsSearching(false);
      });
  }, [debouncedQuery]);

  // XSS protection: escape HTML entities before highlighting
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

  const totalResults = products.length + brands.length;

  return (
    <div className="min-h-screen bg-background">
      <main className="container max-w-2xl mx-auto px-4 py-6">
        <div className="mb-6 relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="search"
            placeholder="Search products and brands..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            autoFocus
          />
        </div>
        {isSearching && (
          <div className="text-center py-8 text-muted-foreground">
            Searching...
          </div>
        )}

        {!isSearching && query && totalResults === 0 && (
          <EmptyStateExplainer 
            type="search-no-results" 
            searchQuery={query}
          />
        )}

        {!isSearching && !query && (
          <div className="text-center py-8 space-y-2">
            <p className="text-muted-foreground">
              Start typing to search for products and brands
            </p>
            <p className="text-xs text-muted-foreground/70">
              Not all products are indexed yet — we're growing daily
            </p>
          </div>
        )}

        {!isSearching && totalResults > 0 && (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "products" | "brands")}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="products">
                Products ({products.length})
              </TabsTrigger>
              <TabsTrigger value="brands">
                Brands ({brands.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="products" className="space-y-2 max-h-[70vh] overflow-y-auto">
              {products.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No products found
                </div>
              ) : (
                products.map((product) => (
                  <Card 
                    key={product.id} 
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => {
                      navigate(`/scan?upc=${product.barcode}`);
                      // Prefetch scan function to reduce cold-start latency
                      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scan-product`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
                        body: JSON.stringify({ upc: '00000000' })
                      }).catch(() => {});
                    }}
                    role="button"
                    aria-label={`View ${product.name}`}
                  >
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-start gap-3">
                        <Package className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div 
                            className="font-medium" 
                            dangerouslySetInnerHTML={{ __html: highlightMatch(product.name, query) }}
                          />
                          {product.category && (
                            <div className="text-sm text-muted-foreground mt-1">
                              {product.category}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground mt-1 font-mono">
                            {product.barcode}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="brands" className="space-y-2 max-h-[70vh] overflow-y-auto">
              {brands.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No brands found
                </div>
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
                      <div 
                        className="font-medium" 
                        dangerouslySetInnerHTML={{ __html: highlightMatch(brand.name, query) }}
                      />
                      {brand.parent_company && (
                        <div className="text-sm text-muted-foreground mt-1">
                          Parent: {brand.parent_company}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
