import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Users, Newspaper, ShieldCheck, Clock } from "lucide-react";
import { useTopShareholders } from "@/hooks/useTopShareholders";

interface ConsumerSummaryProps {
  brandId: string;
  brandName: string;
  description?: string | null;
  eventsCount: number;
  hasEthicalConcerns: boolean;
  lastEventAt?: string | null;
  ownerName?: string | null;
  isPublicCompany: boolean;
  isParentCompany: boolean;
  headquarters?: string | null;
  companyType?: 'public' | 'private' | 'subsidiary' | 'independent' | 'unknown' | null;
}

export function ConsumerSummary({
  brandId,
  brandName,
  description,
  eventsCount,
  hasEthicalConcerns,
  lastEventAt,
  ownerName,
  isPublicCompany,
  isParentCompany,
  headquarters,
  companyType: companyTypeProp,
}: ConsumerSummaryProps) {
  // Check for shareholders to determine public company status (fallback)
  const { data: shareholders = [] } = useTopShareholders(brandId, 3);
  const hasSignificantShareholders = shareholders.length > 0;
  
  // Determine company type for display - prioritize database field
  const getCompanyTypeDisplay = () => {
    // 1. Use explicit company_type from database if available
    if (companyTypeProp === 'public') return "Public Company";
    if (companyTypeProp === 'private') return "Private Company";
    if (companyTypeProp === 'subsidiary') return "Subsidiary";
    if (companyTypeProp === 'independent') return "Independent Brand";
    
    // 2. Fallback to inferred logic
    if (isParentCompany) return "Parent Company";
    if (isPublicCompany || hasSignificantShareholders) return "Public Company";
    if (ownerName) return "Subsidiary";
    
    // 3. Unknown - don't claim private, say we're still verifying
    return "Ownership Pending";
  };
  
  const companyType = getCompanyTypeDisplay();

  // Build summary points
  const summaryPoints: { icon: React.ReactNode; text: string }[] = [];

  // Company type and structure
  if (companyType === "Public Company") {
    summaryPoints.push({
      icon: <Building2 className="h-4 w-4 text-primary flex-shrink-0" />,
      text: `${brandName} is a publicly traded company. Ownership is distributed among shareholders.`,
    });
  } else if (companyType === "Parent Company") {
    summaryPoints.push({
      icon: <Building2 className="h-4 w-4 text-primary flex-shrink-0" />,
      text: `${brandName} is a parent corporation that owns multiple brands and subsidiaries.`,
    });
  } else if (companyType === "Subsidiary" && ownerName) {
    summaryPoints.push({
      icon: <Building2 className="h-4 w-4 text-primary flex-shrink-0" />,
      text: `${brandName} is owned by ${ownerName}.`,
    });
  } else if (companyType === "Independent Brand") {
    summaryPoints.push({
      icon: <ShieldCheck className="h-4 w-4 text-green-600 flex-shrink-0" />,
      text: `${brandName} is a verified independent brand with no parent company.`,
    });
  } else if (companyType === "Private Company") {
    summaryPoints.push({
      icon: <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />,
      text: `${brandName} is a privately held company.`,
    });
  } else {
    // Ownership Pending
    summaryPoints.push({
      icon: <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />,
      text: `We're still verifying ownership details for ${brandName}. Check back soon.`,
    });
  }

  // Headquarters if known
  if (headquarters) {
    summaryPoints.push({
      icon: <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />,
      text: `Headquarters: ${headquarters}`,
    });
  }

  // Recent news activity
  if (eventsCount > 0) {
    summaryPoints.push({
      icon: <Newspaper className="h-4 w-4 text-muted-foreground flex-shrink-0" />,
      text: `${eventsCount} event${eventsCount !== 1 ? "s" : ""} tracked in the last 90 days.`,
    });
  } else {
    summaryPoints.push({
      icon: <Newspaper className="h-4 w-4 text-muted-foreground flex-shrink-0" />,
      text: "No recent events tracked yet. Coverage expands weekly.",
    });
  }

  // Ethical concerns status
  if (hasEthicalConcerns) {
    summaryPoints.push({
      icon: <ShieldCheck className="h-4 w-4 text-amber-600 flex-shrink-0" />,
      text: "Some ethical concerns have been identified. See evidence below.",
    });
  } else if (eventsCount > 0) {
    summaryPoints.push({
      icon: <ShieldCheck className="h-4 w-4 text-green-600 flex-shrink-0" />,
      text: "No significant ethical concerns detected yet.",
    });
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">What We Know So Far</h3>
        <Badge variant="outline" className="text-xs">
          <Clock className="h-3 w-3 mr-1" />
          Auto-updated
        </Badge>
      </div>

      <ul className="space-y-3">
        {summaryPoints.map((point, idx) => (
          <li key={idx} className="flex items-start gap-3 text-sm">
            {point.icon}
            <span className="text-muted-foreground">{point.text}</span>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs text-muted-foreground border-t pt-4">
        This profile updates automatically as we verify more sources. Data is sourced from public records, regulatory filings, and verified news.
      </p>
    </Card>
  );
}
