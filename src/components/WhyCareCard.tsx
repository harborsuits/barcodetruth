import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, TrendingUp, TrendingDown } from "lucide-react";
import { WhyCareBullet } from "@/lib/whyCare";

interface WhyCareCardProps {
  bullets: WhyCareBullet[];
  onShowEvidence?: (category: string) => void;
}

export function WhyCareCard({ bullets, onShowEvidence }: WhyCareCardProps) {
  if (bullets.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Set your value priorities in Settings to see personalized insights.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Why this score matters to you</h3>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {bullets.map((bullet) => (
          <div key={bullet.category} className="flex gap-2">
            <div className="mt-0.5">
              {bullet.direction === 'higher' ? (
                <TrendingUp className="h-4 w-4 text-orange-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-blue-500" />
              )}
            </div>
            <div className="flex-1 space-y-1">
              <div className="text-sm">
                <span className="font-medium">{bullet.gap}-point gap</span>
                {' on '}
                <span className="text-muted-foreground">{bullet.label}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {bullet.explanation}
              </p>
              {onShowEvidence && (
                <button
                  onClick={() => onShowEvidence(bullet.category)}
                  className="text-xs text-primary hover:underline"
                >
                  Show evidence →
                </button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
