import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SisterBrandsCardProps {
  brandId: string;
  parentCompanyId: string | null;
}

export function SisterBrandsCard({ brandId, parentCompanyId }: SisterBrandsCardProps) {
  const navigate = useNavigate();

  const { data: sisterBrands } = useQuery({
    queryKey: ["sister-brands", parentCompanyId],
    enabled: !!parentCompanyId,
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("id, name, slug, logo_url")
        .eq("parent_company_id", parentCompanyId!)
        .neq("id", brandId)
        .limit(12);
      if (error) throw error;
      return data;
    },
  });

  if (!sisterBrands || sisterBrands.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Also owned by the same parent</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {sisterBrands.map((b) => (
          <button
            key={b.id}
            onClick={() => navigate(`/brand/${b.slug || b.id}`)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border bg-card hover:bg-accent/50 transition-colors text-sm"
          >
            {b.logo_url ? (
              <img src={b.logo_url} alt="" className="h-4 w-4 rounded-sm object-contain" />
            ) : (
              <span className="h-4 w-4 rounded-sm bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                {b.name?.[0]}
              </span>
            )}
            {b.name}
          </button>
        ))}
      </div>
    </div>
  );
}
