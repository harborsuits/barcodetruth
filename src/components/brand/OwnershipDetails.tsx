import { Alert, AlertDescription } from "@/components/ui/alert";
import { Users, Building2, Info } from "lucide-react";

interface OwnershipDetail {
  type: 'employee' | 'family' | 'private_equity' | 'founder' | 'institutional' | 'government' | 'public_float';
  name?: string;
  percent?: number;
  description?: string;
  source?: string;
  source_url?: string;
}

interface OwnershipStructure {
  type?: string;
  employee_percent?: number;
  is_largest_esop?: boolean;
  details?: string;
  source?: string;
}

interface OwnershipDetailsProps {
  ownership_structure?: OwnershipStructure;
  ownership_details?: OwnershipDetail[];
  companyName?: string;
}

const OWNER_TYPE_ICONS: Record<string, any> = {
  employee: Users,
  family: Building2,
  founder: Building2,
  private_equity: Building2,
};

const OWNER_TYPE_LABELS: Record<string, string> = {
  employee: 'Employee Ownership',
  family: 'Family Ownership',
  founder: 'Founder Ownership',
  private_equity: 'Private Equity',
  institutional: 'Institutional',
  government: 'Government',
  public_float: 'Public Float',
};

export function OwnershipDetails({ ownership_structure, ownership_details, companyName }: OwnershipDetailsProps) {
  if (!ownership_details || ownership_details.length === 0) {
    return null;
  }

  // Calculate if employee-owned
  const employeeOwned = ownership_details.find(d => d.type === 'employee');
  const isEmployeeControlled = employeeOwned && employeeOwned.percent && employeeOwned.percent > 50;

  return (
    <div className="space-y-4">
      {/* Your Purchase Supports Banner */}
      <Alert className="border-primary/20 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription className="text-foreground">
          <span className="font-semibold">Your purchase supports: </span>
          {isEmployeeControlled ? (
            <>The employees and workers of {companyName || 'this company'}</>
          ) : (
            <>{companyName || 'This company'} and its stakeholders</>
          )}
        </AlertDescription>
      </Alert>

      {ownership_structure?.details && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            {ownership_structure.details}
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        {ownership_details.map((detail, index) => {
          const Icon = OWNER_TYPE_ICONS[detail.type] || Building2;
          const label = OWNER_TYPE_LABELS[detail.type] || detail.type;

          return (
            <div 
              key={index}
              className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border"
            >
              <div className="p-2 rounded-full bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              
              <div className="flex-1 space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <div>
                    <span className="font-semibold">{detail.name || label}</span>
                    {detail.percent && (
                      <span className="ml-2 text-2xl font-bold text-primary">
                        {detail.percent}%
                      </span>
                    )}
                  </div>
                </div>
                
                {detail.description && (
                  <p className="text-sm text-muted-foreground">
                    {detail.description}
                  </p>
                )}
                
                {detail.source_url && (
                  <a 
                    href={detail.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Source: {detail.source || 'View details'}
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        Ownership data sourced from public records and company filings. Data currency may vary.
      </p>
    </div>
  );
}
