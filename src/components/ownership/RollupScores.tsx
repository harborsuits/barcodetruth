import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Building2 } from 'lucide-react';
import { format } from 'date-fns';

interface RollupScore {
  score: number;
  score_environment: number;
  score_labor: number;
  score_politics: number;
  score_social: number;
  entity_count: number;
  last_updated: string;
}

export function RollupScores({ brandId }: { brandId: string }) {
  const { data: rollup, isLoading } = useQuery({
    queryKey: ['rollup-scores', brandId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_brand_rollup_scores' as any, {
        p_brand_id: brandId,
      });
      if (error) throw error;
      return data as unknown as RollupScore;
    },
    enabled: Boolean(brandId),
  });

  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-32 w-full" />
      </Card>
    );
  }

  if (!rollup || rollup.entity_count === 0 || rollup.entity_count === 1) {
    return null;
  }

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const categories = [
    { key: 'labor', label: 'Labor', value: rollup.score_labor },
    { key: 'environment', label: 'Environment', value: rollup.score_environment },
    { key: 'politics', label: 'Politics', value: rollup.score_politics },
    { key: 'social', label: 'Social', value: rollup.score_social },
  ];

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">Consolidated Score</h3>
        </div>
        <Badge variant="outline" className="gap-1">
          <Building2 className="h-3 w-3" />
          {rollup.entity_count} entities
        </Badge>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">Overall</div>
          <div className={`text-3xl font-bold ${getScoreColor(rollup.score)}`}>
            {rollup.score}
          </div>
        </div>
        {categories.map((cat) => (
          <div key={cat.key} className="space-y-1">
            <div className="text-xs text-muted-foreground">{cat.label}</div>
            <div className={`text-2xl font-semibold ${getScoreColor(cat.value)}`}>
              {cat.value}
            </div>
          </div>
        ))}
      </div>

      {rollup.last_updated && (
        <div className="text-xs text-muted-foreground pt-2 border-t">
          Last updated: {format(new Date(rollup.last_updated), 'MMM d, yyyy h:mm a')}
        </div>
      )}
    </Card>
  );
}
