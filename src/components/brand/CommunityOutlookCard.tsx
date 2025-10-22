import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { RateBrandModal } from "./RateBrandModal";
import { CategoryOutlook } from "@/types/community";
import { Users, TrendingUp, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "react-router-dom";

interface CommunityOutlookCardProps {
  brandId: string;
  brandName: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  labor: "Labor",
  environment: "Environment",
  politics: "Politics",
  social: "Social",
};

const SCORE_LABELS = [
  { value: 1, label: "Strongly Negative", color: "bg-red-500" },
  { value: 2, label: "Negative", color: "bg-orange-500" },
  { value: 3, label: "Mixed/Neutral", color: "bg-yellow-500" },
  { value: 4, label: "Positive", color: "bg-green-500" },
  { value: 5, label: "Strongly Positive", color: "bg-emerald-500" },
];

export function CommunityOutlookCard({ brandId, brandName }: CommunityOutlookCardProps) {
  const [showModal, setShowModal] = useState(false);

  const { data: outlook, isLoading } = useQuery({
    queryKey: ['community-outlook', brandId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('community-outlook', {
        body: { brand_id: brandId },
      });
      if (error) throw error;
      return data;
    },
  });

  const THRESHOLD = 25;

  const getConfidenceBadge = (confidence: string, n: number) => {
    const variants = {
      none: { label: "Awaiting community ratings", variant: "secondary" as const, icon: "⏳" },
      low: { label: `Low confidence (n=${n})`, variant: "outline" as const, icon: "📊" },
      medium: { label: `Medium confidence (n=${n})`, variant: "default" as const, icon: "📈" },
      high: { label: `High confidence (n=${n})`, variant: "default" as const, icon: "✓" },
    };
    return variants[confidence as keyof typeof variants] || variants.none;
  };

  const renderHistogram = (category: CategoryOutlook) => {
    const total = category.histogram.s1 + category.histogram.s2 + category.histogram.s3 + 
                  category.histogram.s4 + category.histogram.s5;
    
    const hasEnoughData = category.n >= THRESHOLD;
    
    if (total === 0) {
      return (
        <div className="py-4 space-y-2">
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">
              No ratings yet
            </p>
          </div>
          <div className="flex items-center justify-center">
            <Badge variant="secondary" className="text-xs">
              ⏳ 0/{THRESHOLD} ratings needed
            </Badge>
          </div>
        </div>
      );
    }
    
    if (!hasEnoughData) {
      // Show distribution but mark as "To Be Determined"
      return (
        <div className="space-y-2">
          <div className="text-center mb-2">
            <p className="text-xs font-medium text-muted-foreground">
              To Be Determined — awaiting more input
            </p>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {SCORE_LABELS.map((score) => {
              const key = `s${score.value}` as keyof typeof category.histogram;
              const count = category.histogram[key];
              return (
                <div key={score.value} className="flex flex-col items-center gap-2 text-xs">
                  <div className={`w-full h-3 rounded ${score.color}`} />
                  <span className="text-muted-foreground text-center">{score.label}</span>
                  <span className="font-medium">{count}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-center pt-2">
            <Badge variant="secondary" className="text-xs">
              📊 {category.n}/{THRESHOLD} ratings — {THRESHOLD - category.n} more needed
            </Badge>
          </div>
        </div>
      );
    }

    // Has enough data - show scored distribution
    const percentages = {
      s1: (category.histogram.s1 / total) * 100,
      s2: (category.histogram.s2 / total) * 100,
      s3: (category.histogram.s3 / total) * 100,
      s4: (category.histogram.s4 / total) * 100,
      s5: (category.histogram.s5 / total) * 100,
    };

    return (
      <div className="space-y-2">
        <div className="grid grid-cols-5 gap-2 h-24 items-end">
          {SCORE_LABELS.map((score, idx) => {
            const key = `s${score.value}` as keyof typeof percentages;
            const height = percentages[key];
            const count = category.histogram[key as keyof typeof category.histogram];
            if (height === 0) return <div key={idx} className="flex flex-col justify-end" />;
            return (
              <TooltipProvider key={idx}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs font-medium">{count}</span>
                      <div
                        className={`${score.color} w-full rounded transition-all cursor-pointer`}
                        style={{ height: `${height}%` }}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      {score.label}: {count} ({height.toFixed(0)}%)
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
        <div className="grid grid-cols-5 gap-2 text-xs text-muted-foreground">
          {SCORE_LABELS.map((score) => (
            <div key={score.value} className="text-center truncate">
              {score.label}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
          <span>Total ratings: {category.n}</span>
          <Badge variant={getConfidenceBadge(category.confidence, category.n).variant} className="text-xs">
            {getConfidenceBadge(category.confidence, category.n).icon} {getConfidenceBadge(category.confidence, category.n).label}
          </Badge>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-muted rounded w-1/3" />
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded" />
            <div className="h-4 bg-muted rounded" />
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Users className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Community Outlook</h3>
              <Badge variant="outline" className="text-xs">Beta</Badge>
              <Link 
                to="/methodology" 
                className="text-xs text-primary hover:underline inline-flex items-center gap-1 ml-auto"
              >
                <Info className="w-3 h-3" />
                How this works
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              Community perspectives on {brandName}'s conduct across four categories. Share your view after reading the evidence below. Confidence grows with participation.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {outlook?.categories?.map((category: CategoryOutlook) => (
            <div key={category.category} className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">{CATEGORY_LABELS[category.category]}</h4>
              </div>
              {renderHistogram(category)}
            </div>
          ))}
        </div>

        <div className="pt-4 border-t">
          <Button onClick={() => setShowModal(true)} className="w-full" variant="outline">
            <TrendingUp className="w-4 h-4 mr-2" />
            Share Your View
          </Button>
        </div>
      </Card>

      <RateBrandModal
        brandId={brandId}
        brandName={brandName}
        open={showModal}
        onOpenChange={setShowModal}
      />
    </>
  );
}
