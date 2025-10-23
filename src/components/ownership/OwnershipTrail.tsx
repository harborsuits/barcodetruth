import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, ChevronRight, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useTopShareholders } from '@/hooks/useTopShareholders';

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

function EntityWithShareholders({ entity }: { entity: TrailEntity }) {
  const { data: shareholders, isLoading } = useTopShareholders(entity.entity_id, 5);
  
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 p-3 rounded-lg bg-card border border-border">
        {entity.logo_url && (
          <img 
            src={entity.logo_url} 
            alt={entity.entity_name}
            className="h-10 w-10 object-contain flex-shrink-0"
          />
        )}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="font-semibold text-base truncate">{entity.entity_name}</span>
          {entity.relationship && (
            <Badge variant="outline" className="text-xs w-fit mt-1">
              {entity.relationship}
            </Badge>
          )}
        </div>
      </div>
      
      {!isLoading && shareholders && shareholders.length > 0 && (
        <div className="ml-6 pl-4 border-l-2 border-muted space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
            <Users className="h-3 w-3" />
            <span>Top shareholders profiting from {entity.entity_name}:</span>
          </div>
          {shareholders.map((holder) => (
            <div key={holder.holder_name} className="flex items-center justify-between gap-2 p-2 rounded bg-muted/30 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate">{holder.holder_name}</span>
                {holder.is_asset_manager && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                    Asset manager
                  </Badge>
                )}
              </div>
              {holder.percent_owned && (
                <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                  {holder.percent_owned.toFixed(1)}%
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function OwnershipTrail({ brandId }: OwnershipTrailProps) {
  const { data: trail, isLoading } = useQuery({
    queryKey: ['ownership-trail', brandId],
    queryFn: async () => {
      console.log('[OwnershipTrail] Fetching complete ownership chain for brand:', brandId);
      
      const chain: TrailEntity[] = [];
      
      // Start with the brand
      const { data: brandData } = await supabase
        .from('brands')
        .select('id, name, logo_url')
        .eq('id', brandId)
        .single();
      
      if (brandData) {
        chain.push({
          entity_id: brandData.id,
          entity_type: 'brand',
          entity_name: brandData.name,
          logo_url: brandData.logo_url,
          parent_id: null,
          relationship: null,
          source: null,
          confidence: null,
          level: 0,
        });
      }
      
      // Walk up the ownership chain
      let currentId = brandId;
      let level = 1;
      const visited = new Set([brandId]);
      
      while (level < 10) {
        // Check for parent company via company_ownership
        const { data: ownership } = await supabase
          .from('company_ownership')
          .select('parent_company_id, relationship_type, confidence, source, companies!parent_company_id(id, name, logo_url)')
          .eq('child_brand_id', currentId)
          .eq('relationship_type', 'control')
          .order('confidence', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (ownership?.parent_company_id && !visited.has(ownership.parent_company_id)) {
          const company = ownership.companies as any;
          chain.push({
            entity_id: company.id,
            entity_type: 'company',
            entity_name: company.name,
            logo_url: company.logo_url,
            parent_id: null,
            relationship: ownership.relationship_type,
            source: ownership.source,
            confidence: ownership.confidence,
            level,
          });
          visited.add(company.id);
          currentId = company.id;
          level++;
          
          // Now check if this company has a parent
          const { data: nextOwnership } = await supabase
            .from('company_ownership')
            .select('parent_company_id, relationship_type, confidence, source, companies!parent_company_id(id, name, logo_url)')
            .eq('child_company_id', currentId)
            .eq('relationship_type', 'control')
            .order('confidence', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (nextOwnership?.parent_company_id && !visited.has(nextOwnership.parent_company_id)) {
            const nextCompany = nextOwnership.companies as any;
            chain.push({
              entity_id: nextCompany.id,
              entity_type: 'company',
              entity_name: nextCompany.name,
              logo_url: nextCompany.logo_url,
              parent_id: null,
              relationship: nextOwnership.relationship_type,
              source: nextOwnership.source,
              confidence: nextOwnership.confidence,
              level,
            });
            visited.add(nextCompany.id);
            currentId = nextCompany.id;
            level++;
          } else {
            break;
          }
        } else {
          break;
        }
      }
      
      console.log('[OwnershipTrail] Complete chain built:', chain);
      return chain;
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

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Building2 className="h-5 w-5 text-muted-foreground" />
        <div className="flex-1">
          <h3 className="font-semibold text-lg">Who Profits From Your Purchase</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Revenue flows through this ownership chain, benefiting both controlling entities and their shareholders
          </p>
        </div>
      </div>
      
      <div className="space-y-4">
        {trail.map((entity, index) => (
          <div key={entity.entity_id}>
            {index > 0 && (
              <div className="flex justify-center my-3">
                <ChevronRight className="h-5 w-5 text-muted-foreground rotate-90" />
              </div>
            )}
            <EntityWithShareholders entity={entity} />
          </div>
        ))}
      </div>
      
      {trail.length > 1 && (
        <p className="text-sm text-muted-foreground mt-6 pt-4 border-t">
          Your purchase supports {trail.length} {trail.length === 2 ? 'entity' : 'entities'} and their shareholders in this ownership structure.
        </p>
      )}
    </Card>
  );
}
