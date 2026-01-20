import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  AlertTriangle, 
  Building2, 
  Globe, 
  ExternalLink, 
  MessageSquarePlus,
  AlertCircle,
  HelpCircle,
  Flag
} from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { SuggestEvidenceDialog } from "@/components/SuggestEvidenceDialog";
import { ReportIssueDialog } from "@/components/ReportIssueDialog";
import { IdentityFixCard } from "@/components/brand/IdentityFixCard";
import type { ProfileStateData, MismatchDetail } from "@/hooks/useProfileState";
import { useBrandLogo } from "@/hooks/useBrandLogo";

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
}

interface NeedsReviewProfileProps {
  brand: BrandData;
  stateData: ProfileStateData;
}

function BrandLogo({ brand }: { brand: BrandData }) {
  const displayLogo = useBrandLogo(brand.logo_url || null, brand.website);
  const [imgError, setImgError] = useState(false);

  if (displayLogo && !imgError) {
    return (
      <img
        src={displayLogo}
        alt={`${brand.name} logo`}
        className="w-16 h-16 rounded-xl object-contain bg-muted border grayscale"
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
    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-muted to-muted-foreground/20 flex items-center justify-center border opacity-60">
      <span className="text-xl font-bold text-muted-foreground">{initials}</span>
    </div>
  );
}

function MismatchDetails({ details }: { details: MismatchDetail[] }) {
  if (details.length === 0) return null;

  return (
    <div className="space-y-2 mt-4">
      <p className="text-xs font-medium text-destructive/80 uppercase tracking-wide">
        Conflicting signals detected
      </p>
      {details.map((detail, index) => (
        <div key={index} className="p-3 bg-destructive/5 rounded-lg border border-destructive/20 text-sm">
          {detail.type === 'name_not_in_description' && (
            <>
              <p className="text-destructive font-medium">Name mismatch</p>
              <p className="text-muted-foreground mt-1">
                Looking for "{detail.expected}" but the description starts with:
              </p>
              <p className="mt-1 text-xs text-muted-foreground italic">
                "{detail.description_excerpt}..."
              </p>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export function NeedsReviewProfile({ brand, stateData }: NeedsReviewProfileProps) {
  const [reportOpen, setReportOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);

  // Build what we DO know (only confident data)
  const knownFacts: { icon: typeof Building2; label: string; value: string; link?: string }[] = [];

  if (brand.website) {
    const domain = brand.website.replace(/^https?:\/\//, '').replace(/\/$/, '');
    knownFacts.push({
      icon: Globe,
      label: 'Website',
      value: domain,
      link: brand.website,
    });
  }

  if (brand.created_at) {
    knownFacts.push({
      icon: Building2,
      label: 'First seen',
      value: format(new Date(brand.created_at), 'MMM d, yyyy'),
    });
  }

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-4">
      {/* Warning Banner */}
      <Alert variant="destructive" className="border-destructive/50 bg-destructive/5">
        <AlertTriangle className="h-5 w-5" />
        <AlertTitle className="text-base">Identity verification needed</AlertTitle>
        <AlertDescription className="mt-2">
          <p>
            We may have matched the wrong entity. Rating is paused until we confirm this brand's identity.
          </p>
          <MismatchDetails details={stateData.mismatch_details} />
        </AlertDescription>
      </Alert>

      {/* Header Card - Muted/Grayed out */}
      <Card className="opacity-80">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <BrandLogo brand={brand} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold truncate">{brand.name}</h1>
                <Badge variant="outline" className="text-xs border-destructive/50 text-destructive">
                  <HelpCircle className="h-3 w-3 mr-1" />
                  Unverified
                </Badge>
              </div>
              {/* Don't show description - it's potentially wrong */}
              <p className="text-sm text-muted-foreground/60 italic mt-2">
                Description withheld pending verification
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* What We Know (Limited) */}
      {knownFacts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
              What we can confirm
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {knownFacts.map((item, index) => (
                <li key={index} className="flex items-center gap-3 text-sm">
                  <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">{item.label}:</span>
                  {item.link ? (
                    <a 
                      href={item.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline truncate inline-flex items-center gap-1"
                    >
                      {item.value}
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    </a>
                  ) : (
                    <span className="font-medium truncate">{item.value}</span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Ownership - Unknown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Who owns this brand?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg border border-dashed">
            <HelpCircle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Unknown</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ownership data withheld until brand identity is verified
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Score - Withheld */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Alignment score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg border border-dashed">
            <AlertCircle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Rating withheld</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Score will be calculated once we verify the correct brand identity
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Interactive Identity Fix */}
      <IdentityFixCard brandId={brand.id} brandName={brand.name} />

      {/* Manual Help Options */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <MessageSquarePlus className="h-4 w-4" />
            Still not right?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            If auto-fix didn't work, you can report the issue manually.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setReportOpen(true)}
            >
              <Flag className="h-4 w-4 mr-1.5" />
              Report mismatch
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setSuggestOpen(true)}
            >
              <ExternalLink className="h-4 w-4 mr-1.5" />
              Suggest correct source
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Why This Matters */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Why are we being careful?</p>
              <p className="text-xs text-muted-foreground mt-1">
                To prevent publishing incorrect information about companies, we pause ratings when 
                we detect potential identity mismatches. This protects both you and the brands we track.
              </p>
            </div>
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
