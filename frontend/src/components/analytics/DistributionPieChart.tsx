import { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';

const COLORS = [
  '#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6',
  '#8b5cf6', '#06b6d4', '#f97316', '#84cc16', '#ec4899'
];

interface DistributionPieChartProps {
  data: { name: string; value: number }[];
  title: string;
  subtitle?: string;
  groupByOptions?: { label: string; value: string }[];
  onGroupByChange?: (groupBy: string) => void;
  loading?: boolean;
}

export function DistributionPieChart({ data, title, subtitle, groupByOptions, onGroupByChange, loading }: DistributionPieChartProps) {
  const [activeGroupBy, setActiveGroupBy] = useState(groupByOptions?.[0]?.value || '');

  const handleGroupByChange = (val: string) => {
    setActiveGroupBy(val);
    onGroupByChange?.(val);
  };

  const total = data.reduce((sum, d) => sum + d.value, 0);

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
        <div className="h-56 flex items-center justify-center text-muted-foreground">Loading...</div>
      ) : data.length === 0 ? (
        <div className="h-56 flex items-center justify-center text-muted-foreground">No data</div>
      ) : (
        <div className="flex flex-col md:flex-row items-center gap-4">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
              >
                {data.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: any) => [`${value} (${Math.round((value as number) / total * 100)}%)`, 'Count']}
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="flex flex-col gap-2 min-w-32">
            {data.map((item, i) => (
              <div key={item.name} className="flex items-center gap-2 text-xs">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-muted-foreground truncate">{item.name}</span>
                <span className="font-semibold ml-auto">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
