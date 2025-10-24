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
  const [loadingSubsidiary, setLoadingSubsidiary] = useState<string | null>(null);

  const handleSubsidiaryClick = async (subsidiary: RelatedEntity) => {
    if (!subsidiary.qid) {
      toast({
        title: "Error",
        description: "Unable to load brand profile - missing data",
        variant: "destructive"
      });
      return;
    }

    console.log('[Subsidiary Click] Creating/loading:', subsidiary.name);
    setLoadingSubsidiary(subsidiary.qid);
    
    try {
      const { data, error } = await supabase.functions.invoke('create-brand-from-wikidata', {
        body: { 
          qid: subsidiary.qid, 
          name: subsidiary.name,
          parent_qid: graph.entity_qid
        }
      });
      
      if (error) throw error;
      
      if (data?.success && data.brand_id) {
        console.log('[Subsidiary Click] Navigating to brand:', data.brand_id);
        navigate(`/brand/${data.brand_id}`);
      } else {
        throw new Error('Failed to create brand');
      }
    } catch (error) {
      console.error('[Subsidiary Click] Error:', error);
      toast({
        title: "Error",
        description: "Failed to load brand profile",
        variant: "destructive"
      });
    } finally {
      setLoadingSubsidiary(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Parent */}
      {graph.parent && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Parent Company</h4>
          <Link 
            to={`/brand/${graph.parent.qid}`}
            className="flex items-center gap-3 p-4 border-2 border-border rounded-lg hover:bg-accent/50 transition-colors group"
          >
            <Building2 className="h-5 w-5 text-primary" />
            <span className="font-medium flex-1">{graph.parent.name}</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
        </div>
      )}
      
      {/* Siblings */}
      {graph.siblings.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-sm font-medium text-muted-foreground">Sister Brands</h4>
            <Badge variant="secondary" className="text-xs">
              {graph.siblings.length}
            </Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {graph.siblings.map((sibling) => (
              <Link 
                key={sibling.qid}
                to={`/brand/${sibling.qid}`}
                className="flex items-center gap-2 p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors text-sm group"
              >
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate flex-1">{sibling.name}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}
      
      {/* Subsidiaries */}
      {graph.subsidiaries.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-sm font-medium text-muted-foreground">Owns</h4>
            <Badge variant="secondary" className="text-xs">
              {graph.subsidiaries.length}
            </Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {graph.subsidiaries.map((sub) => (
              <button
                key={sub.qid}
                onClick={() => handleSubsidiaryClick(sub)}
                disabled={loadingSubsidiary === sub.qid}
                className="flex items-center gap-2 p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors text-sm group disabled:opacity-50 disabled:cursor-not-allowed text-left w-full"
              >
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate flex-1">{sub.name}</span>
                {loadingSubsidiary === sub.qid ? (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />
                ) : (
                  <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Cousins */}
      {graph.cousins.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-sm font-medium text-muted-foreground">Cousin Brands</h4>
            <Badge variant="secondary" className="text-xs">
              {graph.cousins.length}
            </Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {graph.cousins.map((cousin) => (
              <Link 
                key={cousin.qid}
                to={`/brand/${cousin.qid}`}
                className="flex items-center gap-2 p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors text-sm group"
              >
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate flex-1">{cousin.name}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </Link>
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
