import { Search, ScanLine } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export function HeroSection() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/brand/${searchQuery.toLowerCase()}`);
    }
  };

  return (
    <section className="py-12 px-4">
      <div className="max-w-2xl mx-auto text-center space-y-6">
        <div className="space-y-3">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Barcode Truth
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Evidence-backed brand scores from EPA, OSHA, FEC, and archived articles. Every change is cited.
          </p>
        </div>

        <form onSubmit={handleSearch} className="space-y-3 max-w-md mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search for any brand..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-base"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="submit"
              className="flex-1 h-11"
              disabled={!searchQuery.trim()}
            >
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-11"
              onClick={() => navigate("/scan")}
            >
              <ScanLine className="mr-2 h-4 w-4" />
              Scan Barcode
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}
