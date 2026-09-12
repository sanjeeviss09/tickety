import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number; // positive = up, negative = down, 0 = flat
  trendLabel?: string;
  icon?: React.ReactNode;
  colorClass?: string; // e.g. 'text-blue-500'
  bgClass?: string;    // e.g. 'bg-blue-50'
  format?: 'number' | 'percent' | 'hours';
  onClick?: () => void;
}

export function KpiCard({ title, value, subtitle, trend, trendLabel, icon, colorClass = 'text-primary', bgClass = 'bg-primary/10', format, onClick }: KpiCardProps) {
  const displayValue = format === 'percent' ? `${value}%` : format === 'hours' ? `${value}h` : value;

  return (
    <div 
      onClick={onClick}
      className={cn(
        "relative bg-card rounded-xl border shadow-sm p-5 flex flex-col gap-3 transition-all overflow-hidden",
        onClick ? "cursor-pointer hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5" : "hover:shadow-md transition-shadow"
      )}
    >
      {/* Background accent */}
      <div className={cn('absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-30', bgClass)} />

      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {icon && (
          <div className={cn('p-2 rounded-lg', bgClass)}>
            <span className={colorClass}>{icon}</span>
          </div>
        )}
      </div>

      <div>
        <p className={cn('text-3xl font-bold tracking-tight', colorClass)}>{displayValue}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </div>

      {trend !== undefined && (
        <div className="flex items-center gap-1 text-xs font-medium">
          {trend > 0 ? (
            <span className="flex items-center gap-0.5 text-green-600"><ArrowUpRight className="h-3 w-3" />{trend}%</span>
          ) : trend < 0 ? (
            <span className="flex items-center gap-0.5 text-red-500"><ArrowDownRight className="h-3 w-3" />{Math.abs(trend)}%</span>
          ) : (
            <span className="flex items-center gap-0.5 text-muted-foreground"><Minus className="h-3 w-3" />0%</span>
          )}
          {trendLabel && <span className="text-muted-foreground">{trendLabel}</span>}
        </div>
      )}
    </div>
  );
}
