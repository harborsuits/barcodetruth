import { useState } from "react";
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

  return (
    <div className="rounded-2xl border-2 border-border overflow-hidden bg-card">
      <div className="flex gap-2 p-2 border-b bg-muted/30">
        <TabButton
          active={activeTab === "evidence"}
          onClick={() => setActiveTab("evidence")}
        >
          Evidence
        </TabButton>
        <TabButton
          active={activeTab === "community"}
          onClick={() => setActiveTab("community")}
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

      {/* Share your view CTA */}
      {activeTab === "evidence" && (
        <div className="border-t p-4 bg-muted/20">
          <button
            onClick={() => setActiveTab("community")}
            className="text-sm text-primary hover:underline font-medium"
          >
            Share your view →
          </button>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
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
