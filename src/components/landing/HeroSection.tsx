import { Search, ScanLine } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/logo.png";
export function HeroSection() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };
  return <section className="py-12 px-4">
      <div className="max-w-2xl mx-auto text-center space-y-6">
        <div className="space-y-3">
          <img src={logo} alt="Barcode Truth" className="h-40 w-auto mx-auto" />
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">Discover Who Really Owns What You Buy</p>
        </div>

        <form onSubmit={handleSearch} className="space-y-3 max-w-md mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input type="text" placeholder="Search for any brand..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 h-12 text-base" />
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1 h-11" disabled={!searchQuery.trim()}>
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
            <Button type="button" variant="outline" className="flex-1 h-11" onClick={() => navigate("/scan")}>
              <ScanLine className="mr-2 h-4 w-4" />
              Scan Barcode
            </Button>
          </div>
        </form>
      </div>
    </section>;
}