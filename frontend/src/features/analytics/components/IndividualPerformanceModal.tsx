import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { StatusBadge } from '@/components/StatusBadge';
import { PriorityBadge } from '@/components/PriorityBadge';
import {
  User,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Search,
  Download,
  ExternalLink,
  Loader2,
  Ticket,
  Activity,
  Timer,
  Building2,
  Mail,
  Zap,
  Star,
} from 'lucide-react';

interface IndividualPerformanceModalProps {
  technicianId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IndividualPerformanceModal({
  technicianId,
  open,
  onOpenChange,
}: IndividualPerformanceModalProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');

  const { data, isLoading } = useQuery({
    queryKey: ['individual-technician-performance', technicianId],
    queryFn: async () => {
      if (!technicianId) return null;
      const [res, ratingsRes] = await Promise.all([
        api.get(`/analytics/technician-performance/${technicianId}`),
        supabase
          .from('ticket_ratings')
          .select('ticket_id, rating, feedback_comment, submitted_at')
          .eq('technician_id', technicianId)
          .order('submitted_at', { ascending: true }),
      ]);
      const payload = res.data?.data;
      if (!payload) return null;

      const ratingsByTicket = new Map<string, any>();
      (ratingsRes.data ?? []).forEach((r: any) => {
        if (r.ticket_id) ratingsByTicket.set(r.ticket_id, r);
      });

      const tickets = (payload.tickets || []).map((t: any) => {
        const fallback = ratingsByTicket.get(t.id);
        return {
          ...t,
          rating: t.rating ?? (fallback?.rating !== undefined ? Number(fallback.rating) : null),
          rating_feedback: t.rating_feedback ?? fallback?.feedback_comment ?? null,
          rated_at: t.rated_at ?? fallback?.submitted_at ?? null,
        };
      });

      const ratedValues = tickets
        .map((t: any) => t.rating)
        .filter((v: any): v is number => typeof v === 'number' && !isNaN(v) && v >= 1 && v <= 5);
      const totalRatings = ratedValues.length;
      const avgRating = totalRatings > 0
        ? Math.round((ratedValues.reduce((sum: number, r: number) => sum + r, 0) / totalRatings) * 10) / 10
        : null;

      return {
        ...payload,
        tickets,
        metrics: payload.metrics
          ? {
              ...payload.metrics,
              avgRating: payload.metrics.avgRating ?? avgRating,
              totalRatings: payload.metrics.totalRatings ?? totalRatings,
            }
          : payload.metrics,
      };
    },
    enabled: open && !!technicianId,
    staleTime: 30_000,
  });

  const profile = data?.profile;
  const metrics = data?.metrics;
  const rawTickets = data?.tickets || [];

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return rawTickets.filter((t: any) => {
      if (statusFilter !== 'All' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'All' && t.priority !== priorityFilter) return false;
      if (search.trim()) {
        const term = search.toLowerCase();
        const matchesNo = t.ticket_number?.toLowerCase().includes(term);
        const matchesSub = t.subject?.toLowerCase().includes(term);
        const matchesCat = t.category?.toLowerCase().includes(term);
        if (!matchesNo && !matchesSub && !matchesCat) return false;
      }
      return true;
    });
  }, [rawTickets, search, statusFilter, priorityFilter]);

  // Export CSV
  const handleExportCsv = () => {
    if (!filteredTickets.length) return;
    const headers = [
      'Ticket Number',
      'Subject',
      'Status',
      'Priority',
      'Category',
      'Created At',
      'Due Date',
      'Resolved At',
      'Time Taken (Hours)',
      'Time Taken (Formatted)',
      'SLA Status',
      'Employee Rating',
      'Employee Feedback',
    ];
    const rows = filteredTickets.map((t: any) => [
      `"${t.ticket_number || ''}"`,
      `"${(t.subject || '').replace(/"/g, '""')}"`,
      `"${t.status || ''}"`,
      `"${t.priority || ''}"`,
      `"${t.category || ''}"`,
      `"${t.created_at || ''}"`,
      `"${t.due_date || ''}"`,
      `"${t.resolved_at || ''}"`,
      t.duration_hours ?? '',
      `"${t.duration_formatted || ''}"`,
      `"${t.sla_status || ''}"`,
      t.rating ? `${t.rating}/5` : '',
      `"${(t.rating_feedback || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${profile?.full_name || 'technician'}_performance_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] p-0 overflow-hidden">
        <div className="flex flex-col max-h-[85vh] -m-6">
        {/* Header Profile */}
        <DialogHeader className="p-6 pb-4 pr-12 border-b bg-muted/20 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <Avatar className="h-12 w-12 border-2 border-primary/20 shadow-xs">
                <AvatarImage src={profile?.profile_picture_url} />
                <AvatarFallback className="font-bold text-sm bg-primary/10 text-primary">
                  {(profile?.full_name || 'T').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-xl font-bold">{profile?.full_name || 'Technician Performance'}</DialogTitle>
                  <Badge variant="outline" className="text-xs bg-background">
                    {profile?.employee_id || 'Technician'}
                  </Badge>
                  {metrics?.avgRating !== null && metrics?.avgRating !== undefined && (
                    <Badge variant="outline" className="text-xs bg-amber-50 text-amber-800 border-amber-300 font-semibold flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                      {metrics.avgRating} / 5
                      <span className="text-[10px] font-normal text-amber-700">
                        ({metrics.totalRatings} {metrics.totalRatings === 1 ? 'rating' : 'ratings'})
                      </span>
                    </Badge>
                  )}
                </div>
                <DialogDescription className="text-xs text-muted-foreground flex flex-wrap items-center gap-2 mt-1">
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" /> {profile?.email_address || '—'}
                  </span>
                  {profile?.departments?.name && (
                    <span>• {profile.departments.name}</span>
                  )}
                  {profile?.units?.name && (
                    <span className="flex items-center gap-1">
                      • <Building2 className="h-3 w-3" /> {profile.units.name}
                    </span>
                  )}
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                disabled={!filteredTickets.length}
                className="h-8 gap-1.5 text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                Export Scorecard
              </Button>
            </div>
          </div>

          {/* KPI Strip */}
          {metrics && (
            <div className="grid grid-cols-2 sm:grid-cols-7 gap-2.5 mt-4 pt-3 border-t">
              <div className="p-2.5 rounded-lg bg-card border shadow-xs text-center">
                <span className="text-[11px] text-muted-foreground uppercase font-medium flex items-center justify-center gap-1">
                  <Ticket className="h-3 w-3 text-primary" /> Assigned
                </span>
                <p className="text-lg font-bold text-foreground mt-0.5">{metrics.totalAssigned}</p>
                <span className="text-[10px] text-muted-foreground">Total workload</span>
              </div>

              <div className="p-2.5 rounded-lg bg-card border shadow-xs text-center">
                <span className="text-[11px] text-muted-foreground uppercase font-medium flex items-center justify-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-600" /> Resolved
                </span>
                <p className="text-lg font-bold text-green-600 mt-0.5">{metrics.totalResolved}</p>
                <span className="text-[10px] text-muted-foreground">Completed</span>
              </div>

              <div className="p-2.5 rounded-lg bg-card border shadow-xs text-center">
                <span className="text-[11px] text-muted-foreground uppercase font-medium flex items-center justify-center gap-1">
                  <Activity className="h-3 w-3 text-indigo-600" /> Active
                </span>
                <p className="text-lg font-bold text-indigo-600 mt-0.5">{metrics.currentlyActive}</p>
                <span className="text-[10px] text-muted-foreground">In progress: {metrics.inProgress}</span>
              </div>

              <div className="p-2.5 rounded-lg bg-card border shadow-xs text-center">
                <span className="text-[11px] text-muted-foreground uppercase font-medium flex items-center justify-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-red-600" /> Overdue
                </span>
                <p className="text-lg font-bold text-red-600 mt-0.5">{metrics.overdue}</p>
                <span className="text-[10px] text-muted-foreground">Past due date</span>
              </div>

              <div className="p-2.5 rounded-lg bg-card border shadow-xs text-center">
                <span className="text-[11px] text-muted-foreground uppercase font-medium flex items-center justify-center gap-1">
                  <Timer className="h-3 w-3 text-violet-600" /> Avg Time
                </span>
                <p className="text-lg font-bold text-violet-600 mt-0.5">{metrics.avgResolutionHours}h</p>
                <span className="text-[10px] text-muted-foreground">Per resolved ticket</span>
              </div>

              <div className="p-2.5 rounded-lg bg-card border shadow-xs text-center">
                <span className="text-[11px] text-muted-foreground uppercase font-medium flex items-center justify-center gap-1">
                  <ShieldAlert className="h-3 w-3 text-blue-600" /> SLA
                </span>
                <p className={`text-lg font-bold mt-0.5 ${metrics.slaCompliance >= 90 ? 'text-green-600' : metrics.slaCompliance >= 75 ? 'text-amber-600' : 'text-red-600'}`}>
                  {metrics.slaCompliance}%
                </p>
                <span className="text-[10px] text-muted-foreground">{metrics.compliantCount} ok / {metrics.breachedCount} breach</span>
              </div>

              <div className="p-2.5 rounded-lg bg-amber-50/40 border border-amber-200/80 shadow-xs text-center">
                <span className="text-[11px] text-amber-800 uppercase font-medium flex items-center justify-center gap-1">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-500" /> Rating
                </span>
                <p className="text-lg font-bold text-amber-600 mt-0.5 flex items-center justify-center gap-1">
                  {metrics.avgRating !== null && metrics.avgRating !== undefined ? (
                    <>
                      {metrics.avgRating}
                      <span className="text-xs font-normal text-muted-foreground">/5</span>
                    </>
                  ) : (
                    '—'
                  )}
                </p>
                <span className="text-[10px] text-muted-foreground">
                  {metrics.totalRatings ? `${metrics.totalRatings} employee rating${metrics.totalRatings === 1 ? '' : 's'}` : 'No ratings yet'}
                </span>
              </div>
            </div>
          )}
        </DialogHeader>

        {/* Filter and Search Bar */}
        <div className="p-3.5 border-b bg-background flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search assigned tickets by #, title, or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[125px] h-8 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Status</SelectItem>
                <SelectItem value="Open">Open</SelectItem>
                <SelectItem value="Assigned">Assigned</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Reopened">Reopened</SelectItem>
                <SelectItem value="Waiting for User">Waiting for User</SelectItem>
                <SelectItem value="Resolved">Resolved</SelectItem>
                <SelectItem value="Closed">Closed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
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
          </div>
        </div>

        {/* Ticket List */}
        <div className="flex-1 overflow-y-auto min-h-[300px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">Loading individual technician performance data...</p>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <Ticket className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <h4 className="text-base font-semibold">No tickets found</h4>
              <p className="text-sm text-muted-foreground max-w-sm mt-1">
                {search || statusFilter !== 'All' || priorityFilter !== 'All'
                  ? 'No tickets match the selected filters.'
                  : 'This technician has not been assigned any tickets yet.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-muted/40 text-[11px] font-semibold uppercase text-muted-foreground tracking-wider border-b sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2.5 whitespace-nowrap">Ticket #</th>
                    <th className="px-3 py-2.5 whitespace-nowrap">Priority</th>
                    <th className="px-4 py-2.5">Subject & Category</th>
                    <th className="px-3 py-2.5 whitespace-nowrap">Status</th>
                    <th className="px-3 py-2.5 whitespace-nowrap">Timeline</th>
                    <th className="px-3 py-2.5 whitespace-nowrap">Employee Rating</th>
                    <th className="px-4 py-2.5 text-right whitespace-nowrap">Time Taken / SLA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredTickets.map((t: any) => (
                    <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                      {/* Ticket ID */}
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
                      <td className="px-4 py-3 max-w-[260px]">
                        <p className="text-xs font-semibold text-foreground truncate" title={t.subject}>
                          {t.subject}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {t.category || 'General'} {t.unit ? `• ${t.unit}` : ''}
                        </p>
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <StatusBadge status={t.status} />
                      </td>

                      {/* Timeline */}
                      <td className="px-3 py-3 whitespace-nowrap text-xs text-muted-foreground space-y-0.5">
                        <div className="text-[11px]">
                          <span className="text-muted-foreground/60">Created:</span>{' '}
                          {new Date(t.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </div>
                        {t.resolved_at && (
                          <div className="text-[11px]">
                            <span className="text-muted-foreground/60">Resolved:</span>{' '}
                            {new Date(t.resolved_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </div>
                        )}
                      </td>

                      {/* Employee Rating */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        {t.rating ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1">
                              <div className="flex items-center">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    className={`h-3.5 w-3.5 ${
                                      star <= t.rating
                                        ? 'fill-amber-400 text-amber-500'
                                        : 'text-slate-200 dark:text-slate-700'
                                    }`}
                                  />
                                ))}
                              </div>
                              <span className="text-xs font-bold text-amber-700 ml-1">{t.rating}/5</span>
                            </div>
                            {t.rating_feedback && (
                              <p className="text-[10px] text-muted-foreground italic max-w-[160px] truncate" title={t.rating_feedback}>
                                "{t.rating_feedback}"
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Time Taken & SLA */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex flex-col items-end justify-center gap-1">
                          {t.duration_formatted ? (
                            <Badge
                              variant="secondary"
                              className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md ${
                                t.is_breached
                                  ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-200'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200'
                              }`}
                            >
                              ⏱️ {t.duration_formatted}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">In progress</span>
                          )}

                          <span className="text-[10px]">
                            {t.sla_status === 'Breached' ? (
                              <span className="text-red-600 font-medium flex items-center gap-0.5">
                                <AlertTriangle className="h-3 w-3" /> Breached
                              </span>
                            ) : t.sla_status === 'Compliant' ? (
                              <span className="text-emerald-600 font-medium flex items-center gap-0.5">
                                <CheckCircle2 className="h-3 w-3" /> Compliant
                              </span>
                            ) : t.sla_status === 'Overdue' ? (
                              <span className="text-red-600 font-medium flex items-center gap-0.5">
                                <AlertTriangle className="h-3 w-3" /> Overdue
                              </span>
                            ) : (
                              <span className="text-muted-foreground">{t.sla_status}</span>
                            )}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t bg-muted/20 flex items-center justify-between text-xs text-muted-foreground px-6 shrink-0">
          <span>Showing {filteredTickets.length} of {rawTickets.length} tickets</span>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8">
            Close
          </Button>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
