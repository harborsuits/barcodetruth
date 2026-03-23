import { useQuery } from "@tanstack/react-query";
import { Building2, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ParentCompanyBannerProps {
  parentCompanyId: string | null;
}

export function ParentCompanyBanner({ parentCompanyId }: ParentCompanyBannerProps) {
  const { data: company } = useQuery({
    queryKey: ["company-info", parentCompanyId],
    enabled: !!parentCompanyId,
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, country, wikidata_qid")
        .eq("id", parentCompanyId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (!company) return null;

  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">Parent Company</p>
        <p className="font-medium text-sm truncate">{company.name}</p>
      </div>
      {company.country && (
        <span className="text-xs text-muted-foreground">{company.country}</span>
      )}
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </div>
  );
}
