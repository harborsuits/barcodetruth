import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LogoDisplay } from "@/components/LogoDisplay";
import { ShieldCheck, ShieldAlert, ShieldX, Clock, ArrowRight, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface DemoBrand {
  id: string;
  name: string;
  logo_url: string | null;
  website: string | null;
  score: number | null;
  topReason: string | null;
  eventCount: number;
}

// Curated brand IDs — replace with real IDs of brands that have differentiated scores
const DEMO_BRAND_NAMES = ["Nestlé", "Nike", "Patagonia"];

function getVerdict(score: number | null) {
  if (score === null) return { label: "Analyzing", icon: Clock, className: "text-muted-foreground", bg: "bg-muted/50" };
  if (score >= 65) return { label: "Good", icon: ShieldCheck, className: "text-success", bg: "bg-success/10" };
  if (score >= 40) return { label: "Mixed", icon: ShieldAlert, className: "text-warning", bg: "bg-warning/10" };
  return { label: "Avoid", icon: ShieldX, className: "text-destructive", bg: "bg-destructive/10" };
}

export function LiveScanDemo() {
  const navigate = useNavigate();
  const [brands, setBrands] = useState<DemoBrand[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDemoBrands();
  }, []);

  const loadDemoBrands = async () => {
    try {
      // Find brands by name that have scores
      const { data: brandData } = await supabase
        .from("brands")
        .select("id, name, logo_url, website")
        .in("name", DEMO_BRAND_NAMES)
        .eq("is_active", true)
        .limit(3);

      if (!brandData?.length) {
        // Fallback: grab top 3 scored brands
        const { data: fallback } = await supabase
          .from("brand_scores")
          .select("brand_id, score")
          .not("score", "is", null)
          .order("score", { ascending: false })
          .limit(3);

        if (fallback?.length) {
          const ids = fallback.map(f => f.brand_id);
          const { data: fb } = await supabase
            .from("brands")
            .select("id, name, logo_url, website")
            .in("id", ids);

          if (fb) {
            const scoreMap = Object.fromEntries(fallback.map(f => [f.brand_id, f.score]));
            setBrands(fb.map(b => ({
              id: b.id,
              name: b.name,
              logo_url: b.logo_url,
              website: b.website,
              score: scoreMap[b.id] ?? null,
              topReason: null,
              eventCount: 0,
            })));
          }
        }
        setLoading(false);
        return;
      }

      const brandIds = brandData.map(b => b.id);

      // Fetch scores and top event reason in parallel
      const [scoresRes, eventsRes] = await Promise.all([
        supabase
          .from("brand_scores")
          .select("brand_id, score")
          .in("brand_id", brandIds),
        supabase
          .from("brand_events")
          .select("brand_id, description, category")
          .in("brand_id", brandIds)
          .eq("is_irrelevant", false)
          .eq("is_test", false)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      const scoreMap = Object.fromEntries(
        (scoresRes.data || []).map(s => [s.brand_id, s.score])
      );

      // Get first relevant event per brand as top reason
      const reasonMap: Record<string, string> = {};
      for (const evt of eventsRes.data || []) {
        if (!reasonMap[evt.brand_id] && evt.description) {
          // Truncate long descriptions
          reasonMap[evt.brand_id] = evt.description.length > 80 
            ? evt.description.slice(0, 77) + "…" 
            : evt.description;
        }
      }

      // Count events per brand
      const countMap: Record<string, number> = {};
      for (const evt of eventsRes.data || []) {
        countMap[evt.brand_id] = (countMap[evt.brand_id] || 0) + 1;
      }

      setBrands(brandData.map(b => ({
        id: b.id,
        name: b.name,
        logo_url: b.logo_url,
        website: b.website,
        score: scoreMap[b.id] ?? null,
        topReason: reasonMap[b.id] || null,
        eventCount: countMap[b.id] || 0,
      })));
    } catch (e) {
      console.error("LiveScanDemo load error", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <section className="space-y-3">
        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">See it in action</div>
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </section>
    );
  }

  if (!brands.length) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">See it in action</h2>
      </div>

      <div className="space-y-2">
        {brands.map(brand => {
          const verdict = getVerdict(brand.score);
          const Icon = verdict.icon;

          return (
            <div
              key={brand.id}
              className={`group ${verdict.bg} border border-border rounded-lg p-4 cursor-pointer transition-all duration-150 hover:border-primary/30`}
              onClick={() => navigate(`/brand/${brand.id}`)}
            >
              <div className="flex items-center gap-3">
                <LogoDisplay
                  logoUrl={brand.logo_url}
                  website={brand.website}
                  brandName={brand.name}
                  size="sm"
                />

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">{brand.name}</h3>
                  {brand.topReason && (
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {brand.topReason}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-right">
                    <div className="flex items-center gap-1.5">
                      <Icon className={`h-4 w-4 ${verdict.className}`} />
                      <span className={`text-sm font-bold ${verdict.className}`}>
                        {verdict.label}
                      </span>
                    </div>
                    {brand.score !== null && (
                      <span className="text-xs text-muted-foreground">
                        {Math.round(brand.score)}/100
                      </span>
                    )}
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
