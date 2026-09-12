import { useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Button } from '@/components/ui/button';

type Period = 'day' | 'week' | 'month' | 'year';

interface TicketTrendChartProps {
  data: any[];
  onPeriodChange: (period: Period) => void;
  loading?: boolean;
}

const PERIODS: { label: string; value: Period }[] = [
  { label: 'Daily', value: 'day' },
  { label: 'Weekly', value: 'week' },
  { label: 'Monthly', value: 'month' },
  { label: 'Yearly', value: 'year' },
];

export function TicketTrendChart({ data, onPeriodChange, loading }: TicketTrendChartProps) {
  const [period, setPeriod] = useState<Period>('month');
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
    onPeriodChange(p);
  };

  return (
    <div className="bg-card rounded-xl border shadow-sm p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="font-semibold text-base">Ticket Trends</h3>
          <p className="text-xs text-muted-foreground">Created vs Resolved over time</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PERIODS.map(p => (
            <Button
              key={p.value}
              size="sm"
              variant={period === p.value ? 'default' : 'outline'}
              onClick={() => handlePeriodChange(p.value)}
              className="h-7 text-xs"
            >
              {p.label}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={() => setChartType(t => t === 'line' ? 'bar' : 'line')} className="h-7 text-xs">
            {chartType === 'line' ? '⊞ Bar' : '↗ Line'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-muted-foreground">Loading chart...</div>
      ) : data.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-muted-foreground">No data available</div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          {chartType === 'line' ? (
            <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
              <Legend />
              <Line type="monotone" dataKey="created" name="Created" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#22c55e" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="critical" name="Critical" stroke="#ef4444" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
              <Legend />
              <Bar dataKey="created" name="Created" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="resolved" name="Resolved" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="critical" name="Critical" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      )}
    </div>
  );
}
