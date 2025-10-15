import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Brand {
  id: string;
  name: string;
}

export default function AdminEvidence() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  
  const [formData, setFormData] = useState({
    title: "",
    source_url: "",
    verification: "unverified" as "official" | "corroborated" | "unverified",
    category: "labor" as "labor" | "environment" | "politics" | "social",
    event_date: new Date().toISOString().split('T')[0],
    notes: ""
  });

  const searchBrands = async (query: string) => {
    if (query.length < 2) {
      setBrands([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("brands")
        .select("id, name")
        .ilike("name", `%${query}%`)
        .limit(10);

      if (error) throw error;
      setBrands(data || []);
    } catch (error: any) {
      console.error("Brand search error:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedBrand) {
      toast({ title: "Error", description: "Please select a brand", variant: "destructive" });
      return;
    }

    if (!formData.title.trim() || !formData.source_url.trim()) {
      toast({ title: "Error", description: "Title and source URL are required", variant: "destructive" });
      return;
    }

    // Basic URL validation
    try {
      new URL(formData.source_url);
    } catch {
      toast({ title: "Error", description: "Please enter a valid URL", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.rpc('admin_add_evidence', {
        p_brand_id: selectedBrand.id,
        p_title: formData.title.trim(),
        p_source_url: formData.source_url.trim(),
        p_verification: formData.verification,
        p_category: formData.category,
        p_event_date: formData.event_date,
        p_notes: formData.notes.trim() || null
      });

      if (error) throw error;

      toast({
        title: "Evidence added",
        description: "Event created and coverage refreshed"
      });

      // Navigate to brand profile
      navigate(`/brand/${selectedBrand.id}`);
    } catch (error: any) {
      console.error("Error adding evidence:", error);
      toast({
        title: "Failed to add evidence",
        description: error.message || "An error occurred",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Add Evidence</h1>
            <p className="text-sm text-muted-foreground">Submit new brand event with source</p>
          </div>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>New Evidence</CardTitle>
            <CardDescription>
              Add a brand event with supporting source. Coverage stats will refresh automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Brand Search */}
              <div className="space-y-2">
                <Label htmlFor="brand-search">Brand</Label>
                <Input
                  id="brand-search"
                  placeholder="Search brands..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    searchBrands(e.target.value);
                  }}
                  disabled={loading}
                />
                {brands.length > 0 && !selectedBrand && (
                  <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                    {brands.map((brand) => (
                      <button
                        key={brand.id}
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-muted text-sm"
                        onClick={() => {
                          setSelectedBrand(brand);
                          setSearchQuery(brand.name);
                          setBrands([]);
                        }}
                      >
                        {brand.name}
                      </button>
                    ))}
                  </div>
                )}
                {selectedBrand && (
                  <div className="text-sm text-muted-foreground">
                    Selected: <span className="font-medium">{selectedBrand.name}</span>
                  </div>
                )}
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Event Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., EPA violation for water pollution"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  disabled={loading}
                  required
                />
              </div>

              {/* Source URL */}
              <div className="space-y-2">
                <Label htmlFor="source_url">Source URL *</Label>
                <Input
                  id="source_url"
                  type="url"
                  placeholder="https://example.com/article"
                  value={formData.source_url}
                  onChange={(e) => setFormData({ ...formData, source_url: e.target.value })}
                  disabled={loading}
                  required
                />
              </div>

              {/* Verification */}
              <div className="space-y-2">
                <Label htmlFor="verification">Verification Level</Label>
                <Select
                  value={formData.verification}
                  onValueChange={(value: any) => setFormData({ ...formData, verification: value })}
                  disabled={loading}
                >
                  <SelectTrigger id="verification">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="official">Official</SelectItem>
                    <SelectItem value="corroborated">Corroborated</SelectItem>
                    <SelectItem value="unverified">Unverified</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value: any) => setFormData({ ...formData, category: value })}
                  disabled={loading}
                >
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="labor">Labor</SelectItem>
                    <SelectItem value="environment">Environment</SelectItem>
                    <SelectItem value="politics">Politics</SelectItem>
                    <SelectItem value="social">Social</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Event Date */}
              <div className="space-y-2">
                <Label htmlFor="event_date">Event Date</Label>
                <Input
                  id="event_date"
                  type="date"
                  value={formData.event_date}
                  onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                  disabled={loading}
                  required
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional context or details..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  disabled={loading}
                  rows={3}
                />
              </div>

              <Button type="submit" disabled={loading || !selectedBrand} className="w-full">
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2" />
                    Adding Evidence...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Evidence
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
