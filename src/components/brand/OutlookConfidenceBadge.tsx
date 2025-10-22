import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface OutlookConfidenceBadgeProps {
  brandId: string;
}

export function OutlookConfidenceBadge({ brandId }: OutlookConfidenceBadgeProps) {
  const { data } = useQuery({
    queryKey: ['community-outlook-badge', brandId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('community-outlook', {
        body: { brand_id: brandId },
      });
      if (error) throw error;
      return data;
    },
  });

  const cats = data?.categories ?? [];
  const totalN = cats.reduce((s: number, c: any) => s + (c?.n || 0), 0);
  const hasData = totalN >= 10;
  
  const confidence =
    totalN >= 100 ? 'High confidence' :
    totalN >= 30  ? 'Medium confidence' :
    totalN >= 10  ? 'Low confidence' : 'Not enough data';

  return (
    <Badge variant={hasData ? "default" : "secondary"} className="text-xs">
      {hasData ? confidence : 'Researching'}
    </Badge>
  );
}
