import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Barcode, TrendingUp } from "lucide-react";

interface ProductAlternative {
  product_id: string;
  barcode: string;
  product_name: string;
  brand_id: string;
  brand_name: string;
  logo_url: string | null;
  category: string | null;
  score_labor: number;
  score_environment: number;
  score_politics: number;
  score_social: number;
  avg_score: number;
}

interface ProductAlternativeCardProps {
  alternative: ProductAlternative;
}

export function ProductAlternativeCard({ alternative }: ProductAlternativeCardProps) {
  const navigate = useNavigate();

  const handleScanInstead = () => {
    navigate(`/scan/${alternative.barcode}`);
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          {alternative.logo_url && (
            <img
              src={alternative.logo_url}
              alt={alternative.brand_name}
              className="w-12 h-12 object-contain rounded"
            />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base line-clamp-2">
              {alternative.product_name}
            </h3>
            <p className="text-sm text-muted-foreground">
              {alternative.brand_name}
            </p>
          </div>
          <Badge variant="default" className="shrink-0">
            <TrendingUp className="w-3 h-3 mr-1" />
            {Math.round(alternative.avg_score)}%
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Category Scores */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Labor:</span>
            <span className="font-medium">{alternative.score_labor}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Environment:</span>
            <span className="font-medium">{alternative.score_environment}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Politics:</span>
            <span className="font-medium">{alternative.score_politics}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Social:</span>
            <span className="font-medium">{alternative.score_social}</span>
          </div>
        </div>

        {/* Barcode */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Barcode className="w-3 h-3" />
          <code className="font-mono">{alternative.barcode}</code>
        </div>

        {/* Action Button */}
        <Button 
          onClick={handleScanInstead} 
          className="w-full"
          variant="default"
        >
          Scan This Instead
        </Button>
      </CardContent>
    </Card>
  );
}
