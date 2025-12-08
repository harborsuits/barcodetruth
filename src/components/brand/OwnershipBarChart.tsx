import { useNavigate } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Info, TrendingUp, Users } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type ShareholderItem = {
  holder_name: string;
  ownership_percentage: number;
  approx_brand_slug?: string | null;
  approx_brand_logo_url?: string | null;
};

interface OwnershipBarChartProps {
  items: ShareholderItem[];
  others?: number | null;
  brandName?: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getInfluenceTier(index: number, total: number): { label: string; variant: "default" | "secondary" | "outline" } {
  if (index === 0) return { label: "Major", variant: "default" };
  if (index <= 2) return { label: "High", variant: "secondary" };
  if (index <= total * 0.5) return { label: "Significant", variant: "outline" };
  return { label: "Minor", variant: "outline" };
}

function getInfluenceValue(index: number): number {
  if (index === 0) return 60;
  if (index === 1) return 50;
  if (index === 2) return 45;
  if (index <= 4) return 30;
  return 15;
}

export function OwnershipBarChart({ items, others, brandName }: OwnershipBarChartProps) {
  const navigate = useNavigate();

  if (!items.length) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        We don't yet have verified shareholder data for this company.
      </p>
    );
  }

  const hasPercentages = items.some((i) => (i.ownership_percentage ?? 0) > 0);

  const chartData = hasPercentages
    ? items
        .filter((i) => (i.ownership_percentage ?? 0) > 0)
        .map((i, idx) => ({
          name: i.holder_name,
          value: i.ownership_percentage!,
          slug: i.approx_brand_slug,
          logo: i.approx_brand_logo_url,
          tier: getInfluenceTier(idx, items.length),
        }))
    : items.map((i, idx) => ({
        name: i.holder_name,
        value: getInfluenceValue(idx),
        slug: i.approx_brand_slug,
        logo: i.approx_brand_logo_url,
        tier: getInfluenceTier(idx, items.length),
      }));

  // Calculate "others" percentage when we have real data
  const topHoldersTotal = hasPercentages 
    ? chartData.reduce((sum, d) => sum + d.value, 0) 
    : 0;
  const othersPercent = hasPercentages ? Math.max(0, 100 - topHoldersTotal) : null;

  // Generate narrative summary
  const topHolders = chartData.slice(0, 3).map(d => d.name);
  const narrativeSummary = brandName 
    ? `${brandName}, like most publicly traded companies, has significant institutional ownership. ${topHolders.length > 0 ? `${topHolders.join(", ")}${topHolders.length > 1 ? " are among" : " is"} the largest shareholders` : "Major asset managers hold substantial positions"}, influencing corporate governance through voting power.`
    : `This company has typical institutional ownership patterns, with major asset managers holding significant positions.`;

  const handleBarClick = (data: any) => {
    const slug = data?.payload?.slug as string | null | undefined;
    if (slug) navigate(`/brand/${slug}`);
  };

  const CustomYAxisTick = ({
    x,
    y,
    payload,
  }: {
    x: number;
    y: number;
    payload: { value: string };
  }) => {
    const item = chartData.find((d) => d.name === payload.value);
    return (
      <g transform={`translate(${x},${y})`}>
        <foreignObject x={-150} y={-14} width={145} height={28}>
          <div className="flex items-center gap-2 justify-end">
            <div className="h-6 w-6 rounded-full overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
              {item?.logo ? (
                <img
                  src={item.logo}
                  alt={payload.value}
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="text-[10px] font-medium text-muted-foreground">
                  {getInitials(payload.value)}
                </span>
              )}
            </div>
            <span className="text-xs truncate max-w-[110px]" title={payload.value}>
              {payload.value}
            </span>
          </div>
        </foreignObject>
      </g>
    );
  };

  const chartHeight = Math.max(180, chartData.length * 40);

  return (
    <div className="w-full space-y-4">
      {/* Narrative Summary */}
      <div className="rounded-lg bg-muted/50 p-3 border border-border/50">
        <div className="flex items-start gap-2">
          <Users className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-sm text-muted-foreground leading-relaxed">
            {narrativeSummary}
          </p>
        </div>
      </div>

      {/* Influence Badges Row */}
      <div className="flex flex-wrap gap-2">
        {chartData.slice(0, 5).map((holder, idx) => (
          <Badge 
            key={holder.name} 
            variant={holder.tier.variant}
            className="cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => holder.slug && navigate(`/brand/${holder.slug}`)}
          >
            <span className="mr-1">{idx === 0 ? "⭐" : idx <= 2 ? "▲" : "●"}</span>
            {holder.name.split(" ")[0]} · {holder.tier.label}
          </Badge>
        ))}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 8, right: 60, left: 145, bottom: 8 }}
        >
          <XAxis
            type="number"
            hide={!hasPercentages}
            domain={[0, 'dataMax']}
            tickFormatter={(v) => `${v.toFixed(0)}%`}
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            tickLine={{ stroke: 'hsl(var(--border))' }}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={CustomYAxisTick as any}
            axisLine={false}
            tickLine={false}
            width={140}
          />
          <RechartsTooltip
            formatter={(value: number, name: string, props: any) => {
              const tier = props?.payload?.tier?.label || 'Holder';
              return hasPercentages
                ? [`${value.toFixed(2)}% · ${tier} influence`, 'Ownership']
                : [`${tier} influence`, 'Status'];
            }}
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 6,
              fontSize: 12,
            }}
          />
          <Bar
            dataKey="value"
            fill="hsl(var(--primary))"
            radius={[0, 4, 4, 0]}
            onClick={handleBarClick}
            cursor="pointer"
          >
            <LabelList
              dataKey="value"
              position="right"
              formatter={(v: number) =>
                hasPercentages ? `${v.toFixed(1)}%` : ''
              }
              style={{ fontSize: 11, fill: 'hsl(var(--foreground))' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Others Row */}
      {(othersPercent !== null || (others && others > 0)) && (
        <div className="flex items-center gap-3 px-1">
          <div className="flex items-center gap-2 min-w-[145px] justify-end">
            <div className="h-6 w-6 rounded-full bg-muted/70 flex items-center justify-center">
              <span className="text-[10px] font-medium text-muted-foreground">+</span>
            </div>
            <span className="text-xs text-muted-foreground">
              Others {others ? `(${others.toLocaleString()}+)` : ''}
            </span>
          </div>
          <div className="flex-1 h-4 bg-muted/40 rounded overflow-hidden">
            <div 
              className="h-full bg-muted rounded"
              style={{ width: othersPercent ? `${Math.min(othersPercent, 100)}%` : '75%' }}
            />
          </div>
          <span className="text-xs text-muted-foreground min-w-[40px]">
            {othersPercent ? `${othersPercent.toFixed(1)}%` : 'Retail + other institutional'}
          </span>
        </div>
      )}

      {/* Legend badges */}
      <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
        <span className="rounded-full border px-2 py-0.5">
          Top {chartData.length} institutional holders
        </span>
        {!hasPercentages && (
          <span className="rounded-full border px-2 py-0.5">
            Bar length shows relative influence
          </span>
        )}
        {hasPercentages && (
          <span className="rounded-full border px-2 py-0.5">
            Share shown as % of company
          </span>
        )}
      </div>

      {/* Why This Matters - Collapsible */}
      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors group">
          <Info className="h-3.5 w-3.5" />
          <span className="underline underline-offset-2 group-hover:no-underline">
            Why ownership matters
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground space-y-1.5">
            <p className="flex items-center gap-2">
              <TrendingUp className="h-3 w-3 flex-shrink-0" />
              Shareholders influence board decisions &amp; executive pay
            </p>
            <p className="flex items-center gap-2">
              <TrendingUp className="h-3 w-3 flex-shrink-0" />
              Large holders vote on ESG policies, labor practices, political spending
            </p>
            <p className="flex items-center gap-2">
              <TrendingUp className="h-3 w-3 flex-shrink-0" />
              Asset managers like BlackRock &amp; Vanguard appear in most Fortune 500 companies
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Source attribution */}
      <p className="text-xs text-muted-foreground">
        Data from SEC 13F filings and Wikidata. Partial institutional view; not all shareholders shown.
      </p>
    </div>
  );
}
