import { Building2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface OwnershipRevealProps {
  brandId: string;
  brandName: string;
  parentCompany?: string | null;
}

export function OwnershipReveal({ brandId, brandName, parentCompany }: OwnershipRevealProps) {
  const { data: ownership, isLoading } = useQuery({
    queryKey: ["ownership-reveal", brandId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_brand_ownership" as any, {
        p_brand_id: brandId,
      });
      if (error) return null;
      return data;
    },
    enabled: !!brandId,
  });

  if (isLoading) return <Skeleton className="h-16 w-full" />;

  const chain = (ownership as any)?.structure?.chain || [];
  const ultimateParent = chain.length > 1 ? chain[chain.length - 1] : null;
  const parentName = ultimateParent?.name || parentCompany;

  if (!parentName || parentName === brandName) return null;

  return (
    <div className="bg-elevated-1 border border-border p-4 flex items-center gap-3">
      <div className="w-10 h-10 bg-elevated-2 flex items-center justify-center flex-shrink-0">
        <Building2 className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="label-forensic text-[10px]">Owned By</p>
        <p className="text-base font-bold">{parentName}</p>
      </div>
    </div>
  );
}
