import { ReactNode, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { useBrandLogo } from "@/hooks/useBrandLogo";

interface BrandIdentityHeaderProps {
  brandName: string;
  logoUrl?: string | null;
  website?: string | null;
  badge?: ReactNode;
  subtitle?: ReactNode;
}

function getWebsiteLabel(website?: string | null) {
  if (!website) return null;
  try {
    const normalized = website.startsWith("http") ? website : `https://${website}`;
    return new URL(normalized).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function BrandIdentityHeader({ brandName, logoUrl, website, badge, subtitle }: BrandIdentityHeaderProps) {
  const displayLogo = useBrandLogo(logoUrl || null, website || null, brandName);
  const [imgError, setImgError] = useState(false);
  const websiteLabel = useMemo(() => getWebsiteLabel(website), [website]);
  const monogram = brandName?.[0]?.toUpperCase() ?? "B";

  return (
    <div className="flex items-center gap-3">
      {displayLogo && !imgError ? (
        <img
          src={displayLogo}
          alt={`${brandName} logo`}
          className="w-16 h-16 rounded-2xl border-2 object-contain bg-muted flex-shrink-0 p-2"
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="w-16 h-16 rounded-2xl border-2 grid place-items-center text-2xl font-bold bg-muted flex-shrink-0">
          {monogram}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-bold tracking-tight truncate">{brandName}</h1>
          {badge}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          {website && websiteLabel && (
            <a
              href={website.startsWith("http") ? website : `https://${website}`}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              {websiteLabel}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {subtitle ? <span className="text-muted-foreground">{subtitle}</span> : null}
        </div>
      </div>
    </div>
  );
}
