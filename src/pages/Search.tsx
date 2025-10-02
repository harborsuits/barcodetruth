import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search as SearchIcon, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { searchBrands } from "@/lib/searchBrands";
import { toast } from "sonner";

export default function Search() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ id: string; name: string; parent_company: string | null }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const acRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // URL sync on mount
  useEffect(() => {
    const q = searchParams.get('q') || '';
    if (q) {
      setQuery(q);
      handleSearch(q);
    }
  }, []);

  // Update URL when query changes
  useEffect(() => {
    if (query) {
      setSearchParams({ q: query }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }, [query, setSearchParams]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, -1));
      } else if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault();
        navigate(`/brands/${results[selectedIndex].id}`);
      } else if (e.key === 'Escape') {
        setQuery('');
        setResults([]);
        setSelectedIndex(-1);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, results, navigate]);

  const handleSearch = (q: string) => {
    setQuery(q);
    if (acRef.current) acRef.current.abort();
    if (!q.trim()) {
      setResults([]);
      setSelectedIndex(-1);
      return;
    }
    acRef.current = new AbortController();
    clearTimeout((handleSearch as any)._t);
    (handleSearch as any)._t = setTimeout(async () => {
      setIsSearching(true);
      try {
        const brands = await searchBrands(q);
        setResults(brands);
        setSelectedIndex(-1);
      } catch (error: any) {
        if (error?.name !== 'AbortError') {
          console.error("Search error:", error);
          toast.error("Search failed. Please try again.");
        }
      } finally {
        setIsSearching(false);
      }
    }, 250);
  };

  const highlightMatch = (name: string, q: string) => {
    if (!q.trim()) return name;
    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return name.replace(regex, '<mark class="bg-primary/20">$1</mark>');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b">
        <div className="container max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                type="search"
                placeholder="Search brands..."
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                autoFocus
              />
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-6">
        {isSearching && (
          <div className="text-center py-8 text-muted-foreground">
            Searching...
          </div>
        )}

        {!isSearching && query && results.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No brands found for "{query}"
          </div>
        )}

        {!isSearching && !query && (
          <div className="text-center py-8 text-muted-foreground">
            Start typing to search for brands
          </div>
        )}

        {!isSearching && results.length > 0 && (
          <div className="space-y-2 max-h-[70vh] overflow-y-auto">
            {results.map((brand, idx) => (
              <Card 
                key={brand.id} 
                className={`cursor-pointer hover:bg-muted/50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                  selectedIndex === idx ? 'bg-muted/50 ring-2 ring-primary' : ''
                }`}
                onClick={() => navigate(`/brands/${brand.id}`)}
                tabIndex={0}
                role="button"
                aria-label={`${brand.name}${brand.parent_company ? `, parent company: ${brand.parent_company}` : ''}`}
              >
                <CardContent className="pt-4 pb-3">
                  <div 
                    className="font-medium" 
                    dangerouslySetInnerHTML={{ __html: highlightMatch(brand.name, query) }}
                  />
                  {brand.parent_company && (
                    <div className="text-sm text-muted-foreground">
                      Parent: {brand.parent_company}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
