import { useRpc } from "@/hooks/useRpc";
import { Badge } from "@/components/ui/badge";
import { Building2, ChevronRight, Network } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CorporateFamilyTree } from "./CorporateFamilyTree";
import { Skeleton } from "@/components/ui/skeleton";

interface OwnershipHeader {
  is_ultimate_parent: boolean;
  owner_company_name: string | null;
  ultimate_parent_name: string | null;
}

interface WhoProfitsProps {
  brandId: string;
  brandName?: string;
}

interface OwnershipGraph {
  entity_qid: string;
  entity_name: string;
  parent?: {
    id: string;
    name: string;
    type: string;
    qid: string;
  };
  siblings: Array<{ id: string; name: string; type: string; qid: string }>;
  cousins: Array<{ id: string; name: string; type: string; qid: string }>;
  subsidiaries: Array<{ id: string; name: string; type: string; qid: string }>;
}

export function WhoProfits({ brandId, brandName = "This brand" }: WhoProfitsProps) {
  const { data, isLoading } = useRpc<OwnershipHeader>(
    "rpc_get_brand_ownership_header",
    { p_brand_id: brandId }
  );

  const [loadingWikidata, setLoadingWikidata] = useState(true);
  const [wikidataGraph, setWikidataGraph] = useState<OwnershipGraph | null>(null);
  const [wikidataError, setWikidataError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    
    const loadWikidataGraph = async () => {
      if (!brandName || !brandId) {
        console.log('[Wikidata] Cannot load: missing data');
        setLoadingWikidata(false);
        return;
      }
      
      console.log('[Wikidata] Auto-loading graph for:', brandName);
      
      try {
        // CRITICAL: Fetch brand's wikidata_qid from database first
        const { data: brandData, error: brandError } = await supabase
          .from('brands')
          .select('wikidata_qid')
          .eq('id', brandId)
          .single();
        
        if (brandError) {
          console.error('[Wikidata] Error fetching brand QID:', brandError);
          setLoadingWikidata(false);
          return;
        }
        
        const wikidataQid = brandData?.wikidata_qid;
        console.log('[Wikidata] Using QID:', wikidataQid, '(from database)');
        
        // Skip if no QID available
        if (!wikidataQid) {
          console.log('[Wikidata] No QID available, skipping graph load');
          setLoadingWikidata(false);
          return;
        }
        
        const { data: response, error } = await supabase.functions.invoke('resolve-wikidata-tree', {
          body: { 
            brand_name: brandName,
            qid: wikidataQid  // CRITICAL: Pass explicit QID to avoid unreliable name search
          }
        });
        
        console.log('[Wikidata] Raw response:', { response, error });
        
        if (error) {
          console.error('[Wikidata] Supabase error:', error);
          throw error;
        }
        
        console.log('[Wikidata] Response success:', response?.success);
        console.log('[Wikidata] Response graph:', response?.graph);
        
        if (cancelled) {
          console.log('[Wikidata] Request cancelled');
          return;
        }
        
        if (response?.success && response?.graph) {
          console.log('[Wikidata] Setting graph state:', {
            entity_qid: response.graph.entity_qid,
            entity_name: response.graph.entity_name,
            has_parent: !!response.graph.parent,
            siblings_count: response.graph.siblings?.length || 0,
            cousins_count: response.graph.cousins?.length || 0,
            subsidiaries_count: response.graph.subsidiaries?.length || 0
          });
          setWikidataGraph(response.graph);
        } else {
          console.warn('[Wikidata] Response invalid or unsuccessful:', response);
          setWikidataError(response?.error || 'Failed to load corporate family tree');
        }
      } catch (err: any) {
        if (cancelled) return;
        console.error('[Wikidata] Caught error:', err);
        setWikidataError(err.message || 'Failed to connect to Wikidata');
      } finally {
        if (!cancelled) {
          console.log('[Wikidata] Loading complete');
          setLoadingWikidata(false);
        }
      }
    };

    loadWikidataGraph();
    
    return () => {
      cancelled = true;
    };
  }, [brandName, brandId]);

  if (isLoading || !data) return null;

  return (
    <div className="rounded-2xl border-2 border-border p-6 bg-card">
      <div className="text-sm text-muted-foreground mb-4">
        Who profits from your purchase
      </div>
      
      <div className="flex items-center gap-3 flex-wrap">
        <Node label="You" />
        <Arrow />
        <Node label={brandName} emphasis />
        
        {!data.is_ultimate_parent && data.owner_company_name && (
          <>
            <Arrow />
            <Node label={data.owner_company_name} />
          </>
        )}
        
        {data.ultimate_parent_name && (
          <>
            <Arrow />
            <Node
              label={data.ultimate_parent_name}
              badge="Ultimate parent"
            />
          </>
        )}
      </div>
      
      <div className="mt-4 text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
        <strong>Note:</strong> Revenue flows to {data.is_ultimate_parent ? brandName : "controlling entities"} and then to their shareholders (e.g., index funds, institutional investors) who are listed in the shareholders section below.
      </div>

      {/* Corporate Family Tree Section */}
      <div className="mt-6 pt-6 border-t border-border">
        <div className="flex items-center gap-2 mb-4">
          <Network className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Corporate Family</h3>
        </div>

        {loadingWikidata && (
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {wikidataError && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
            {wikidataError}
          </div>
        )}

        {wikidataGraph && !loadingWikidata && (
          <CorporateFamilyTree graph={wikidataGraph} />
        )}
      </div>
    </div>
  );
}

function Node({
  label,
  badge,
  emphasis,
}: {
  label: string;
  badge?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-xl px-4 py-2 border bg-background ${
        emphasis ? "font-semibold shadow-md border-2 border-primary/30" : ""
      }`}
    >
      <div className="text-sm">{label}</div>
      {badge && (
        <div className="mt-1 text-[10px] text-emerald-700 bg-emerald-100 dark:bg-emerald-900 dark:text-emerald-300 inline-block px-2 py-0.5 rounded-full font-medium">
          {badge}
        </div>
      )}
    </div>
  );
}

function Arrow() {
  return <div className="text-2xl text-muted-foreground">→</div>;
}
