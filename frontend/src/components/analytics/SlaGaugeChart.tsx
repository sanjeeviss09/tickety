import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from 'recharts';
import { cn } from '@/lib/utils';

interface SlaGaugeChartProps {
  compliance: number;
  title?: string;
  subtitle?: string;
}

export function SlaGaugeChart({ compliance, title = 'SLA Compliance', subtitle }: SlaGaugeChartProps) {
  const color = compliance >= 90 ? '#22c55e' : compliance >= 75 ? '#f59e0b' : '#ef4444';
  const data = [{ value: compliance, fill: color }];

  return (
    <div className="bg-card rounded-xl border shadow-sm p-5 flex flex-col items-center">
      <h3 className="font-semibold text-base w-full">{title}</h3>
      {subtitle && <p className="text-xs text-muted-foreground w-full mb-3">{subtitle}</p>}

      <div className="relative flex items-center justify-center">
        <ResponsiveContainer width={160} height={160}>
          <RadialBarChart
            cx="50%" cy="50%"
            innerRadius="65%" outerRadius="85%"
            startAngle={210} endAngle={-30}
            data={data}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            {/* Background track */}
            <RadialBar background={{ fill: 'hsl(var(--muted))' }} dataKey="value" cornerRadius={10} />
          </RadialBarChart>
        </ResponsiveContainer>
        {/* Center value */}
        <div className="absolute flex flex-col items-center">
          <span className="text-3xl font-bold" style={{ color }}>{compliance}%</span>
          <span className="text-xs text-muted-foreground">Compliance</span>
        </div>
      </div>

      {/* Status badge */}
      <div className={cn(
        'mt-3 text-xs font-semibold px-3 py-1 rounded-full',
        compliance >= 90 ? 'bg-green-100 text-green-700' : compliance >= 75 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
      )}>
        {compliance >= 90 ? '✓ Excellent' : compliance >= 75 ? '⚠ Needs Attention' : '✗ Critical — Review Required'}
      </div>
    </div>
  );
}
