import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export const STATUS_BG: Record<string, string> = {
  'Open': 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200',
  'Assigned': 'bg-indigo-100 text-indigo-800 border-indigo-200 hover:bg-indigo-200',
  'Accepted': 'bg-violet-100 text-violet-800 border-violet-200 hover:bg-violet-200', // Historical
  'In Progress': 'bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200',
  'Waiting for User': 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200',
  'Awaiting Employee Confirmation': 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200',
  'Reopened': 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200',
  'Resolved': 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200',
  'Closed': 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200',
  'Cancelled': 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const bgClass = STATUS_BG[status] || 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200';
  
  return (
    <Badge 
      variant="outline" 
      className={cn("whitespace-nowrap px-2.5 py-0.5 text-xs font-semibold border transition-colors", bgClass, className)}
    >
      {status}
    </Badge>
  );
}
