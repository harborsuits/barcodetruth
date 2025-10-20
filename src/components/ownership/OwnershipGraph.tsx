import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';

interface Node {
  id: string;
  name: string;
  logo_url?: string;
  parent_company?: string;
}

interface Edge {
  from: string;
  to: string;
  percent?: number;
  type?: string;
  relationship?: string;
  confidence?: number;
}

interface GraphData {
  nodes: Node[];
  edges: Edge[];
}

export function OwnershipGraph({ brandId }: { brandId: string }) {
  const navigate = useNavigate();

  const { data: graph, isLoading } = useQuery({
    queryKey: ['ownership-graph', brandId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_ownership_graph' as any, {
        p_brand_id: brandId,
      });
      if (error) throw error;
      return data as unknown as GraphData;
    },
  });

  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-64 w-full" />
      </Card>
    );
  }

  if (!graph || (graph.nodes?.length === 0 && graph.edges?.length === 0)) {
    return null;
  }

  // Build parent/child relationships
  const parentMap = new Map<string, string[]>();
  const childMap = new Map<string, string>();
  
  graph.edges?.forEach((edge) => {
    if (!parentMap.has(edge.from)) {
      parentMap.set(edge.from, []);
    }
    parentMap.get(edge.from)!.push(edge.to);
    childMap.set(edge.to, edge.from);
  });

  // Find root nodes (no parents)
  const roots = graph.nodes?.filter((n) => !childMap.has(n.id)) || [];
  const current = graph.nodes?.find((n) => n.id === brandId);

  // Get direct relationships
  const parents = graph.edges?.filter((e) => e.to === brandId) || [];
  const children = graph.edges?.filter((e) => e.from === brandId) || [];

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Building2 className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-semibold">Corporate Structure</h3>
        <Badge variant="outline" className="ml-auto">
          {graph.nodes?.length || 0} entities
        </Badge>
      </div>

      <div className="space-y-6">
        {/* Parents */}
        {parents.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Owned by</div>
            <div className="space-y-2">
              {parents.map((edge) => {
                const parent = graph.nodes?.find((n) => n.id === edge.from);
                return (
                  <div
                    key={edge.from}
                    onClick={() => navigate(`/brand/${edge.from}`)}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent cursor-pointer transition-colors"
                  >
                    {parent?.logo_url ? (
                      <img
                        src={parent.logo_url}
                        alt={parent.name}
                        className="w-10 h-10 object-contain rounded"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{parent?.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {edge.relationship || 'parent company'}
                        {edge.percent && ` • ${edge.percent}%`}
                      </div>
                    </div>
                    {edge.confidence && (
                      <Badge variant="secondary" className="text-xs">
                        {edge.confidence}% confidence
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Current entity */}
        {current && (
          <div className="p-4 rounded-lg border-2 border-primary bg-primary/5">
            <div className="flex items-center gap-3">
              {current.logo_url ? (
                <img
                  src={current.logo_url}
                  alt={current.name}
                  className="w-12 h-12 object-contain rounded"
                />
              ) : (
                <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{current.name}</div>
                <div className="text-sm text-muted-foreground">Current entity</div>
              </div>
            </div>
          </div>
        )}

        {/* Children/Subsidiaries */}
        {children.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              Owns/Controls
              <TrendingUp className="h-4 w-4" />
            </div>
            <div className="grid gap-2">
              {children.map((edge) => {
                const child = graph.nodes?.find((n) => n.id === edge.to);
                return (
                  <div
                    key={edge.to}
                    onClick={() => navigate(`/brand/${edge.to}`)}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent cursor-pointer transition-colors"
                  >
                    {child?.logo_url ? (
                      <img
                        src={child.logo_url}
                        alt={child.name}
                        className="w-8 h-8 object-contain rounded"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{child?.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {edge.relationship || 'subsidiary'}
                        {edge.percent && ` • ${edge.percent}%`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
