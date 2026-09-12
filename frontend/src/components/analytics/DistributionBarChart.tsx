import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Button } from '@/components/ui/button';

const COLORS = [
  '#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6',
  '#8b5cf6', '#06b6d4', '#f97316', '#84cc16', '#ec4899'
];

interface DistributionBarChartProps {
  data: { name: string; value: number }[];
  title: string;
  subtitle?: string;
  groupByOptions?: { label: string; value: string }[];
  onGroupByChange?: (groupBy: string) => void;
  loading?: boolean;
  horizontal?: boolean;
}

export function DistributionBarChart({ data, title, subtitle, groupByOptions, onGroupByChange, loading, horizontal = false }: DistributionBarChartProps) {
  const [activeGroupBy, setActiveGroupBy] = useState(groupByOptions?.[0]?.value || '');

  const handleGroupByChange = (val: string) => {
    setActiveGroupBy(val);
    onGroupByChange?.(val);
  };

  const chartData = data.slice(0, 10); // Max 10 items

  return (
    <div className="bg-card rounded-xl border shadow-sm p-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-base">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {groupByOptions && (
          <div className="flex flex-wrap gap-1.5">
            {groupByOptions.map(opt => (
              <Button
                key={opt.value}
                size="sm"
                variant={activeGroupBy === opt.value ? 'default' : 'outline'}
                onClick={() => handleGroupByChange(opt.value)}
                className="h-7 text-xs"
              >
                {opt.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-muted-foreground">Loading...</div>
      ) : chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-muted-foreground">No data</div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          {horizontal ? (
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={80} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10, angle: -20, textAnchor: 'end' }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      )}
    </div>
  );
}
