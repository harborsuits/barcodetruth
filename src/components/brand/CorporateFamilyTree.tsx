import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  brandName: string;
  ownershipData?: OwnershipData | null;
  isLoading?: boolean;
}

export function CorporateFamilyTree({ brandName, ownershipData, isLoading }: CorporateFamilyTreeProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loadingEntity, setLoadingEntity] = useState<string | null>(null);
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!ownershipData) {
    return (
      <div className="text-center py-8 px-4">
        <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
        <h4 className="font-semibold mb-2">No Ownership Data Available</h4>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Corporate ownership information is being collected. Check back soon.
        </p>
      </div>
    );
  }
  
  // Use database ownership data directly
  const parent = ownershipData.structure.chain?.[0];
  const siblings = ownershipData.structure.siblings || [];

  const handleEntityClick = async (entity: { id: string; name: string }) => {
    console.log('[Entity Click] Navigating to brand:', entity.id);
    navigate(`/brand/${entity.id}`);
  };

  return (
    <div className="space-y-6">
      {/* Parent Company */}
      {parent && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-sm font-medium text-muted-foreground">Parent Company</h4>
          </div>
          
          <button
            onClick={() => handleEntityClick(parent)}
            disabled={loadingEntity === parent.id}
            className="flex flex-col items-center gap-2 p-3 w-40 border border-border rounded-lg hover:border-primary hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-card"
          >
            <div className="relative aspect-square w-full">
              {parent.logo_url ? (
                <img 
                  src={parent.logo_url}
                  alt={parent.name}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallbackDiv = e.currentTarget.parentElement?.querySelector('.logo-fallback') as HTMLElement;
                    if (fallbackDiv) fallbackDiv.style.display = 'flex';
                  }}
                />
              ) : null}
              
              <div className={`logo-fallback absolute inset-0 flex items-center justify-center text-4xl font-bold text-muted-foreground/30 ${parent.logo_url ? 'hidden' : 'flex'}`}>
                {parent.name.charAt(0)}
              </div>
              
              {loadingEntity === parent.id && (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
            </div>
            
            <span className="text-xs font-medium text-center line-clamp-2 w-full">
              {parent.name}
            </span>
          </button>
        </div>
      )}
      
      {/* Sister Brands */}
      {siblings.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-sm font-medium text-muted-foreground">Sister Brands</h4>
            <Badge variant="secondary" className="text-xs">
              {siblings.length}
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {siblings.map((sibling) => (
              <button
                key={sibling.id}
                onClick={() => handleEntityClick(sibling)}
                disabled={loadingEntity === sibling.id}
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
                        const fallbackDiv = e.currentTarget.parentElement?.querySelector('.logo-fallback') as HTMLElement;
                        if (fallbackDiv) fallbackDiv.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  
                  <div className={`logo-fallback absolute inset-0 flex items-center justify-center text-4xl font-bold text-muted-foreground/30 ${sibling.logo_url ? 'hidden' : 'flex'}`}>
                    {sibling.name.charAt(0)}
                  </div>
                  
                  {loadingEntity === sibling.id && (
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
      
      {/* Empty state */}
      {!parent && siblings.length === 0 && (
        <div className="text-center py-8 px-4">
          <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
          <h4 className="font-semibold mb-2">No Parent or Subsidiary Relationships</h4>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {brandName} appears to operate independently with no controlling parent company or owned subsidiaries.
          </p>
          <p className="text-xs text-muted-foreground/70 mt-3">
            Note: This shows corporate control relationships only. Shareholder and investor information may exist separately.
          </p>
        </div>
      )}
    </div>
  );
}
