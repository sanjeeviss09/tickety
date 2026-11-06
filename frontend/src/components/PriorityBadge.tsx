import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertCircle, ArrowUp, ArrowRight, ArrowDown } from 'lucide-react';

export const PRIORITY_CONFIG: Record<string, { color: string, icon: any, label: string }> = {
  Critical: { color: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200', icon: AlertCircle, label: 'Critical' },
  High: { color: 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200', icon: ArrowUp, label: 'High' },
  Medium: { color: 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200', icon: ArrowRight, label: 'Medium' },
  Low: { color: 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200', icon: ArrowDown, label: 'Low' },
};

interface PriorityBadgeProps {
  priority: string;
  className?: string;
  showIcon?: boolean;
}

export function PriorityBadge({ priority, className, showIcon = true }: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG['Medium'];
  const Icon = config.icon;
  
  return (
    <Badge 
      variant="outline" 
      className={cn("whitespace-nowrap px-2.5 py-0.5 text-xs font-semibold border transition-colors flex items-center gap-1", config.color, className)}
    >
      {showIcon && <Icon className="h-3 w-3" />}
      {config.label}
    </Badge>
  );
}
