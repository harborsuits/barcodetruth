import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface TopHolder {
  name: string;
  type: string;
  percent: number;
}

interface ShareholdersPieChartProps {
  shareholders: TopHolder[];
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--secondary))',
  'hsl(var(--accent))',
  'hsl(var(--muted))',
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff8042',
  '#a4de6c',
  '#d0ed57'
];

export function ShareholdersPieChart({ shareholders }: ShareholdersPieChartProps) {
  if (!shareholders?.length) return null;

  // Take top 5 shareholders for visualization clarity
  const topShareholders = shareholders.slice(0, 5);
  
  const data = topShareholders.map((holder) => ({
    name: holder.name,
    value: holder.percent,
  }));

  return (
    <div className="rounded-2xl border p-4 bg-card">
      <h3 className="text-sm font-medium mb-4">Top Shareholders Distribution</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number) => `${value.toFixed(2)}%`}
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
          />
          <Legend 
            verticalAlign="bottom" 
            height={36}
            formatter={(value) => {
              const holder = topShareholders.find(h => h.name === value);
              return holder ? `${value} (${holder.percent.toFixed(2)}%)` : value;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <p className="text-xs text-muted-foreground mt-3">
        Showing top 5 shareholders. These are investors and do not necessarily imply control.
      </p>
    </div>
  );
}
