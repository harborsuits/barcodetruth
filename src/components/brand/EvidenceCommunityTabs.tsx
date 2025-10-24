import { useState, useEffect } from "react";
import { CommunityOutlookCard } from "./CommunityOutlookCard";

interface EvidenceCommunityTabsProps {
  brandId: string;
  brandName: string;
  evidenceContent: React.ReactNode;
}

export function EvidenceCommunityTabs({ 
  brandId, 
  brandName,
  evidenceContent 
}: EvidenceCommunityTabsProps) {
  const [activeTab, setActiveTab] = useState<"evidence" | "community">("evidence");

  // Analytics: track tab switches
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).rudderstack?.track) {
      (window as any).rudderstack.track('BrandTabSwitch', { tab: activeTab, brandId });
    }
  }, [activeTab, brandId]);

  return (
    <div className="rounded-2xl border-2 border-border overflow-hidden bg-card">
      <div className="flex gap-2 p-2 border-b bg-muted/30" role="tablist" aria-label="Brand information tabs">
        <TabButton
          active={activeTab === "evidence"}
          onClick={() => setActiveTab("evidence")}
          ariaLabel="View evidence timeline"
        >
          Evidence
        </TabButton>
        <TabButton
          active={activeTab === "community"}
          onClick={() => setActiveTab("community")}
          ariaLabel="View community ratings"
        >
          Community Ratings
        </TabButton>
      </div>
      
      <div className="p-4">
        {activeTab === "evidence" ? (
          evidenceContent
        ) : (
          <CommunityOutlookCard brandId={brandId} brandName={brandName} />
        )}
      </div>

    </div>
  );
}

function TabButton({
  active,
  children,
  onClick,
  ariaLabel,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
  ariaLabel?: string;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      aria-label={ariaLabel}
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-background shadow-sm text-foreground border border-border"
          : "text-muted-foreground hover:bg-background/60"
      }`}
    >
      {children}
    </button>
  );
}
