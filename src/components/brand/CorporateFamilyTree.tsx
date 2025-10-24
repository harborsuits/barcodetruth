import { Link } from 'react-router-dom';
import { Building2, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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
              <Link 
                key={sub.qid}
                to={`/brand/${sub.qid}`}
                className="flex items-center gap-2 p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors text-sm group"
              >
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate flex-1">{sub.name}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </Link>
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
        <div className="text-center py-8 text-muted-foreground">
          <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No corporate relationships found in Wikidata</p>
        </div>
      )}
    </div>
  );
}
