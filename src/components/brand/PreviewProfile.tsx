import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { VerificationProgress } from "./VerificationProgress";
import { 
  Building2, 
  Globe, 
  ExternalLink, 
  Calendar, 
  MessageSquarePlus,
  AlertCircle,
  BookOpen
} from "lucide-react";
import { format } from "date-fns";
import type { ProfileTierData } from "@/hooks/useProfileTier";
import { useState } from "react";
import { SuggestEvidenceDialog } from "@/components/SuggestEvidenceDialog";
import { ReportIssueDialog } from "@/components/ReportIssueDialog";

interface BrandData {
  id: string;
  name: string;
  slug?: string;
  description?: string | null;
  logo_url?: string | null;
  website?: string | null;
  wikidata_qid?: string | null;
  parent_company?: string | null;
  created_at?: string;
  enrichment_stage?: string | null;
}

interface PreviewProfileProps {
  brand: BrandData;
  tierData: ProfileTierData;
}

function BrandLogo({ brand }: { brand: BrandData }) {
  const [imgError, setImgError] = useState(false);

  if (brand.logo_url && !imgError) {
    return (
      <img
        src={brand.logo_url}
        alt={`${brand.name} logo`}
        className="w-16 h-16 rounded-lg object-contain bg-muted"
        onError={() => setImgError(true)}
      />
    );
  }

  // Monogram fallback
  const initials = brand.name
    .split(/\s+/)
    .slice(0, 2)
    .map(word => word[0])
    .join('')
    .toUpperCase();

  return (
    <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-muted to-muted-foreground/20 flex items-center justify-center">
      <span className="text-xl font-bold text-muted-foreground">{initials}</span>
    </div>
  );
}

export function PreviewProfile({ brand, tierData }: PreviewProfileProps) {
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  // Build bullet points from available data
  const bulletPoints: { icon: typeof Building2; label: string; value: string }[] = [];

  if (tierData.parent_company || brand.parent_company) {
    bulletPoints.push({
      icon: Building2,
      label: 'Parent company',
      value: tierData.parent_company || brand.parent_company || '',
    });
  }

  if (brand.website) {
    const domain = brand.website.replace(/^https?:\/\//, '').replace(/\/$/, '');
    bulletPoints.push({
      icon: Globe,
      label: 'Website',
      value: domain,
    });
  }

  if (brand.wikidata_qid) {
    bulletPoints.push({
      icon: BookOpen,
      label: 'Source',
      value: 'Wikipedia',
    });
  }

  if (brand.created_at || tierData.created_at) {
    const createdAt = brand.created_at || tierData.created_at;
    if (createdAt) {
      bulletPoints.push({
        icon: Calendar,
        label: 'Tracking since',
        value: format(new Date(createdAt), 'MMM yyyy'),
      });
    }
  }

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-4">
      {/* Header Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <BrandLogo brand={brand} />
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold truncate">{brand.name}</h1>
              <div className="mt-2">
                <ConfidenceBadge confidence={tierData.confidence} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* What We Know Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">
            What we know so far
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bulletPoints.length > 0 ? (
            <ul className="space-y-3">
              {bulletPoints.map((item, index) => (
                <li key={index} className="flex items-center gap-3 text-sm">
                  <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">{item.label}:</span>
                  <span className="font-medium truncate">{item.value}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              We're just getting started with this brand. Check back soon for more details.
            </p>
          )}

          {/* Description if available */}
          {brand.description && (
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
              {brand.description}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Verification Progress */}
      <VerificationProgress 
        tierData={tierData} 
        enrichmentStage={brand.enrichment_stage || tierData.enrichment_stage}
      />

      {/* Help CTA */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <MessageSquarePlus className="h-4 w-4" />
            Help improve this profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Know something about {brand.name}? Help us verify this brand faster.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setSuggestOpen(true)}
            >
              <ExternalLink className="h-4 w-4 mr-1.5" />
              Suggest a source
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setReportOpen(true)}
            >
              <AlertCircle className="h-4 w-4 mr-1.5" />
              Report issue
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <SuggestEvidenceDialog 
        open={suggestOpen} 
        onOpenChange={setSuggestOpen}
        brandId={brand.id}
        brandName={brand.name}
      />
      <ReportIssueDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        brandId={brand.id}
        brandName={brand.name}
      />
    </div>
  );
}
