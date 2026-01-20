import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface IdentityCandidate {
  id: string;
  brand_id: string;
  candidate_qid: string;
  candidate_name: string;
  candidate_domain: string | null;
  score: number;
  reasons: string[];
  source: string;
  is_selected: boolean;
  created_at: string;
}

export interface VerifyResult {
  success: boolean;
  brand_id: string;
  brand_name: string;
  candidates: Array<{
    candidate_qid: string;
    candidate_name: string;
    candidate_domain: string | null;
    score: number;
    reasons: string[];
    source: string;
  }>;
  auto_applied: boolean;
  new_confidence: string | null;
  top_score: number;
}

export function useIdentityCandidates(brandId: string | undefined) {
  return useQuery({
    queryKey: ['identity-candidates', brandId],
    queryFn: async (): Promise<IdentityCandidate[]> => {
      if (!brandId) return [];
      
      const { data, error } = await supabase
        .from('brand_identity_candidates')
        .select('*')
        .eq('brand_id', brandId)
        .order('score', { ascending: false });
      
      if (error) {
        console.error('Error fetching identity candidates:', error);
        return [];
      }
      
      // Type assertion since we know the shape
      return (data || []).map(row => ({
        ...row,
        reasons: Array.isArray(row.reasons) ? row.reasons : []
      })) as IdentityCandidate[];
    },
    enabled: !!brandId,
    staleTime: 60 * 1000,
  });
}

export function useVerifyBrandIdentity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ brandId, autoApply = false }: { brandId: string; autoApply?: boolean }): Promise<VerifyResult> => {
      const { data, error } = await supabase.functions.invoke('verify-brand-identity', {
        body: { brand_id: brandId, auto_apply: autoApply }
      });
      
      if (error) throw error;
      return data as VerifyResult;
    },
    onSuccess: (data) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['identity-candidates', data.brand_id] });
      queryClient.invalidateQueries({ queryKey: ['brand-profile-state', data.brand_id] });
      queryClient.invalidateQueries({ queryKey: ['brand', data.brand_id] });
    }
  });
}

export function useSelectCandidate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ brandId, candidateQid }: { brandId: string; candidateQid: string }) => {
      // First, get the candidate details
      const { data: candidate, error: fetchError } = await supabase
        .from('brand_identity_candidates')
        .select('*')
        .eq('brand_id', brandId)
        .eq('candidate_qid', candidateQid)
        .single();
      
      if (fetchError || !candidate) {
        throw new Error('Candidate not found');
      }
      
      // Update the brand with the selected QID
      const { error: updateError } = await supabase
        .from('brands')
        .update({
          wikidata_qid: candidateQid,
          identity_confidence: 'medium', // User-selected = medium confidence
          identity_notes: `User-selected: ${(candidate.reasons as string[]).join(', ')}`,
          last_build_error: null,
          status: 'ready'
        })
        .eq('id', brandId);
      
      if (updateError) throw updateError;
      
      // Mark this candidate as selected
      await supabase
        .from('brand_identity_candidates')
        .update({ is_selected: false })
        .eq('brand_id', brandId);
      
      await supabase
        .from('brand_identity_candidates')
        .update({ is_selected: true })
        .eq('brand_id', brandId)
        .eq('candidate_qid', candidateQid);
      
      return { brandId, candidateQid };
    },
    onSuccess: ({ brandId }) => {
      // Invalidate all related queries to refresh the page
      queryClient.invalidateQueries({ queryKey: ['identity-candidates', brandId] });
      queryClient.invalidateQueries({ queryKey: ['brand-profile-state', brandId] });
      queryClient.invalidateQueries({ queryKey: ['brand', brandId] });
      queryClient.invalidateQueries({ queryKey: ['power-profit', brandId] });
    }
  });
}
