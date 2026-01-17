import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  AlignmentResult, 
  getAlignmentColor, 
  getAlignmentBgColor,
  getConfidenceColor,
  getDimensionEmoji 
} from "@/lib/alignmentScore";
import { AlignmentBreakdown } from "./AlignmentBreakdown";
import { ChevronDown, ChevronUp, Sliders, HelpCircle } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface ScoreExplainerProps {
  result: AlignmentResult;
  brandName?: string;
  onOpenSettings?: () => void;
}

export function ScoreExplainer({ result, brandName, onOpenSettings }: ScoreExplainerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const handleOpenSettings = () => {
    if (onOpenSettings) {
      onOpenSettings();
    } else {
      navigate('/settings');
    }
  };

  return (
    <Card className="overflow-hidden">
      {/* Header with score */}
      <div className={`p-4 sm:p-6 ${getAlignmentBgColor(result.score)}`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {result.isPersonalized ? 'Your alignment score' : 'Baseline score'}
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-4xl font-bold ${getAlignmentColor(result.score)}`}>
                {result.score}
              </span>
              <span className="text-lg text-muted-foreground">/100</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {result.summary}
            </p>
          </div>
          
          <Badge variant="outline" className={getConfidenceColor(result.confidence)}>
            {result.confidence}
          </Badge>
        </div>

        {/* Quick insights */}
        {(result.topPositive || result.topNegative) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {result.topPositive && (
              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                {getDimensionEmoji(result.topPositive.dimension)} {result.topPositive.label} helping
              </Badge>
            )}
            {result.topNegative && (
              <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                {getDimensionEmoji(result.topNegative.dimension)} {result.topNegative.label} concern
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Expandable breakdown */}
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            className="w-full justify-between rounded-none border-t h-12"
          >
            <span className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4" />
              Why this score?
            </span>
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="p-4 sm:p-6 pt-0 border-t">
            {/* Explanation header */}
            <div className="mb-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                {result.isPersonalized ? (
                  <>
                    This score reflects how well <strong>{brandName || 'this brand'}</strong> aligns 
                    with <strong>your personal values</strong>. Different users with different priorities 
                    will see different scores for the same brand.
                  </>
                ) : (
                  <>
                    This is a neutral baseline score using equal weights across all dimensions. 
                    <Button 
                      variant="link" 
                      className="h-auto p-0 text-sm"
                      onClick={handleOpenSettings}
                    >
                      Set your values
                    </Button>
                    {' '}to see a personalized score.
                  </>
                )}
              </p>
            </div>

            {/* Dimension breakdown with math calculation */}
            <AlignmentBreakdown result={result} showMath={true} />

            {/* Personalization CTA */}
            {!result.isPersonalized && (
              <Button 
                onClick={handleOpenSettings} 
                className="w-full mt-4"
                variant="outline"
              >
                <Sliders className="h-4 w-4 mr-2" />
                Set your values to personalize
              </Button>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
