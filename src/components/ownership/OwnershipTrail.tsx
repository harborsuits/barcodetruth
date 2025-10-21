import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface OwnershipTrailProps {
  brandId: string;
}

interface TrailEntity {
  entity_id: string;
  entity_type: 'brand' | 'company';
  entity_name: string;
  logo_url: string | null;
  parent_id: string | null;
  relationship: string | null;
  source: string | null;
  confidence: number | null;
  level: number;
}

export function OwnershipTrail({ brandId }: OwnershipTrailProps) {
  const { data: trail, isLoading } = useQuery({
    queryKey: ['ownership-trail', brandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_ownership_trail')
        .select('*')
        .eq('entity_id', brandId)
        .order('level');
      
      if (error) throw error;
      return data as TrailEntity[];
    },
  });

  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-8" />
          <Skeleton className="h-10 w-48" />
        </div>
      </Card>
    );
  }

  if (!trail || trail.length === 0) {
    return null;
  }

  // Build the complete chain including parent companies not in the trail
  const buildCompleteChain = async () => {
    const chain = [...trail];
    let lastParentId = trail[trail.length - 1]?.parent_id;
    
    while (lastParentId && chain.length < 10) {
      const { data: company } = await supabase
        .from('companies')
        .select('id, name, logo_url')
        .eq('id', lastParentId)
        .single();
      
      if (!company) break;
      
      chain.push({
        entity_id: company.id,
        entity_type: 'company',
        entity_name: company.name,
        logo_url: company.logo_url,
        parent_id: null,
        relationship: null,
        source: null,
        confidence: null,
        level: chain.length,
      });
      
      // Check if this company has a parent
      const { data: ownership } = await supabase
        .from('company_ownership')
        .select('parent_company_id')
        .eq('child_company_id', company.id)
        .maybeSingle();
      
      lastParentId = ownership?.parent_company_id || null;
    }
    
    return chain;
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Building2 className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-semibold">Your Purchase Supports</h3>
      </div>
      
      <div className="flex flex-wrap items-center gap-2">
        {trail.map((entity, index) => (
          <div key={entity.entity_id} className="flex items-center gap-2">
            {index > 0 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
              {entity.logo_url && (
                <img 
                  src={entity.logo_url} 
                  alt={entity.entity_name}
                  className="h-8 w-8 object-contain"
                />
              )}
              <div className="flex flex-col">
                <span className="font-medium text-sm">{entity.entity_name}</span>
                {entity.relationship && (
                  <Badge variant="outline" className="text-xs w-fit">
                    {entity.relationship}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {/* Show ultimate parent if exists */}
        {trail[trail.length - 1]?.parent_id && (
          <>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <div className="p-2 rounded-lg bg-muted/50">
              <span className="text-sm text-muted-foreground">+ more</span>
            </div>
          </>
        )}
      </div>
      
      {trail.length > 1 && (
        <p className="text-sm text-muted-foreground mt-4">
          This brand is part of a larger corporate structure. Your purchase supports all companies in this chain.
        </p>
      )}
    </Card>
  );
}
