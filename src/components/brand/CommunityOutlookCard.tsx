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

  const getConfidenceBadge = (confidence: string) => {
    const variants = {
      none: { label: "Not enough community input yet", variant: "secondary" as const },
      low: { label: "Low confidence (≥10 ratings)", variant: "outline" as const },
      medium: { label: "Medium confidence (≥30 ratings)", variant: "default" as const },
      high: { label: "High confidence (≥100 ratings)", variant: "default" as const },
    };
    return variants[confidence as keyof typeof variants] || variants.none;
  };

  const renderHistogram = (category: CategoryOutlook) => {
    const total = category.histogram.s1 + category.histogram.s2 + category.histogram.s3 + 
                  category.histogram.s4 + category.histogram.s5;
    
    if (total === 0 || category.n < 10) {
      return (
        <div className="text-sm text-muted-foreground py-4 text-center">
          Not enough community input yet
        </div>
      );
    }

    const percentages = {
      s1: (category.histogram.s1 / total) * 100,
      s2: (category.histogram.s2 / total) * 100,
      s3: (category.histogram.s3 / total) * 100,
      s4: (category.histogram.s4 / total) * 100,
      s5: (category.histogram.s5 / total) * 100,
    };

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 h-8">
          {SCORE_LABELS.map((score, idx) => {
            const key = `s${score.value}` as keyof typeof percentages;
            const width = percentages[key];
            if (width === 0) return null;
            return (
              <TooltipProvider key={idx}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`${score.color} h-full rounded transition-all`}
                      style={{ width: `${width}%` }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      {score.label}: {category.histogram[key as keyof typeof category.histogram]} ({width.toFixed(0)}%)
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>n={category.n}</span>
          <Badge variant={getConfidenceBadge(category.confidence).variant} className="text-xs">
            {getConfidenceBadge(category.confidence).label}
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
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Community Outlook</h3>
              <Badge variant="outline" className="text-xs">Beta</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Community perspectives on {brandName}'s conduct, by category. Ratings should be based on the evidence you've read. Confidence grows with more responses.
            </p>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Info className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
               <TooltipContent className="max-w-xs">
                <p className="text-xs font-semibold mb-2">Category Ratings:</p>
                <ul className="text-xs space-y-1">
                  <li><strong>Labor</strong> – treatment, wages, safety, unions</li>
                  <li><strong>Environment</strong> – emissions, waste, resource use</li>
                  <li><strong>Politics</strong> – lobbying, regulation, policy stances</li>
                  <li><strong>Social</strong> – DEI, donations, community impact</li>
                </ul>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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
