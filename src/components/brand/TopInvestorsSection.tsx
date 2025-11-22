import { Card } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { TopShareholdersCard } from "./TopShareholdersCard";
import { useTopShareholders } from "@/hooks/useTopShareholders";

interface TopInvestorsSectionProps {
  brandId: string;
}

export function TopInvestorsSection({ brandId }: TopInvestorsSectionProps) {
  const { data: shareholders = [], isLoading: shareholdersLoading } = useTopShareholders(brandId, 10);
  
  // Detect if company is likely private (no shareholders data)
  const isLikelyPrivate = !shareholdersLoading && shareholders.length === 0;
  
  // Check if all shareholders are placeholder data (0.00% or source='placeholder')
  const allPlaceholder = shareholders.length > 0 && shareholders.every(sh => 
    (sh.percent_owned === 0 || sh.percent_owned === null) ||
    sh.source === 'placeholder'
  );
  
  // Don't render if all data is placeholder
  if (allPlaceholder) {
    return null;
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5 text-primary" />
        <div>
          <h3 className="font-semibold text-lg">Top Investors (Equity Holders)</h3>
          <p className="text-xs text-muted-foreground mt-1">
            These firms hold shares on behalf of their clients and do not control the company. They are passive investors, not parent organizations.
          </p>
        </div>
      </div>

      <TopShareholdersCard 
        shareholders={shareholders}
        isPrivateCompany={isLikelyPrivate}
        emptyMessage={
          isLikelyPrivate
            ? "This company appears to be privately held and is not required to file public shareholder disclosures."
            : "Shareholder data will appear once SEC 13F filings are processed."
        }
      />
    </Card>
  );
}
