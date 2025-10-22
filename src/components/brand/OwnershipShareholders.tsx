import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, PieChart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Cell, Pie, PieChart as RechartsPieChart, ResponsiveContainer, Tooltip } from "recharts";

interface ShareholderBucket {
  key: 'institutional' | 'insider' | 'strategic' | 'gov' | 'other';
  percent: number;
  source_name?: string;
  source_url?: string;
}

interface TopHolder {
  name: string;
  type: string;
  percent: number;
  url?: string;
  official_url?: string;
  wikipedia_url?: string;
  wikidata_qid?: string;
  logo_url?: string;
  source_name?: string;
  source_url?: string;
}

interface ShareholdersData {
  subject_company?: string;
  as_of?: string;
  buckets?: ShareholderBucket[];
  top?: TopHolder[];
}

interface OwnershipShareholdersProps {
  shareholders: ShareholdersData;
}

const BUCKET_COLORS: Record<string, string> = {
  institutional: 'hsl(var(--chart-1))',
  insider: 'hsl(var(--chart-2))',
  strategic: 'hsl(var(--chart-3))',
  gov: 'hsl(var(--chart-4))',
  other: 'hsl(var(--chart-5))',
};

const BUCKET_LABELS: Record<string, string> = {
  institutional: 'Institutional',
  insider: 'Insiders',
  strategic: 'Strategic',
  gov: 'Government',
  other: 'Others',
};

export function OwnershipShareholders({ shareholders }: OwnershipShareholdersProps) {
  const { subject_company, as_of, buckets = [], top = [] } = shareholders;

  const chartData = buckets.map(bucket => ({
    name: BUCKET_LABELS[bucket.key] || bucket.key,
    value: bucket.percent,
    key: bucket.key,
  }));

  const handleSliceClick = (index: number) => {
    const bucket = buckets[index];
    if (bucket?.source_url) {
      window.open(bucket.source_url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="space-y-6">
      <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
        <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="text-sm text-blue-900 dark:text-blue-100">
          <strong>Important:</strong> Institutional investors are shareholders, not parent companies. 
          They hold shares on behalf of their clients and do not control the company.
        </AlertDescription>
      </Alert>

      {subject_company && (
        <div className="text-center mb-4">
          <h4 className="font-semibold text-lg mb-1">{subject_company}</h4>
          {as_of && (
            <p className="text-sm text-muted-foreground">
              Data as of {new Date(as_of).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          )}
        </div>
      )}

      {/* Donut Chart */}
      {chartData.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <PieChart className="h-5 w-5 text-muted-foreground" />
            <h4 className="font-semibold">Ownership Distribution</h4>
          </div>
          
          <ResponsiveContainer width="100%" height={300}>
            <RechartsPieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
                onClick={(_, index) => handleSliceClick(index)}
                style={{ cursor: buckets.some(b => b.source_url) ? 'pointer' : 'default' }}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.key} fill={BUCKET_COLORS[entry.key]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => `${value.toFixed(2)}%`}
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
            </RechartsPieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top Holders List */}
      {top && top.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold">Top Shareholders</h4>
          <div className="space-y-2">
            {top.map((holder, idx) => (
              <div 
                key={idx}
                className="flex items-center justify-between p-3 rounded-lg bg-background border"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {holder.logo_url ? (
                    <img 
                      src={holder.logo_url} 
                      alt={holder.name}
                      className="w-8 h-8 rounded object-contain"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-semibold text-sm">
                      {idx + 1}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {holder.url ? (
                      <a 
                        href={holder.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="font-medium text-sm truncate hover:underline block"
                      >
                        {holder.name}
                      </a>
                    ) : (
                      <h5 className="font-medium text-sm truncate">{holder.name}</h5>
                    )}
                    <Badge variant="outline" className="text-xs mt-1 capitalize">
                      {BUCKET_LABELS[holder.type] || holder.type}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-3">
                  {holder.source_url && (
                    <a 
                      href={holder.source_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:underline"
                    >
                      {holder.source_name || 'Proof'}
                    </a>
                  )}
                  <Badge variant="secondary" className="font-mono">
                    {holder.percent.toFixed(2)}%
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center mt-6 pt-4 border-t">
        Shareholder data may not be current and is for informational purposes only
      </p>
    </div>
  );
}
