import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useRpc<T>(
  rpcName: string,
  params: Record<string, any>,
  options?: { staleTime?: number; enabled?: boolean }
) {
  return useQuery({
    queryKey: [rpcName, params],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(rpcName as any, params);
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as T;
    },
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTime ?? 1000 * 60 * 30, // 30 minutes default
  });
}
