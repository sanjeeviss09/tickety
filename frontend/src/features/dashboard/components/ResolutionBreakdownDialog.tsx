import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../../../lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PriorityBadge } from '@/components/PriorityBadge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Timer,
  Clock,
  Search,
  Download,
  CheckCircle2,
  AlertTriangle,
  ArrowUpDown,
  ExternalLink,
  Zap,
  TrendingUp,
  Loader2,
  Calendar,
} from 'lucide-react';

interface ResolutionBreakdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  technicianId?: string;
}

export function ResolutionBreakdownDialog({
  open,
  onOpenChange,
  technicianId,
}: ResolutionBreakdownDialogProps) {
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('All');
  const [sla, setSla] = useState('All');
  const [sortBy, setSortBy] = useState('time_desc');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['resolution-breakdown', technicianId, priority, sla, sortBy],
    queryFn: async () => {
      const params: Record<string, string> = { sortBy };
      if (technicianId) params.technician_id = technicianId;
      if (priority !== 'All') params.priority = priority;
      if (sla !== 'All') params.sla = sla;
      const res = await api.get('/analytics/resolution-breakdown', { params });
      return res.data?.data;
    },
    enabled: open,
    staleTime: 60_000,
  });

  const summary = data?.summary;
  const rawTickets = data?.tickets || [];

  // Client-side search filtering
  const tickets = useMemo(() => {
    if (!search.trim()) return rawTickets;
    const term = search.toLowerCase();
    return rawTickets.filter((t: any) =>
      t.ticket_number?.toLowerCase().includes(term) ||
      t.subject?.toLowerCase().includes(term) ||
      t.assignee?.full_name?.toLowerCase().includes(term) ||
      t.category?.toLowerCase().includes(term) ||
      t.department?.toLowerCase().includes(term)
    );
  }, [rawTickets, search]);

  // Export to CSV
  const handleExportCsv = () => {
    if (!tickets.length) return;
    const headers = [
      'Ticket Number',
      'Subject',
      'Priority',
      'Status',
      'Category',
      'Assignee',
      'Created At',
      'Resolved At',
      'Resolution Time (Hours)',
      'Resolution Time (Formatted)',
      'SLA Status',
    ];
    const rows = tickets.map((t: any) => [
      `"${t.ticket_number || ''}"`,
      `"${(t.subject || '').replace(/"/g, '""')}"`,
      `"${t.priority || ''}"`,
      `"${t.status || ''}"`,
      `"${t.category || ''}"`,
      `"${t.assignee?.full_name || 'Unassigned'}"`,
      `"${t.created_at || ''}"`,
      `"${t.resolved_at || ''}"`,
      t.resolution_hours ?? '',
      `"${t.resolution_formatted || ''}"`,
      `"${t.sla_status || ''}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `resolution_times_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] p-0 overflow-hidden">
        <div className="flex flex-col max-h-[85vh] -m-6">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 pr-12 border-b bg-muted/20 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                <Timer className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">Resolution Time Breakdown</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Detailed individual resolution duration for every resolved & closed ticket
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                disabled={!tickets.length}
                className="h-8 gap-1.5 text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-3 border-t">
              <div className="p-2.5 rounded-lg bg-card border shadow-xs">
                <span className="text-[11px] text-muted-foreground uppercase font-medium flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-violet-600" /> Avg Resolution
                </span>
                <p className="text-lg font-bold text-violet-600 mt-0.5">
                  {summary.avgResolutionHours}h
                </p>
                <span className="text-[10px] text-muted-foreground">Across {summary.totalResolved} tickets</span>
              </div>

              <div className="p-2.5 rounded-lg bg-card border shadow-xs">
                <span className="text-[11px] text-muted-foreground uppercase font-medium flex items-center gap-1">
                  <Zap className="h-3 w-3 text-emerald-600" /> Fastest
                </span>
                <p className="text-lg font-bold text-emerald-600 mt-0.5">
                  {summary.minResolutionHours}h
                </p>
                <span className="text-[10px] text-muted-foreground">Quickest resolution</span>
              </div>

              <div className="p-2.5 rounded-lg bg-card border shadow-xs">
                <span className="text-[11px] text-muted-foreground uppercase font-medium flex items-center gap-1">
                  <Clock className="h-3 w-3 text-amber-600" /> Longest
                </span>
                <p className="text-lg font-bold text-amber-600 mt-0.5">
                  {summary.maxResolutionHours}h
                </p>
                <span className="text-[10px] text-muted-foreground">Max duration recorded</span>
              </div>

              <div className="p-2.5 rounded-lg bg-card border shadow-xs">
                <span className="text-[11px] text-muted-foreground uppercase font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-blue-600" /> SLA Compliance
                </span>
                <p className="text-lg font-bold text-blue-600 mt-0.5">
                  {summary.slaComplianceRate}%
                </p>
                <span className="text-[10px] text-muted-foreground">{summary.compliantCount} compliant / {summary.breachedCount} breached</span>
              </div>
            </div>
          )}
        </DialogHeader>

        {/* Filter and Search Bar */}
        <div className="p-4 border-b bg-background flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by ticket #, subject, assignee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="w-[120px] h-9 text-xs">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Priority</SelectItem>
                <SelectItem value="Critical">Critical</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sla} onValueChange={setSla}>
              <SelectTrigger className="w-[125px] h-9 text-xs">
                <SelectValue placeholder="SLA" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All SLA</SelectItem>
                <SelectItem value="compliant">Compliant</SelectItem>
                <SelectItem value="breached">Breached</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[150px] h-9 text-xs">
                <ArrowUpDown className="h-3 w-3 mr-1 text-muted-foreground" />
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="time_desc">Slowest First</SelectItem>
                <SelectItem value="time_asc">Fastest First</SelectItem>
                <SelectItem value="recent">Recently Resolved</SelectItem>
                <SelectItem value="oldest">Oldest Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tickets Table / List */}
        <div className="flex-1 overflow-y-auto min-h-[300px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">Calculating individual ticket resolution times...</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <Clock className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <h4 className="text-base font-semibold">No resolved tickets found</h4>
              <p className="text-sm text-muted-foreground max-w-sm mt-1">
                {search || priority !== 'All' || sla !== 'All'
                  ? 'No tickets match the selected filters. Try resetting the search or filter options.'
                  : 'There are no resolved or closed tickets recorded in the system yet.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-muted/40 text-xs font-semibold uppercase text-muted-foreground tracking-wider border-b sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2.5 whitespace-nowrap">Ticket #</th>
                    <th className="px-3 py-2.5 whitespace-nowrap">Priority</th>
                    <th className="px-4 py-2.5">Subject & Category</th>
                    <th className="px-3 py-2.5 whitespace-nowrap">Assignee</th>
                    <th className="px-3 py-2.5 whitespace-nowrap">Timeline</th>
                    <th className="px-4 py-2.5 text-right whitespace-nowrap">Time Taken</th>
                    <th className="px-4 py-2.5 text-right whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tickets.map((t: any) => {
                    const isOverAvg = summary?.avgResolutionHours && t.resolution_hours > summary.avgResolutionHours;

                    return (
                      <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                        {/* Ticket # */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Link
                            to={`/tickets/${t.id}`}
                            className="font-mono text-xs font-semibold text-primary hover:underline"
                            onClick={() => onOpenChange(false)}
                          >
                            {t.ticket_number}
                          </Link>
                        </td>

                        {/* Priority */}
                        <td className="px-3 py-3 whitespace-nowrap">
                          <PriorityBadge priority={t.priority} showIcon={false} />
                        </td>

                        {/* Subject & Category */}
                        <td className="px-4 py-3 max-w-[240px]">
                          <p className="text-sm font-medium truncate" title={t.subject}>
                            {t.subject}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {t.category || 'General'} {t.department ? `• ${t.department}` : ''}
                          </p>
                        </td>

                        {/* Assignee */}
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={t.assignee?.profile_picture_url} />
                              <AvatarFallback className="text-[10px]">
                                {(t.assignee?.full_name || 'U').slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs truncate max-w-[120px] text-muted-foreground">
                              {t.assignee?.full_name || 'Unassigned'}
                            </span>
                          </div>
                        </td>

                        {/* Timeline */}
                        <td className="px-3 py-3 whitespace-nowrap text-xs text-muted-foreground space-y-0.5">
                          <div className="flex items-center gap-1 text-[11px]">
                            <span className="text-muted-foreground/60">Created:</span>{' '}
                            {new Date(t.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </div>
                          <div className="flex items-center gap-1 text-[11px]">
                            <span className="text-muted-foreground/60">Resolved:</span>{' '}
                            {new Date(t.resolved_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>

                        {/* Time Taken */}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex flex-col items-end justify-center gap-1">
                            <Badge
                              variant="secondary"
                              className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md ${
                                t.is_breached
                                  ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-200'
                                  : isOverAvg
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200'
                              }`}
                            >
                              ⏱️ {t.resolution_formatted}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {t.sla_status === 'Breached' ? (
                                <span className="text-red-600 font-medium flex items-center gap-0.5">
                                  <AlertTriangle className="h-3 w-3" /> SLA Breached
                                </span>
                              ) : t.sla_status === 'Compliant' ? (
                                <span className="text-emerald-600 font-medium flex items-center gap-0.5">
                                  <CheckCircle2 className="h-3 w-3" /> Compliant
                                </span>
                              ) : (
                                'No SLA'
                              )}
                            </span>
                          </div>
                        </td>

                        {/* Action */}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="h-7 px-2 text-xs text-primary hover:text-primary/80"
                            onClick={() => onOpenChange(false)}
                          >
                            <Link to={`/tickets/${t.id}`}>
                              View <ExternalLink className="h-3 w-3 ml-1" />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t bg-muted/20 flex items-center justify-between text-xs text-muted-foreground px-6 shrink-0">
          <span>Showing {tickets.length} of {rawTickets.length} resolved tickets</span>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8">
            Close
          </Button>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
