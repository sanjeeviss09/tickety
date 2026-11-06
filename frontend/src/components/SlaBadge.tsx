import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, Clock, ShieldAlert } from 'lucide-react';

interface SlaBadgeProps {
  dueDate?: string | null;
  status: string;
  resolutionDate?: string | null;
  closedAt?: string | null;
  createdAt?: string | null;
  className?: string;
}

export function SlaBadge({ dueDate, status, resolutionDate, closedAt, createdAt, className }: SlaBadgeProps) {
  const isCompleted = ['Resolved', 'Closed', 'Cancelled'].includes(status);
  const completedAt = resolutionDate ? new Date(resolutionDate) : (closedAt ? new Date(closedAt) : null);

  let timeTakenStr = '';
  let durationHours = 0;
  if (completedAt && createdAt) {
    durationHours = Math.max(0, Math.round(((completedAt.getTime() - new Date(createdAt).getTime()) / 3_600_000) * 10) / 10);
    timeTakenStr = durationHours < 1
      ? `${Math.max(1, Math.round(durationHours * 60))}m`
      : durationHours < 24
      ? `${durationHours}h`
      : `${Math.floor(durationHours / 24)}d ${Math.round(durationHours % 24)}h`;
  }

  if (!dueDate) {
    if (isCompleted && timeTakenStr) {
      return (
        <Badge
          variant="outline"
          className={cn("whitespace-nowrap px-2 py-0.5 text-[11px] font-medium bg-muted/60 text-muted-foreground gap-1 border-muted", className)}
          title={`Resolved in ${durationHours}h`}
        >
          <Clock className="h-3 w-3 shrink-0" />
          {timeTakenStr}
        </Badge>
      );
    }
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const now = new Date();
  const due = new Date(dueDate);

  if (isCompleted) {
    if (completedAt && completedAt > due) {
      return (
        <Badge
          variant="outline"
          className={cn("whitespace-nowrap px-2 py-0.5 text-[11px] font-semibold bg-red-50 text-red-700 border-red-200 gap-1", className)}
          title={timeTakenStr ? `Resolved in ${timeTakenStr} (Breached SLA)` : 'Breached SLA'}
        >
          <ShieldAlert className="h-3 w-3 text-red-600 shrink-0" />
          Breached {timeTakenStr ? `· ${timeTakenStr}` : ''}
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className={cn("whitespace-nowrap px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border-emerald-200 gap-1", className)}
        title={timeTakenStr ? `Resolved in ${timeTakenStr}` : 'SLA Compliant'}
      >
        <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
        Compliant {timeTakenStr ? `· ${timeTakenStr}` : ''}
      </Badge>
    );
  }

  // Active ticket
  const diffH = (due.getTime() - now.getTime()) / 3_600_000;

  if (diffH < 0) {
    return (
      <Badge
        variant="outline"
        className={cn("whitespace-nowrap px-2 py-0.5 text-[11px] font-semibold bg-red-100 text-red-800 border-red-300 gap-1 animate-pulse", className)}
      >
        <AlertTriangle className="h-3 w-3 text-red-600 shrink-0" />
        Overdue
      </Badge>
    );
  }

  if (diffH < 4) {
    return (
      <Badge
        variant="outline"
        className={cn("whitespace-nowrap px-2 py-0.5 text-[11px] font-semibold bg-orange-50 text-orange-700 border-orange-200 gap-1", className)}
      >
        <Clock className="h-3 w-3 text-orange-600 shrink-0" />
        At Risk
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn("whitespace-nowrap px-2 py-0.5 text-[11px] font-semibold bg-green-50 text-green-700 border-green-200 gap-1", className)}
    >
      <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />
      On Track
    </Badge>
  );
}
