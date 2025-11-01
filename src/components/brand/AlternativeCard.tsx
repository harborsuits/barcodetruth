import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface AlternativeCardProps {
  brand_id: string;
  brand_name: string;
  reason: string;
  match_score: number;
  logo_url?: string;
}

export const AlternativeCard = ({ brand_id, brand_name, reason, match_score, logo_url }: AlternativeCardProps) => {
  const navigate = useNavigate();

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Logo */}
          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
            {logo_url ? (
              <img 
                src={logo_url} 
                alt={brand_name}
                className="w-full h-full object-contain"
              />
            ) : (
              <span className="text-lg font-semibold text-muted-foreground">
                {brand_name.charAt(0)}
              </span>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className="font-semibold text-sm truncate">{brand_name}</h3>
              <span className="text-xs font-medium text-primary flex-shrink-0">
                {match_score}% match
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">{reason}</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => navigate(`/brand/${brand_id}`)}
            >
              Learn More
              <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
