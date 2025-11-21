import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, ArrowRight, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface RelatedEntity {
  id: string;
  name: string;
  type: string;
  qid: string;
  logo_url?: string;
}

interface OwnershipGraph {
  entity_qid: string;
  entity_name: string;
  parent?: RelatedEntity;
  siblings: RelatedEntity[];
  cousins: RelatedEntity[];
  subsidiaries: RelatedEntity[];
}

interface OwnershipData {
  company_id: string | null;
  structure: {
    chain: Array<{ id: string; name: string; type: string; logo_url?: string }>;
    siblings: Array<{ id: string; name: string; type: string; logo_url?: string }>;
  };
  ownership_structure?: any;
  ownership_details?: any[];
  shareholders: any;
}

interface CorporateFamilyTreeProps {
  graph: OwnershipGraph;
  ownershipData?: OwnershipData | null;
}

export function CorporateFamilyTree({ graph, ownershipData }: CorporateFamilyTreeProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loadingEntity, setLoadingEntity] = useState<string | null>(null);
  
  // Merge Wikidata graph with database ownership data
  const mergedParent = graph.parent || (ownershipData?.structure.chain?.[0] ? {
    id: ownershipData.structure.chain[0].id,
    name: ownershipData.structure.chain[0].name,
    type: 'company',
    qid: '', // No QID from database
    logo_url: ownershipData.structure.chain[0].logo_url
  } : undefined);
  
  const mergedSiblings = [...graph.siblings];
  // Add database siblings if not already in Wikidata
  if (ownershipData?.structure.siblings) {
    for (const sib of ownershipData.structure.siblings) {
      if (!mergedSiblings.some(s => s.id === sib.id)) {
        mergedSiblings.push({
          id: sib.id,
          name: sib.name,
          type: sib.type,
          qid: '', // No QID from database
          logo_url: sib.logo_url
        });
      }
    }
  }
  
  // Filter out subsidiaries that already appear in siblings to avoid duplication
  const siblingQids = new Set(mergedSiblings.map(s => s.qid || s.id));
  const uniqueSubsidiaries = graph.subsidiaries.filter(sub => !siblingQids.has(sub.qid));

  const handleEntityClick = async (entity: RelatedEntity) => {
    if (!entity.qid) {
      toast({
        title: "Error",
        description: "Unable to load brand profile - missing data",
        variant: "destructive"
      });
      return;
    }

    console.log('[Entity Click] Creating/loading:', entity.name);
    setLoadingEntity(entity.qid);
    
    try {
      const { data, error } = await supabase.functions.invoke('create-brand-from-wikidata', {
        body: { 
          qid: entity.qid, 
          name: entity.name,
          parent_qid: entity.type === 'parent' ? null : graph.entity_qid
        }
      });
      
      if (error) throw error;
      
      if (data?.success && data.brand_id) {
        console.log('[Entity Click] Navigating to brand:', data.brand_id);
        navigate(`/brand/${data.brand_id}`, {
          state: { fromBrand: graph.entity_name }
        });
      } else {
        throw new Error('Failed to create brand');
      }
    } catch (error) {
      console.error('[Entity Click] Error:', error);
      toast({
        title: "Error",
        description: "Failed to load brand profile",
        variant: "destructive"
      });
    } finally {
      setLoadingEntity(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Parent Company - Logo Grid Style */}
      {mergedParent && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-sm font-medium text-muted-foreground">Parent Company</h4>
          </div>
          
          <button
            onClick={() => handleEntityClick(mergedParent)}
            disabled={loadingEntity === mergedParent.qid}
            className="flex flex-col items-center gap-2 p-3 w-40 border border-border rounded-lg hover:border-primary hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-card"
          >
            <div className="relative aspect-square w-full">
              {mergedParent.logo_url ? (
                <img 
                  src={mergedParent.logo_url}
                  alt={mergedParent.name}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                      const fallback = parent.querySelector('.logo-fallback') as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }
                  }}
                />
              ) : null}
              
              <div className={`logo-fallback absolute inset-0 flex items-center justify-center text-4xl font-bold text-muted-foreground/30 ${mergedParent.logo_url ? 'hidden' : 'flex'}`}>
                {mergedParent.name.charAt(0)}
              </div>
              
              {loadingEntity === mergedParent.qid && (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
            </div>
            
            <span className="text-xs font-medium text-center line-clamp-2 w-full">
              {mergedParent.name}
            </span>
          </button>
        </div>
      )}
      
      {/* Sister Brands - Logo Grid */}
      {mergedSiblings.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-sm font-medium text-muted-foreground">Sister Brands</h4>
            <Badge variant="secondary" className="text-xs">
              {mergedSiblings.length}
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {mergedSiblings.map((sibling) => (
              <button
                key={sibling.qid}
                onClick={() => handleEntityClick(sibling)}
                disabled={loadingEntity === sibling.qid}
                className="relative group flex flex-col items-center gap-2 p-3 border border-border rounded-lg hover:border-primary hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-card"
              >
                <div className="relative aspect-square w-full">
                  {sibling.logo_url ? (
                    <img 
                      src={sibling.logo_url}
                      alt={sibling.name}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const parent = e.currentTarget.parentElement;
                        if (parent) {
                          const fallback = parent.querySelector('.logo-fallback') as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }
                      }}
                    />
                  ) : null}
                  
                  <div className={`logo-fallback absolute inset-0 flex items-center justify-center text-4xl font-bold text-muted-foreground/30 ${sibling.logo_url ? 'hidden' : 'flex'}`}>
                    {sibling.name.charAt(0)}
                  </div>
                  
                  {loadingEntity === sibling.qid && (
                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  )}
                </div>
                
                <span className="text-xs font-medium text-center line-clamp-2 w-full">
                  {sibling.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Subsidiaries - Logo Grid */}
      {uniqueSubsidiaries.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-sm font-medium text-muted-foreground">Owns (Subsidiaries)</h4>
            <Badge variant="secondary" className="text-xs">
              {uniqueSubsidiaries.length}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Companies that {graph.entity_name} directly controls or owns
          </p>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {uniqueSubsidiaries.map((sub) => (
              <button
                key={sub.qid}
                onClick={() => handleEntityClick(sub)}
                disabled={loadingEntity === sub.qid}
                className="relative group flex flex-col items-center gap-2 p-3 border border-border rounded-lg hover:border-primary hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-card"
              >
                <div className="relative aspect-square w-full">
                  {sub.logo_url ? (
                    <img 
                      src={sub.logo_url}
                      alt={sub.name}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const parent = e.currentTarget.parentElement;
                        if (parent) {
                          const fallback = parent.querySelector('.logo-fallback') as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }
                      }}
                    />
                  ) : null}
                  
                  <div className={`logo-fallback absolute inset-0 flex items-center justify-center text-4xl font-bold text-muted-foreground/30 ${sub.logo_url ? 'hidden' : 'flex'}`}>
                    {sub.name.charAt(0)}
                  </div>
                  
                  {loadingEntity === sub.qid && (
                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  )}
                </div>
                
                <span className="text-xs font-medium text-center line-clamp-2 w-full">
                  {sub.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Cousins - Logo Grid */}
      {graph.cousins.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-sm font-medium text-muted-foreground">Cousin Brands</h4>
            <Badge variant="secondary" className="text-xs">
              {graph.cousins.length}
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {graph.cousins.map((cousin) => (
              <button
                key={cousin.qid}
                onClick={() => handleEntityClick(cousin)}
                disabled={loadingEntity === cousin.qid}
                className="relative group flex flex-col items-center gap-2 p-3 border border-border rounded-lg hover:border-primary hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-card"
              >
                <div className="relative aspect-square w-full">
                  {cousin.logo_url ? (
                    <img 
                      src={cousin.logo_url}
                      alt={cousin.name}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const parent = e.currentTarget.parentElement;
                        if (parent) {
                          const fallback = parent.querySelector('.logo-fallback') as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }
                      }}
                    />
                  ) : null}
                  
                  <div className={`logo-fallback absolute inset-0 flex items-center justify-center text-4xl font-bold text-muted-foreground/30 ${cousin.logo_url ? 'hidden' : 'flex'}`}>
                    {cousin.name.charAt(0)}
                  </div>
                  
                  {loadingEntity === cousin.qid && (
                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  )}
                </div>
                
                <span className="text-xs font-medium text-center line-clamp-2 w-full">
                  {cousin.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Empty state */}
      {!mergedParent && mergedSiblings.length === 0 && uniqueSubsidiaries.length === 0 && graph.cousins.length === 0 && (
        <div className="text-center py-8 px-4">
          <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
          <h4 className="font-semibold mb-2">No Parent or Subsidiary Relationships</h4>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {graph.entity_name} appears to operate independently with no controlling parent company or owned subsidiaries 
            recorded in Wikidata.
          </p>
          <p className="text-xs text-muted-foreground/70 mt-3">
            Note: This shows corporate control relationships only. Shareholder and investor information may exist separately.
          </p>
        </div>
      )}
    </div>
  );
}
