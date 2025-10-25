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

interface CorporateFamilyTreeProps {
  graph: OwnershipGraph;
}

export function CorporateFamilyTree({ graph }: CorporateFamilyTreeProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loadingEntity, setLoadingEntity] = useState<string | null>(null);

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
        navigate(`/brand/${data.brand_id}`);
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
      {graph.parent && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-sm font-medium text-muted-foreground">Parent Company</h4>
          </div>
          
          <button
            onClick={() => handleEntityClick(graph.parent!)}
            disabled={loadingEntity === graph.parent.qid}
            className="relative aspect-square w-32 border border-border rounded-lg p-3 hover:border-primary hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-card"
          >
            {graph.parent.logo_url ? (
              <img 
                src={graph.parent.logo_url}
                alt={graph.parent.name}
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
            
            <div className={`logo-fallback w-full h-full flex items-center justify-center text-2xl font-bold text-muted-foreground/30 ${graph.parent.logo_url ? 'hidden' : 'flex'}`}>
              {graph.parent.name.charAt(0)}
            </div>
            
            {loadingEntity === graph.parent.qid && (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
            
            <div className="absolute bottom-0 left-0 right-0 bg-black/75 text-white text-xs p-1 text-center rounded-b-lg opacity-0 hover:opacity-100 transition-opacity">
              {graph.parent.name}
            </div>
          </button>
        </div>
      )}
      
      {/* Sister Brands - Logo Grid */}
      {graph.siblings.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-sm font-medium text-muted-foreground">Sister Brands</h4>
            <Badge variant="secondary" className="text-xs">
              {graph.siblings.length}
            </Badge>
          </div>
          
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
            {graph.siblings.map((sibling) => (
              <button
                key={sibling.qid}
                onClick={() => handleEntityClick(sibling)}
                disabled={loadingEntity === sibling.qid}
                className="relative group aspect-square border border-border rounded-lg p-3 hover:border-primary hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-card"
              >
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
                
                <div className={`logo-fallback w-full h-full flex items-center justify-center text-2xl font-bold text-muted-foreground/30 ${sibling.logo_url ? 'hidden' : 'flex'}`}>
                  {sibling.name.charAt(0)}
                </div>
                
                {loadingEntity === sibling.qid && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
                
                <div className="absolute bottom-0 left-0 right-0 bg-black/75 text-white text-xs p-1 text-center rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity truncate">
                  {sibling.name}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Subsidiaries - Logo Grid */}
      {graph.subsidiaries.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-sm font-medium text-muted-foreground">Owns</h4>
            <Badge variant="secondary" className="text-xs">
              {graph.subsidiaries.length}
            </Badge>
          </div>
          
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
            {graph.subsidiaries.map((sub) => (
              <button
                key={sub.qid}
                onClick={() => handleEntityClick(sub)}
                disabled={loadingEntity === sub.qid}
                className="relative group aspect-square border border-border rounded-lg p-3 hover:border-primary hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-card"
              >
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
                
                <div className={`logo-fallback w-full h-full flex items-center justify-center text-2xl font-bold text-muted-foreground/30 ${sub.logo_url ? 'hidden' : 'flex'}`}>
                  {sub.name.charAt(0)}
                </div>
                
                {loadingEntity === sub.qid && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
                
                <div className="absolute bottom-0 left-0 right-0 bg-black/75 text-white text-xs p-1 text-center rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity truncate">
                  {sub.name}
                </div>
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
          
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
            {graph.cousins.map((cousin) => (
              <button
                key={cousin.qid}
                onClick={() => handleEntityClick(cousin)}
                disabled={loadingEntity === cousin.qid}
                className="relative group aspect-square border border-border rounded-lg p-3 hover:border-primary hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-card"
              >
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
                
                <div className={`logo-fallback w-full h-full flex items-center justify-center text-2xl font-bold text-muted-foreground/30 ${cousin.logo_url ? 'hidden' : 'flex'}`}>
                  {cousin.name.charAt(0)}
                </div>
                
                {loadingEntity === cousin.qid && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
                
                <div className="absolute bottom-0 left-0 right-0 bg-black/75 text-white text-xs p-1 text-center rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity truncate">
                  {cousin.name}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Empty state */}
      {!graph.parent && graph.siblings.length === 0 && graph.subsidiaries.length === 0 && graph.cousins.length === 0 && (
        <div className="text-center py-8 px-4">
          <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
          <h4 className="font-semibold mb-2">No Corporate Family Relationships Found</h4>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {graph.entity_name} appears to be an independent company or ultimate parent with no parent organization, 
            sister brands, or subsidiaries recorded in Wikidata's corporate structure database.
          </p>
          <p className="text-xs text-muted-foreground/70 mt-3">
            This could mean the company is privately held, independently operated, or Wikidata's data is incomplete.
          </p>
        </div>
      )}
    </div>
  );
}
