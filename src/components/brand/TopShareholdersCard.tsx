import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Building2, TrendingUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import type { Shareholder } from "@/hooks/useTopShareholders";

interface TopShareholdersCardProps {
  shareholders: Shareholder[];
  emptyMessage?: string;
}

export function TopShareholdersCard({ shareholders, emptyMessage }: TopShareholdersCardProps) {
  const hasData = shareholders && shareholders.length > 0;

  return (
    <Card className="p-6 bg-muted/30 border-2">
      <div className="flex items-start gap-3 mb-4">
        <TrendingUp className="h-5 w-5 text-muted-foreground mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold mb-1">Top Institutional Shareholders</h3>
          <p className="text-sm text-muted-foreground">
            Major holders of publicly traded shares
          </p>
        </div>
      </div>

      {hasData ? (
        <>
          <Alert className="mb-4 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
            <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-sm text-blue-900 dark:text-blue-100">
              These firms hold shares on behalf of their clients and do not control the company. 
              They are passive investors, not parent organizations.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            {shareholders.map((shareholder, idx) => (
              <div 
                key={idx}
                className="flex items-start justify-between p-3 rounded-lg bg-background border"
              >
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm truncate">
                        {shareholder.holder_name}
                      </h4>
                      {shareholder.is_asset_manager && (
                        <Badge variant="outline" className="text-xs">
                          Asset Manager
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help">
                              Source: {shareholder.source}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">
                              Data: {shareholder.data_source}<br />
                              Last updated: {format(new Date(shareholder.last_updated), 'MMM d, yyyy')}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </div>

                {shareholder.percent_owned && (
                  <div className="flex-shrink-0 ml-3">
                    <Badge variant="secondary" className="font-mono">
                      {shareholder.percent_owned.toFixed(1)}%
                    </Badge>
                  </div>
                )}
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground mt-4 text-center">
            Shareholder data may not be current and is for informational purposes only
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {emptyMessage || "No shareholder data available."}
        </p>
      )}
    </Card>
  );
}
