import { useNavigate } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
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

  // Check if we have actual percentages or just names
  const hasPercentages = items.some((item) => item.ownership_percentage > 0);

  // Build chart data - only show items with percentages if we have them
  const chartData = hasPercentages
    ? items
        .filter((item) => item.ownership_percentage > 0)
        .map((item) => ({
          name: item.holder_name,
          value: item.ownership_percentage,
          slug: item.approx_brand_slug,
          logo: item.approx_brand_logo_url,
        }))
    : items.map((item, idx) => ({
        name: item.holder_name,
        value: 1, // Equal weight when no percentages
        slug: item.approx_brand_slug,
        logo: item.approx_brand_logo_url,
      }));

  const handleBarClick = (data: any) => {
    const slug = data?.payload?.slug as string | undefined | null;
    if (slug) {
      navigate(`/brand/${slug}`);
    }
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
        <foreignObject x={-160} y={-12} width={155} height={24}>
          <div className="flex items-center gap-2 justify-end">
            <div className="h-5 w-5 rounded-full overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
              {item?.logo ? (
                <img src={item.logo} alt={payload.value} className="h-full w-full object-contain" />
              ) : (
                <span className="text-[10px] font-medium text-muted-foreground">
                  {getInitials(payload.value)}
                </span>
              )}
            </div>
            <span className="text-xs truncate max-w-[120px]">
              {payload.value}
            </span>
          </div>
        </foreignObject>
      </g>
    );
  };

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 36)}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 170, bottom: 5 }}
        >
          <XAxis
            type="number"
            domain={[0, "dataMax"]}
            tickFormatter={(v) => hasPercentages ? `${v.toFixed(1)}%` : ""}
            tick={{ fontSize: 11 }}
            hide={!hasPercentages}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={CustomYAxisTick as any}
            tickLine={false}
            axisLine={false}
            width={165}
          />
          <Tooltip
            formatter={(value: number) => [
              hasPercentages ? `${value.toFixed(2)}%` : "Major holder",
              "Ownership"
            ]}
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
            }}
          />
          <Bar
            dataKey="value"
            radius={[0, 4, 4, 0]}
            onClick={(data) => handleBarClick(data)}
            cursor="pointer"
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={
                  entry.name === "Others"
                    ? "hsl(var(--muted-foreground))"
                    : "hsl(var(--primary))"
                }
                className={entry.slug ? "cursor-pointer hover:opacity-80" : ""}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
