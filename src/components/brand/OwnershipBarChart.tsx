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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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

  if (!items.length && !others) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        We don't yet have verified shareholder data for this company.
      </p>
    );
  }

  // Build chart data
  const chartData = [
    ...items.map((item) => ({
      name: item.holder_name,
      value: item.ownership_percentage ?? 0,
      slug: item.approx_brand_slug,
      logo: item.approx_brand_logo_url,
    })),
    ...(others && others > 0
      ? [{ name: "Others", value: others, slug: null, logo: null }]
      : []),
  ];

  const handleBarClick = (data: { slug?: string | null }) => {
    if (data.slug) {
      navigate(`/brand/${data.slug}`);
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
            <Avatar className="h-5 w-5">
              {item?.logo ? (
                <AvatarImage src={item.logo} alt={payload.value} />
              ) : null}
              <AvatarFallback className="text-[10px] bg-muted">
                {getInitials(payload.value)}
              </AvatarFallback>
            </Avatar>
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
            tickFormatter={(v) => `${v.toFixed(1)}%`}
            tick={{ fontSize: 11 }}
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
            formatter={(value: number) => [`${value.toFixed(2)}%`, "Ownership"]}
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
