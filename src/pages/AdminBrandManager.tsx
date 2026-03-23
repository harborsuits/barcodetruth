import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, Loader2, Tags, FolderOpen, Search } from "lucide-react";

const ATTRIBUTE_TYPES = [
  "sustainable", "green", "local", "small_business", "b_corp",
  "unionized", "independent", "political_left", "political_right", "neutral",
] as const;

type FilterMode = "all" | "missing_category" | "missing_attributes" | "missing_both";

export default function AdminBrandManager() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<FilterMode>("missing_both");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkAttributes, setBulkAttributes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const { data: brands, isLoading, refetch } = useQuery({
    queryKey: ["admin-brand-manager", filter, searchTerm, page],
    queryFn: async () => {
      let query = supabase
        .from("brands")
        .select("id, name, slug, category_slug, logo_url, status")
        .eq("is_active", true)
        .order("name")
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (searchTerm) {
        query = query.ilike("name", `%${searchTerm}%`);
      }
      if (filter === "missing_category" || filter === "missing_both") {
        query = query.or("category_slug.is.null,category_slug.eq.");
      }

      const { data, error } = await query;
      if (error) throw error;

      // If filtering for missing attributes, fetch attribute counts
      if (data && (filter === "missing_attributes" || filter === "missing_both")) {
        const ids = data.map((b: any) => b.id);
        const { data: attrs } = await supabase
          .from("brand_attributes")
          .select("brand_id")
          .in("brand_id", ids);
        const brandsWithAttrs = new Set((attrs || []).map((a: any) => a.brand_id));
        return data.filter((b: any) => !brandsWithAttrs.has(b.id));
      }

      return data || [];
    },
    staleTime: 30_000,
  });

  const { data: categories } = useQuery({
    queryKey: ["brand-categories-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("brand_categories")
        .select("slug, name")
        .order("name");
      return data || [];
    },
  });

  const toggleBrand = (id: string) => {
    setSelectedBrands((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (!brands) return;
    if (selectedBrands.size === brands.length) {
      setSelectedBrands(new Set());
    } else {
      setSelectedBrands(new Set(brands.map((b: any) => b.id)));
    }
  };

  const applyBulkCategory = async () => {
    if (!bulkCategory || selectedBrands.size === 0) return;
    setSaving(true);
    try {
      const ids = Array.from(selectedBrands);
      for (const id of ids) {
        await supabase
          .from("brands")
          .update({ category_slug: bulkCategory } as any)
          .eq("id", id);
      }
      toast({ title: "Category applied", description: `Set category on ${ids.length} brands` });
      setSelectedBrands(new Set());
      refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const applyBulkAttributes = async () => {
    if (bulkAttributes.length === 0 || selectedBrands.size === 0) return;
    setSaving(true);
    try {
      const ids = Array.from(selectedBrands);
      const rows = ids.flatMap((brand_id) =>
        bulkAttributes.map((attr) => ({
          brand_id,
          attribute_type: attr,
          source: "admin_manual",
          confidence: 1.0,
        }))
      );
      const { error } = await supabase.from("brand_attributes").upsert(rows as any, {
        onConflict: "brand_id,attribute_type",
      });
      if (error) throw error;
      toast({ title: "Attributes applied", description: `Tagged ${ids.length} brands with ${bulkAttributes.length} attributes` });
      setSelectedBrands(new Set());
      setBulkAttributes([]);
      refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      const header = lines[0].toLowerCase();
      if (!header.includes("brand_slug")) {
        throw new Error("CSV must have columns: brand_slug, category_slug, attributes");
      }

      let updated = 0;
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim());
        const [brandSlug, categorySlug, ...attrCols] = cols;
        const attrs = attrCols.join(",").split(/[,;|]/).map((a) => a.trim()).filter(Boolean);

        // Find brand by slug
        const { data: brand } = await supabase
          .from("brands")
          .select("id")
          .eq("slug", brandSlug)
          .maybeSingle();

        if (!brand) continue;

        // Set category
        if (categorySlug) {
          await supabase
            .from("brands")
            .update({ category_slug: categorySlug } as any)
            .eq("id", brand.id);
        }

        // Set attributes
        if (attrs.length > 0) {
          const attrRows = attrs
            .filter((a) => ATTRIBUTE_TYPES.includes(a as any))
            .map((a) => ({
              brand_id: brand.id,
              attribute_type: a,
              source: "csv_import",
              confidence: 0.9,
            }));
          if (attrRows.length > 0) {
            await supabase.from("brand_attributes").upsert(attrRows as any, {
              onConflict: "brand_id,attribute_type",
            });
          }
        }
        updated++;
      }

      toast({ title: "CSV Import Complete", description: `Updated ${updated} brands from ${lines.length - 1} rows` });
      refetch();
    } catch (err: any) {
      toast({ title: "Import Failed", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Brand Category & Attribute Manager</h1>
            <p className="text-sm text-muted-foreground">
              Assign categories and attributes to brands for alternatives matching
            </p>
          </div>
        </div>

        {/* Filters & Bulk Actions */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="h-4 w-4" /> Filter Brands
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Search by name…"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
              />
              <Select value={filter} onValueChange={(v) => { setFilter(v as FilterMode); setPage(0); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All active brands</SelectItem>
                  <SelectItem value="missing_category">Missing category</SelectItem>
                  <SelectItem value="missing_attributes">Missing attributes</SelectItem>
                  <SelectItem value="missing_both">Missing category OR attributes</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4" /> CSV Import
              </CardTitle>
              <CardDescription>Columns: brand_slug, category_slug, attributes (comma-separated)</CardDescription>
            </CardHeader>
            <CardContent>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleCSVImport}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="w-full"
              >
                {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                {importing ? "Importing…" : "Upload CSV"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Bulk Actions */}
        {selectedBrands.size > 0 && (
          <Card className="border-primary/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="secondary">{selectedBrands.size} selected</Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Set Category</Label>
                  <div className="flex gap-2">
                    <Select value={bulkCategory} onValueChange={setBulkCategory}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Pick category" /></SelectTrigger>
                      <SelectContent>
                        {(categories || []).map((c: any) => (
                          <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" onClick={applyBulkCategory} disabled={!bulkCategory || saving}>
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <FolderOpen className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Apply Attributes</Label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {ATTRIBUTE_TYPES.map((attr) => (
                      <Badge
                        key={attr}
                        variant={bulkAttributes.includes(attr) ? "default" : "outline"}
                        className="cursor-pointer text-xs"
                        onClick={() =>
                          setBulkAttributes((prev) =>
                            prev.includes(attr) ? prev.filter((a) => a !== attr) : [...prev, attr]
                          )
                        }
                      >
                        {attr.replace(/_/g, " ")}
                      </Badge>
                    ))}
                  </div>
                  <Button size="sm" onClick={applyBulkAttributes} disabled={bulkAttributes.length === 0 || saving}>
                    <Tags className="h-3 w-3 mr-1" /> Apply Tags
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Brand List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Brands {brands ? `(${brands.length})` : ""}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={selectAll}>
                {brands && selectedBrands.size === brands.length ? "Deselect All" : "Select All"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-40 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !brands?.length ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No brands match your filter. Try adjusting your search.
              </p>
            ) : (
              <div className="space-y-1">
                {brands.map((brand: any) => (
                  <div
                    key={brand.id}
                    className="flex items-center gap-3 py-2 px-2 rounded hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleBrand(brand.id)}
                  >
                    <Checkbox checked={selectedBrands.has(brand.id)} />
                    {brand.logo_url && (
                      <img src={brand.logo_url} alt="" className="h-6 w-6 rounded object-contain" />
                    )}
                    <span className="text-sm font-medium flex-1">{brand.name}</span>
                    {brand.category_slug ? (
                      <Badge variant="secondary" className="text-xs">{brand.category_slug}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-orange-500 border-orange-500/30">no category</Badge>
                    )}
                    <Badge variant="outline" className="text-xs">{brand.status}</Badge>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">Page {page + 1}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={!brands || brands.length < PAGE_SIZE}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
