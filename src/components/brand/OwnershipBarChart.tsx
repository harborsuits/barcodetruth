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

type ShareholderItem = {
  holder_name: string;
  ownership_percentage: number;
  approx_brand_slug?: string | null;
  approx_brand_logo_url?: string | null;
};

interface OwnershipBarChartProps {
  items: ShareholderItem[];
  others?: number | null;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function OwnershipBarChart({ items, others }: OwnershipBarChartProps) {
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
        .map((i) => ({
          name: i.holder_name,
          value: i.ownership_percentage!,
          slug: i.approx_brand_slug,
          logo: i.approx_brand_logo_url,
        }))
    : items.map((i) => ({
        name: i.holder_name,
        value: 1,
        slug: i.approx_brand_slug,
        logo: i.approx_brand_logo_url,
      }));

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
        <foreignObject x={-140} y={-14} width={135} height={28}>
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
            <span className="text-xs truncate max-w-[100px]" title={payload.value}>
              {payload.value}
            </span>
          </div>
        </foreignObject>
      </g>
    );
  };

  const chartHeight = Math.max(180, chartData.length * 40);

  return (
    <div className="w-full">
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
            formatter={(value: number) =>
              hasPercentages
                ? [`${value.toFixed(2)}%`, 'Ownership share']
                : ['Major holder', 'Status']
            }
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

      {/* Legend badges */}
      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
        <span className="rounded-full border px-2 py-0.5">
          Top {chartData.length} institutional holders
        </span>
        {hasPercentages && (
          <span className="rounded-full border px-2 py-0.5">
            Share shown as % of company
          </span>
        )}
        {others && others > 0 && (
          <span className="rounded-full border px-2 py-0.5">
            +{others} other holders
          </span>
        )}
      </div>

      {/* Source attribution */}
      <p className="mt-3 text-xs text-muted-foreground">
        Data from SEC 13F filings and Wikidata. Partial institutional view;
        not all shareholders are shown.
      </p>
    </div>
  );
}
