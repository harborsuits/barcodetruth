import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Loader2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
  isParentCompany?: boolean;
}

export function CorporateFamilyTree({ 
  brandName, 
  ownershipData, 
  isLoading,
  isParentCompany = false 
}: CorporateFamilyTreeProps) {
  const navigate = useNavigate();
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
        <h4 className="font-semibold mb-2">Ownership Information Unavailable</h4>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          We couldn't determine the ownership structure for this brand.
        </p>
        <p className="text-xs text-muted-foreground/70 mt-3 italic">
          Private equity, licensing arrangements, and complex corporate structures may not be publicly documented.
        </p>
      </div>
    );
  }
  
  // Use database ownership data directly
  const parent = ownershipData.structure.chain?.[0];
  const siblings = ownershipData.structure.siblings || [];

  // Hide parent tile if it's the same as the current brand (self-referential)
  // OR if this brand IS the parent company
  const showParent = parent && 
    parent.name.trim().toLowerCase() !== brandName.trim().toLowerCase() &&
    !isParentCompany;

  // Detect logical inconsistency: siblings exist but no parent shown
  // This could mean incomplete data OR this brand IS the parent
  const hasSiblingsWithoutParent = siblings.length > 0 && !showParent && !isParentCompany;

  const handleEntityClick = async (entity: { id: string; name: string }) => {
    console.log('[Entity Click] Navigating to brand:', entity.id);
    navigate(`/brand/${entity.id}`);
  };

  return (
    <div className="space-y-6">
      {/* Data Inconsistency Warning */}
      {hasSiblingsWithoutParent && (
        <Alert variant="default" className="bg-amber-50 border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 text-sm">
            Related brands detected but parent company not fully resolved. This may indicate incomplete data.
          </AlertDescription>
        </Alert>
      )}

      {/* Parent Company */}
      {showParent && (
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
      
      {/* Subsidiaries (when this is a parent company) or Sister Brands (when this has siblings) */}
      {siblings.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-sm font-medium text-muted-foreground">
              {isParentCompany ? 'Owned Brands & Subsidiaries' : 'Sister Brands'}
            </h4>
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
      
      {/* Empty state - only show when truly no relationships */}
      {!showParent && siblings.length === 0 && (
        <div className="text-center py-8 px-4">
          <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
          <h4 className="font-semibold mb-2">No Known Subsidiaries or Parent</h4>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {brandName} appears to operate independently, or ownership relationships aren't publicly documented.
          </p>
          <p className="text-xs text-muted-foreground/70 mt-3 italic">
            Some companies operate under a single brand, or their corporate structure may not be publicly disclosed.
          </p>
        </div>
      )}
    </div>
  );
}
