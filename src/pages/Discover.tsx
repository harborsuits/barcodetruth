import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search as SearchIcon, ArrowLeft, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { BrandExplanationCard } from "@/components/BrandExplanationCard";
import { TrendingList } from "@/components/TrendingList";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/useDebounce";

const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

interface BrandData {
  brand_id: string;
  name: string;
  parent_company: string | null;
  score: number | null;
  score_confidence: number | null;
  last_event_at: string | null;
  verified_rate: number | null;
  independent_sources: number | null;
  events_7d: number | null;
  events_30d: number | null;
  events_365d: number | null;
  ai_summary_md: string | null;
  evidence: Array<{
    title: string;
    url: string;
    source_name: string | null;
  }>;
}

export default function Discover() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [trending, setTrending] = useState<any[]>([]);
  const [brand, setBrand] = useState<BrandData | null>(null);
  const [searchBrands, setSearchBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 400);

  // Load trending brands on mount
  useEffect(() => {
    fetchTrending();
  }, []);

  // Search when debounced query changes
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setSearchBrands([]);
      return;
    }
    doSearch(debouncedQuery);
  }, [debouncedQuery]);

  async function fetchTrending() {
    setLoadingTrending(true);
    try {
      const response = await fetch(`${API_BASE}/v1-brands/trending?limit=25`, {
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch trending');
      const data = await response.json();
      setTrending(data || []);
    } catch (error) {
      console.error("Trending fetch error:", error);
      toast.error("Failed to load trending brands");
    } finally {
      setLoadingTrending(false);
    }
  }

  async function doSearch(q: string) {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/v1-brands/search?q=${encodeURIComponent(q)}`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          }
        }
      );
      
      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      setSearchBrands(data?.brands || []);
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function openBrand(id: string) {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/v1-brands/brands/${id}`, {
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        }
      });
      
      if (!response.ok) throw new Error('Failed to load brand');
      const data = await response.json();
      setBrand(data);
    } catch (error) {
      console.error("Brand fetch error:", error);
      toast.error("Failed to load brand details");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b">
        <div className="container max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Discover Brands</h1>
          </div>
        </div>
      </header>

      <main className="container max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Sidebar - Search & Trending */}
          <div className="lg:col-span-1 space-y-6">
            {/* Search */}
            <Card>
              <CardContent className="p-4">
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search brands..."
                    className="pl-9"
                    autoFocus
                  />
                </div>
              </CardContent>
            </Card>

            {/* Search Results */}
            {query && searchBrands.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3 px-1">
                  Search Results ({searchBrands.length})
                </h3>
                <TrendingList
                  items={searchBrands.map((b: any) => ({
                    brand_id: b.id,
                    name: b.name,
                    trend_score: 0,
                    last_event_at: null,
                    score: null,
                    events_7d: null,
                    events_30d: null,
                  }))}
                  onOpen={openBrand}
                />
              </div>
            )}

            {/* Trending */}
            <div>
              <h3 className="text-sm font-semibold mb-3 px-1 flex items-center gap-2">
                <span>Trending Now</span>
                {loadingTrending && <Loader2 className="h-3 w-3 animate-spin" />}
              </h3>
              {loadingTrending ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Loading trending brands...
                  </CardContent>
                </Card>
              ) : (
                <TrendingList items={trending} onOpen={openBrand} />
              )}
            </div>
          </div>

          {/* Main Content - Brand Details */}
          <div className="lg:col-span-2">
            {loading && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                  <p className="text-muted-foreground mt-4">Loading brand details...</p>
                </CardContent>
              </Card>
            )}

            {!loading && !brand && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <p className="text-lg">Select a brand to see its details</p>
                  <p className="text-sm mt-2">
                    Search above or choose from trending brands
                  </p>
                </CardContent>
              </Card>
            )}

            {!loading && brand && (
              <BrandExplanationCard data={brand} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
