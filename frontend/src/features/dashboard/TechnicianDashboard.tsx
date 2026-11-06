import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import {
  useTechnicianDashboardData,
  useTechnicianActiveTickets,
  useTodaysWork,
  useSlaRiskTickets,
  useCriticalTickets,
  useRecentAssignments,
  useWaitingForUserTickets,
  useRecentlyResolvedTickets,
  useTechnicianNotifications,
  useTechnicianSupportAssets,
  useTechnicianKbArticles,
  useTechnicianTicketsRealtime,
  useMarkNotificationRead,
  useTechnicianStatusOverview,
  useTechnicianPriorityOverview,
  useAwaitingConfirmationTickets,
  useReopenedTickets,
} from './hooks/useTechnicianDashboard';

import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import {
  Ticket, Clock, CheckCircle, AlertTriangle, Timer, RefreshCw,
  Eye, Package, BookOpen, Wrench, Bell, AlertCircle, ChevronRight,
  Search, ExternalLink, Shield, User, Building2, MapPin, Phone, Mail,
  CheckSquare, FileText, Monitor, WifiOff, PrinterIcon,
  ChevronLeft, Inbox, Zap, TrendingUp, Activity, ListChecks,
  ArrowRight, Star, CheckCheck, XCircle, ClockAlert, Loader2, X,
} from 'lucide-react';

import { ResolutionBreakdownDialog } from './components/ResolutionBreakdownDialog';


// ─── Shared constants ─────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; bg: string; text: string }> = {
  'Open':                            { label: 'Open',             bg: 'bg-blue-100',   text: 'text-blue-800' },
  'Assigned':                        { label: 'Assigned',         bg: 'bg-indigo-100', text: 'text-indigo-800' },
  'In Progress':                     { label: 'In Progress',      bg: 'bg-purple-100', text: 'text-purple-800' },
  'Waiting for User':                { label: 'Waiting',          bg: 'bg-yellow-100', text: 'text-yellow-800' },
  'Awaiting Employee Confirmation':   { label: 'Awaiting Confirm', bg: 'bg-orange-100', text: 'text-orange-800' },
  'Resolved':                        { label: 'Resolved',         bg: 'bg-green-100',  text: 'text-green-700' },
  'Closed':                          { label: 'Closed',           bg: 'bg-gray-100',   text: 'text-gray-700' },
  'Cancelled':                       { label: 'Cancelled',        bg: 'bg-red-100',    text: 'text-red-700' },
  'Reopened':                        { label: 'Reopened',         bg: 'bg-orange-100', text: 'text-orange-800' },
};

const PRIORITY_CFG: Record<string, { color: string; dot: string }> = {
  'Low':      { color: 'text-slate-500',  dot: 'bg-slate-400' },
  'Medium':   { color: 'text-blue-600',   dot: 'bg-blue-500' },
  'High':     { color: 'text-orange-600', dot: 'bg-orange-500' },
  'Critical': { color: 'text-red-600',    dot: 'bg-red-500' },
};

const PIE_COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#06b6d4','#f97316'];
const PRIORITY_COLORS: Record<string, string> = {
  'Low': '#94a3b8', 'Medium': '#3b82f6', 'High': '#f97316', 'Critical': '#ef4444'
};

// ─── Shared sub-components ────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CFG[status] ?? { label: status, bg: 'bg-gray-100', text: 'text-gray-700' };
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold', c.bg, c.text)}>
      {c.label}
    </span>
  );
}

function PriorityDot({ priority }: { priority: string }) {
  const c = PRIORITY_CFG[priority];
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('w-2 h-2 rounded-full inline-block', c?.dot ?? 'bg-gray-400')} />
      <span className={cn('text-xs font-semibold', c?.color ?? 'text-gray-600')}>{priority}</span>
    </span>
  );
}

function SlaIndicator({ dueDate, status }: { dueDate: string | null; status: string }) {
  if (!dueDate || ['Resolved', 'Closed', 'Cancelled'].includes(status)) return null;
  const diffH = (new Date(dueDate).getTime() - Date.now()) / 3_600_000;
  if (diffH < 0) return (
    <span className="flex items-center gap-0.5 text-[10px] font-bold text-red-600">
      <AlertTriangle className="h-3 w-3" /> Overdue {Math.abs(Math.ceil(diffH))}h
    </span>
  );
  if (diffH < 4) return (
    <span className="flex items-center gap-0.5 text-[10px] font-bold text-orange-500">
      <Timer className="h-3 w-3" /> {Math.ceil(diffH)}h left
    </span>
  );
  return (
    <span className="flex items-center gap-0.5 text-[10px] font-semibold text-green-600">
      <CheckCircle className="h-3 w-3" /> {new Date(dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
    </span>
  );
}

function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, title, description, action }: {
  icon: React.ComponentType<any>; title: string; description: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">{description}</p>
      </div>
      {action}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span className="flex-1">{message || 'Failed to load data.'}</span>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} className="border-red-300 text-red-700 hover:bg-red-100">
          <RefreshCw className="h-3 w-3 mr-1" />Retry
        </Button>
      )}
    </div>
  );
}

// ─── Workload summary card ─────────────────────────────────────────────────────
function WorkloadCard({ title, value, icon, colorClass, bgClass, filterLink, loading }: {
  title: string; value: number; icon: React.ReactNode;
  colorClass: string; bgClass: string; filterLink?: string; loading?: boolean;
}) {
  const navigate = useNavigate();
  return (
    <div
      className={cn(
        'relative bg-card rounded-xl border shadow-sm p-4 flex flex-col gap-2 transition-all overflow-hidden',
        filterLink ? 'cursor-pointer hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5' : ''
      )}
      onClick={() => filterLink && navigate(filterLink)}
    >
      <div className={cn('absolute top-0 right-0 w-20 h-20 rounded-bl-full opacity-20', bgClass)} />
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-muted-foreground leading-tight">{title}</p>
        <div className={cn('p-1.5 rounded-lg', bgClass)}>
          <span className={colorClass}>{icon}</span>
        </div>
      </div>
      {loading ? <Skeleton className="h-9 w-14" /> : (
        <p className={cn('text-3xl font-bold tracking-tight', colorClass)}>{value}</p>
      )}
    </div>
  );
}

// ─── Ticket row (compact) ──────────────────────────────────────────────────────
function TicketRow({ ticket, showEmployee = true, showSla = true, showAccept = false, onAccept }: {
  ticket: any; showEmployee?: boolean; showSla?: boolean; showAccept?: boolean; onAccept?: () => void;
}) {
  const latestRejected = Array.isArray(ticket.confirmations)
    ? [...ticket.confirmations].reverse().find((c: any) => c.status === 'Rejected' && c.rejection_reason)
    : null;
  const employeeName = (Array.isArray(ticket.creator) ? ticket.creator[0]?.full_name : ticket.creator?.full_name);

  return (
    <div className="flex items-start gap-3 py-3 px-2 -mx-2 hover:bg-muted/40 rounded-md transition-colors group">
      <span className={cn('w-2 h-2 rounded-full mt-2 shrink-0', PRIORITY_CFG[ticket.priority]?.dot ?? 'bg-gray-400')} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="text-xs font-mono text-muted-foreground">{ticket.ticket_number}</span>
          <PriorityDot priority={ticket.priority} />
        </div>
        <Link to={`/tickets/${ticket.id}`} className="text-sm font-medium line-clamp-1 hover:text-primary transition-colors block">
          {ticket.subject}
        </Link>
        {showEmployee && employeeName && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {employeeName}
            {ticket.departments?.name && <span> · {ticket.departments.name}</span>}
          </p>
        )}
        {ticket.status === 'Reopened' && latestRejected?.rejection_reason && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1 mt-1.5 font-medium line-clamp-2">
            Rejected by employee: "{latestRejected.rejection_reason.trim()}"
          </p>
        )}
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1">
        <StatusBadge status={ticket.status} />
        {showSla && <SlaIndicator dueDate={ticket.due_date} status={ticket.status} />}
        {showAccept && ticket.status === 'Assigned' && onAccept && (
          <Button size="sm" className="h-6 text-[10px] px-2 mt-1" onClick={e => { e.preventDefault(); onAccept(); }}>
            Accept
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Active Ticket Table ──────────────────────────────────────────────────────
function ActiveTicketTable() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<{ status?: string; priority?: string; search?: string }>({});
  const [page, setPage] = useState(0);
  const { data, isLoading, error, refetch } = useTechnicianActiveTickets(filters, page);

  const QUICK_FILTERS = [
    { label: 'All Active', value: undefined },
    { label: 'Critical', value: 'Critical' },
    { label: 'Assigned', status: 'Assigned' },
    { label: 'In Progress', status: 'In Progress' },
    { label: 'Waiting', status: 'Waiting for User' },
    { label: 'Overdue', value: 'overdue' },
  ];

  const tickets = data?.data ?? [];
  const total = data?.count ?? 0;
  const totalPages = Math.ceil(total / 15);

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" />
            My Active Ticket Queue
            {!isLoading && <span className="text-xs font-normal text-muted-foreground">({total} tickets)</span>}
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search tickets..."
                className="h-8 pl-8 text-xs w-48"
                value={filters.search ?? ''}
                onChange={e => { setFilters(f => ({ ...f, search: e.target.value || undefined })); setPage(0); }}
              />
            </div>
            <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
              <Link to="/tickets">View All</Link>
            </Button>
          </div>
        </div>
        {/* Quick filters */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {['All', 'Reopened', 'Critical', 'Assigned', 'In Progress', 'Waiting for User', 'Overdue'].map(f => (
            <Button
              key={f}
              size="sm"
              variant={
                (f === 'All' && !filters.status && !filters.priority)
                  ? 'default'
                  : (filters.status === f || filters.priority === f)
                  ? 'default' : 'outline'
              }
              className="h-6 text-[11px] px-2"
              onClick={() => {
                setPage(0);
                if (f === 'All') setFilters({});
                else if (['Low', 'Medium', 'High', 'Critical'].includes(f)) setFilters({ priority: f });
                else if (f === 'Overdue') setFilters({ status: undefined }); // handled by server
                else setFilters({ status: f });
              }}
            >
              {f}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
        ) : isLoading ? (
          <SectionSkeleton rows={8} />
        ) : tickets.length === 0 ? (
          <EmptyState icon={Inbox} title="No active tickets" description="Your active work queue is empty." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[11px] uppercase bg-muted/60 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5">Ticket</th>
                    <th className="px-3 py-2.5">Subject</th>
                    <th className="px-3 py-2.5">Employee</th>
                    <th className="px-3 py-2.5">Priority</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">SLA Due</th>
                    <th className="px-3 py-2.5">Category</th>
                    <th className="px-3 py-2.5">Updated</th>
                    <th className="px-3 py-2.5">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map(ticket => (
                    <tr key={ticket.id} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                      <td className="px-3 py-2.5">
                        <Link to={`/tickets/${ticket.id}`} className="text-primary hover:underline font-mono text-xs">
                          {ticket.ticket_number}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 max-w-52">
                        <p className="line-clamp-1 text-xs font-medium">{ticket.subject}</p>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {((ticket.creator as any)?.full_name ?? (ticket.creator as any)?.[0]?.full_name) ?? '—'}
                      </td>
                      <td className="px-3 py-2.5"><PriorityDot priority={ticket.priority} /></td>
                      <td className="px-3 py-2.5"><StatusBadge status={ticket.status} /></td>
                      <td className="px-3 py-2.5"><SlaIndicator dueDate={ticket.due_date} status={ticket.status} /></td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{((ticket.ticket_categories as any)?.name ?? (ticket.ticket_categories as any)?.[0]?.name) ?? '—'}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(ticket.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </td>
                      <td className="px-3 py-2.5">
                        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" asChild>
                          <Link to={`/tickets/${ticket.id}`}>Open</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  Showing {page * 15 + 1}–{Math.min((page + 1) * 15, total)} of {total}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setPage(p => p - 1)} disabled={page === 0}>
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Technician Dashboard ────────────────────────────────────────────────
export function TechnicianDashboard() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [kbSearch, setKbSearch] = useState('');
  const [resolutionDialogOpen, setResolutionDialogOpen] = useState(false);
  const [attendanceMessage, setAttendanceMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Realtime subscriptions
  useTechnicianTicketsRealtime();

  // Attendance status for current technician
  const { data: attendanceData } = useQuery({
    queryKey: ['my-attendance-status', profile?.id],
    queryFn: async () => {
      const res = await api.get('/workforce/attendance/my-status');
      return res.data?.data;
    },
    enabled: !!profile?.id,
    refetchInterval: 30000,
  });

  const isCheckedIn = attendanceData?.status === 'Present' || attendanceData?.status === 'Late';
  const isCheckedOut = attendanceData?.status === 'Checked Out';
  const checkInTimeStr = attendanceData?.check_in_time ? new Date(attendanceData.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
  const checkOutTimeStr = attendanceData?.check_out_time ? new Date(attendanceData.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
  const shiftInfo = attendanceData?.shift ? `${attendanceData.shift.name} (${attendanceData.shift.start_time?.slice(0, 5)} - ${attendanceData.shift.end_time?.slice(0, 5)})` : 'Shift: 09:00 - 18:00';

  const checkInMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/workforce/attendance/check-in', { technician_id: profile?.id });
      return res.data;
    },
    onSuccess: (res) => {
      setAttendanceMessage({ type: 'success', text: res?.message || 'Checked In Successfully! You are now available for automatic assignments.' });
      queryClient.invalidateQueries({ queryKey: ['my-attendance-status'] });
      queryClient.invalidateQueries({ queryKey: ['workforce-attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['workforce-summary'] });
      queryClient.invalidateQueries({ queryKey: ['tech-dashboard-data'] });
      queryClient.invalidateQueries({ queryKey: ['tech-active-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['tech-todays-work'] });
      queryClient.invalidateQueries({ queryKey: ['tech-recent-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['unit_queue'] });
      queryClient.invalidateQueries({ queryKey: ['my_assigned_tickets'] });
      setTimeout(() => setAttendanceMessage(null), 6000);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to check in';
      setAttendanceMessage({ type: 'error', text: msg });
    }
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/workforce/attendance/check-out', { technician_id: profile?.id });
      return res.data;
    },
    onSuccess: (res) => {
      setAttendanceMessage({ type: 'success', text: res?.message || 'Checked Out Successfully! Automatic assignments paused.' });
      queryClient.invalidateQueries({ queryKey: ['my-attendance-status'] });
      queryClient.invalidateQueries({ queryKey: ['workforce-attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['workforce-summary'] });
      queryClient.invalidateQueries({ queryKey: ['tech-dashboard-data'] });
      setTimeout(() => setAttendanceMessage(null), 6000);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to check out';
      setAttendanceMessage({ type: 'error', text: msg });
    }
  });

  // Data
  const { data: dashData, isLoading: dashLoading, error: dashError, refetch: refetchDash } = useTechnicianDashboardData();
  const { data: todaysWork, isLoading: twLoading, error: twError, refetch: refetchTw } = useTodaysWork();
  const { data: slaRisk, isLoading: slaLoading, error: slaError, refetch: refetchSla } = useSlaRiskTickets();
  const { data: criticalTickets, isLoading: critLoading, error: critError, refetch: refetchCrit } = useCriticalTickets();
  const { data: recentAssignments, isLoading: raLoading, error: raError, refetch: refetchRa } = useRecentAssignments();
  const { data: waitingTickets, isLoading: wLoading, error: wError, refetch: refetchW } = useWaitingForUserTickets();
  const { data: resolvedTickets, isLoading: rLoading, error: rError, refetch: refetchR } = useRecentlyResolvedTickets();
  const { data: notifications, isLoading: notifLoading } = useTechnicianNotifications();
  const { data: supportAssets, isLoading: assetsLoading } = useTechnicianSupportAssets();
  const { data: kbArticles } = useTechnicianKbArticles(kbSearch);
  const { data: statusOverview } = useTechnicianStatusOverview();
  const { data: priorityOverview } = useTechnicianPriorityOverview();

  const { data: awaitingConfirmations, isLoading: acLoading, error: acError, refetch: refetchAc } = useAwaitingConfirmationTickets();
  const { data: reopenedTickets } = useReopenedTickets();

  const [dismissedReopenedKeys, setDismissedReopenedKeys] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('tickety:dismissed-reopened-tickets');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const getReopenedKey = (ticket: any) => `${ticket.id}:${ticket.reopened_at || ticket.reopen_count || ''}`;

  const dismissReopenedTicket = (ticket: any) => {
    const key = getReopenedKey(ticket);
    setDismissedReopenedKeys((prev) => {
      const next = Array.from(new Set([...prev, key]));
      try {
        localStorage.setItem('tickety:dismissed-reopened-tickets', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const dismissAllReopenedTickets = (tickets: any[]) => {
    const keys = tickets.map(getReopenedKey);
    setDismissedReopenedKeys((prev) => {
      const next = Array.from(new Set([...prev, ...keys]));
      try {
        localStorage.setItem('tickety:dismissed-reopened-tickets', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const visibleReopenedTickets = (reopenedTickets ?? []).filter(
    (ticket: any) => !dismissedReopenedKeys.includes(getReopenedKey(ticket))
  );

  // Mutations
  const markRead = useMarkNotificationRead();

  const summary = dashData?.summary;
  const performance = dashData?.performance;
  const trend = dashData?.trend ?? [];

  const unreadNotifCount = (notifications ?? []).filter(n => !n.is_read).length;

  const handleNotifClick = (notif: any) => {
    if (!notif.is_read) markRead.mutate(notif.id);
    if (notif.link) navigate(notif.link);
  };

  return (
    <div className="space-y-8">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-violet-100 text-violet-800">
              <Wrench className="h-3 w-3 mr-1" /> Technician
            </span>
            {performance?.avgRating !== null && performance?.avgRating !== undefined && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                {performance.avgRating} / 5
                <span className="text-[10px] font-normal text-amber-700">
                  ({performance.totalRatings} {performance.totalRatings === 1 ? 'rating' : 'ratings'})
                </span>
              </span>
            )}
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back, {profile?.full_name || 'Technician'} 👋
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
            {profile?.employee_id && (
              <span className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground">{profile.employee_id}</span>
              </span>
            )}
            {profile?.departments?.name && (
              <span className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />{profile.departments.name}
              </span>
            )}
            {profile?.units?.name && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />{profile.units.name}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" asChild>
            <Link to="/tickets?assigned_to=me">
              <ListChecks className="h-4 w-4 mr-1.5" />My Tickets
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Attendance Control ─────────────────────────────────────────── */}
      <div className="bg-card rounded-xl border p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm border-indigo-200 bg-indigo-50/30">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
            <Clock className="h-5 w-5 text-indigo-600" /> Current Shift & Attendance
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Status:</span> 
            <Badge 
              variant="outline"
              className={cn(
                "font-semibold px-2 py-0.5 rounded border shadow-sm",
                isCheckedIn && "bg-emerald-100 text-emerald-800 border-emerald-300",
                isCheckedOut && "bg-slate-100 text-slate-700 border-slate-300",
                !isCheckedIn && !isCheckedOut && "bg-white text-foreground border-gray-200"
              )}
            >
              {attendanceData?.status || 'Not Checked In'}
            </Badge>

            {checkInTimeStr && (
              <span className="text-xs text-emerald-700 font-medium">
                · In at {checkInTimeStr}
              </span>
            )}
            {checkOutTimeStr && (
              <span className="text-xs text-slate-600 font-medium">
                · Out at {checkOutTimeStr}
              </span>
            )}

            <span className="ml-2 text-xs text-gray-500 border-l pl-2 border-gray-300">
              {shiftInfo}
            </span>
          </div>

          {attendanceMessage && (
            <div className={cn(
              "mt-2 text-xs font-medium px-3 py-1.5 rounded-lg border flex items-center gap-2 animate-in fade-in",
              attendanceMessage.type === 'success' 
                ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                : "bg-destructive/10 border-destructive/20 text-destructive"
            )}>
              {attendanceMessage.type === 'success' ? <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
              <span>{attendanceMessage.text}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button 
            disabled={isCheckedIn || isCheckedOut || checkInMutation.isPending}
            onClick={() => checkInMutation.mutate()} 
            className={cn(
              "font-bold px-6 py-6 h-auto text-lg rounded-xl shadow-md transition-all active:scale-95",
              isCheckedIn 
                ? "bg-emerald-600 hover:bg-emerald-600 text-white opacity-95 cursor-default" 
                : "bg-indigo-600 hover:bg-indigo-700 text-white"
            )}
          >
            {checkInMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Checking In...
              </>
            ) : isCheckedIn ? (
              <>
                <CheckCircle className="mr-2 h-6 w-6 text-emerald-200" /> Checked In
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-6 w-6" /> Check In Now
              </>
            )}
          </Button>
          <Button 
            variant="outline" 
            disabled={!isCheckedIn || checkOutMutation.isPending}
            onClick={() => checkOutMutation.mutate()} 
            className="px-6 py-6 h-auto text-lg rounded-xl transition-all active:scale-95"
          >
            {checkOutMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Checking Out...
              </>
            ) : (
              'Check Out'
            )}
          </Button>
        </div>
      </div>

      {/* ── Reopened / Rejected by Employee Alert Banner ───────────────── */}
      {visibleReopenedTickets.length > 0 && (
        <Card className="border-red-300 shadow-md relative">
          <CardHeader className="bg-gradient-to-r from-red-50 to-orange-50 rounded-t-lg border-b border-red-200 pb-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-red-900 flex items-center gap-2 text-lg">
                  <AlertCircle className="h-5 w-5 text-red-600" /> Reopened Tickets — Rejected by Employee
                </CardTitle>
                <p className="text-sm text-red-700 mt-1">
                  The employee reported that the following ticket(s) are not resolved. Please review the rejection reason and resume work.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className="bg-white text-red-700 border-red-300 font-bold">
                  {visibleReopenedTickets.length} Action Needed
                </Badge>
                <button
                  type="button"
                  onClick={() => dismissAllReopenedTickets(visibleReopenedTickets)}
                  title="Remove alert banner"
                  aria-label="Remove alert banner"
                  className="p-1 rounded-md text-red-700 hover:text-red-950 hover:bg-red-200/60 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y border-t border-red-100">
              {visibleReopenedTickets.map((ticket: any) => {
                const latestRejected = Array.isArray(ticket.confirmations)
                  ? [...ticket.confirmations].reverse().find((c: any) => c.status === 'Rejected' && c.rejection_reason)
                  : null;
                const empName = (Array.isArray(ticket.creator) ? ticket.creator[0]?.full_name : ticket.creator?.full_name) || 'Employee';
                return (
                  <div key={ticket.id} className="p-4 hover:bg-red-50/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link to={`/tickets/${ticket.id}`} className="font-semibold text-base hover:underline text-red-900">
                          {ticket.ticket_number}: {ticket.subject}
                        </Link>
                        <PriorityDot priority={ticket.priority} />
                        <StatusBadge status={ticket.status} />
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5" /> Rejected by <strong className="text-foreground">{empName}</strong>
                        </span>
                        {ticket.reopened_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" /> Reopened {new Date(ticket.reopened_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                      {latestRejected?.rejection_reason && (
                        <div className="text-xs bg-red-50 border border-red-200 text-red-800 rounded-md px-3 py-2 mt-1">
                          <span className="font-semibold">Employee Reason:</span> "{latestRejected.rejection_reason.trim()}"
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button onClick={() => navigate(`/tickets/${ticket.id}`)} className="bg-red-600 hover:bg-red-700 text-white whitespace-nowrap shrink-0">
                        View & Resume Work
                      </Button>
                      <button
                        type="button"
                        onClick={() => dismissReopenedTicket(ticket)}
                        title="Remove from alert"
                        aria-label="Remove from alert"
                        className="p-1.5 rounded-md text-slate-400 hover:text-red-700 hover:bg-red-100 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Workload Summary Cards ──────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">My Workload Summary</h2>
        {dashError ? (
          <ErrorState message={(dashError as Error).message} onRetry={() => refetchDash()} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-3">
            <WorkloadCard title="Total Assigned" value={summary?.totalAssigned ?? 0} icon={<Ticket className="h-4 w-4" />} colorClass="text-primary" bgClass="bg-primary/10" filterLink="/tickets?assigned_to=me" loading={dashLoading} />
            <WorkloadCard title="Assigned (New)" value={summary?.unaccepted ?? 0} icon={<Inbox className="h-4 w-4" />} colorClass="text-indigo-600" bgClass="bg-indigo-100" filterLink="/tickets?status=Assigned&assigned_to=me" loading={dashLoading} />
            <WorkloadCard title="In Progress" value={summary?.inProgress ?? 0} icon={<Activity className="h-4 w-4" />} colorClass="text-purple-600" bgClass="bg-purple-100" filterLink="/tickets?status=In+Progress&assigned_to=me" loading={dashLoading} />
            <WorkloadCard title="Reopened" value={summary?.reopened ?? (reopenedTickets ?? []).length} icon={<RefreshCw className="h-4 w-4" />} colorClass="text-red-600" bgClass="bg-red-100" filterLink="/tickets?status=Reopened&assigned_to=me" loading={dashLoading} />
            <WorkloadCard title="Waiting" value={summary?.waitingForUser ?? 0} icon={<AlertTriangle className="h-4 w-4" />} colorClass="text-yellow-700" bgClass="bg-yellow-100" filterLink="/tickets?status=Waiting+for+User&assigned_to=me" loading={dashLoading} />
            <WorkloadCard title="Resolved Today" value={summary?.resolvedToday ?? 0} icon={<CheckCircle className="h-4 w-4" />} colorClass="text-green-600" bgClass="bg-green-100" loading={dashLoading} />
            <WorkloadCard title="Closed Today" value={summary?.closedToday ?? 0} icon={<CheckCheck className="h-4 w-4" />} colorClass="text-emerald-600" bgClass="bg-emerald-100" loading={dashLoading} />
            <WorkloadCard title="Overdue" value={summary?.overdue ?? 0} icon={<ClockAlert className="h-4 w-4" />} colorClass="text-red-600" bgClass="bg-red-100" loading={dashLoading} />
            <WorkloadCard title="Critical" value={summary?.critical ?? 0} icon={<Zap className="h-4 w-4" />} colorClass="text-orange-600" bgClass="bg-orange-100" loading={dashLoading} />
          </div>
        )}
      </div>

      {/* ── Quick Actions ───────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/tickets?assigned_to=me"><Eye className="mr-2 h-4 w-4" />My Tickets</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/tickets?status=Reopened&assigned_to=me">
              <RefreshCw className="mr-2 h-4 w-4 text-red-600" />Reopened
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/tickets?priority=Critical&assigned_to=me">
              <Zap className="mr-2 h-4 w-4 text-red-500" />Critical
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/tickets?overdue=true&assigned_to=me">
              <ClockAlert className="mr-2 h-4 w-4 text-orange-500" />Overdue
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/tickets?status=Waiting+for+User&assigned_to=me">
              <Timer className="mr-2 h-4 w-4 text-yellow-600" />Waiting for User
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/assets"><Package className="mr-2 h-4 w-4 text-teal-600" />Assets</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/help-center"><BookOpen className="mr-2 h-4 w-4 text-blue-600" />Knowledge Base</Link>
          </Button>
        </div>
      </div>

      {/* ── Today's Work + SLA Risk ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Today's Work */}
        <div className="xl:col-span-3">
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-purple-600" /> Today's Work
              </CardTitle>
              <Button variant="ghost" size="sm" asChild className="text-xs text-muted-foreground">
                <Link to="/tickets?assigned_to=me">View All <ChevronRight className="h-3 w-3 ml-1 inline" /></Link>
              </Button>
            </CardHeader>
            <CardContent>
              {twError ? (
                <ErrorState message={(twError as Error).message} onRetry={() => refetchTw()} />
              ) : twLoading ? (
                <SectionSkeleton rows={5} />
              ) : (todaysWork ?? []).length === 0 ? (
                <EmptyState icon={CheckSquare} title="All clear!" description="No tickets due today or critical tickets." />
              ) : (
                <div className="divide-y space-y-0">
                  {(todaysWork ?? []).map(ticket => (
                    <TicketRow key={ticket.id} ticket={ticket} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* SLA Risk */}
        <div className="xl:col-span-2">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Timer className="h-4 w-4 text-orange-500" /> SLA Risk
              </CardTitle>
            </CardHeader>
            <CardContent>
              {slaError ? (
                <ErrorState message={(slaError as Error).message} onRetry={() => refetchSla()} />
              ) : slaLoading ? (
                <SectionSkeleton rows={4} />
              ) : (
                <div className="space-y-4">
                  {/* Breached */}
                  {((slaRisk?.breached ?? []).length > 0) && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        <p className="text-xs font-bold text-red-600 uppercase tracking-wide">
                          SLA Breached ({slaRisk!.breached.length})
                        </p>
                      </div>
                      <div className="space-y-2">
                        {slaRisk!.breached.slice(0, 3).map(t => (
                          <Link key={t.id} to={`/tickets/${t.id}`}
                            className="flex items-center justify-between p-2.5 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                          >
                            <div>
                              <p className="text-xs font-medium text-red-800 line-clamp-1">{t.subject}</p>
                              <p className="text-[10px] text-red-600">{t.ticket_number}</p>
                            </div>
                            <SlaIndicator dueDate={t.due_date} status={t.status} />
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Approaching */}
                  {((slaRisk?.approaching ?? []).length > 0) && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full bg-orange-500" />
                        <p className="text-xs font-bold text-orange-600 uppercase tracking-wide">
                          Approaching ({slaRisk!.approaching.length})
                        </p>
                      </div>
                      <div className="space-y-2">
                        {slaRisk!.approaching.slice(0, 3).map(t => (
                          <Link key={t.id} to={`/tickets/${t.id}`}
                            className="flex items-center justify-between p-2.5 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors"
                          >
                            <div>
                              <p className="text-xs font-medium text-orange-800 line-clamp-1">{t.subject}</p>
                              <p className="text-[10px] text-orange-600">{t.ticket_number}</p>
                            </div>
                            <SlaIndicator dueDate={t.due_date} status={t.status} />
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* On Track */}
                  {((slaRisk?.onTrack ?? []).length > 0) && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        <p className="text-xs font-bold text-green-600 uppercase tracking-wide">
                          On Track ({slaRisk!.onTrack.length})
                        </p>
                      </div>
                      <div className="space-y-1">
                        {slaRisk!.onTrack.slice(0, 3).map(t => (
                          <Link key={t.id} to={`/tickets/${t.id}`}
                            className="flex items-center justify-between p-2 bg-green-50/50 rounded-lg hover:bg-green-50 transition-colors"
                          >
                            <p className="text-xs text-green-800 line-clamp-1">{t.ticket_number} — {t.subject}</p>
                            <SlaIndicator dueDate={t.due_date} status={t.status} />
                          </Link>
                        ))}
                        {slaRisk!.onTrack.length > 3 && (
                          <p className="text-xs text-muted-foreground pl-2">+{slaRisk!.onTrack.length - 3} more on track</p>
                        )}
                      </div>
                    </div>
                  )}
                  {(slaRisk?.breached ?? []).length === 0 && (slaRisk?.approaching ?? []).length === 0 && (slaRisk?.onTrack ?? []).length === 0 && (
                    <EmptyState icon={CheckCircle} title="No active SLA tracking" description="You have no active tickets with SLA deadlines." />
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Critical Tickets + Recent Assignments ───────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Critical Tickets */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-red-600" /> Critical Tickets
              {!critLoading && (criticalTickets ?? []).length > 0 && (
                <Badge className="bg-red-100 text-red-800 hover:bg-red-100 text-[10px] font-bold">
                  {(criticalTickets ?? []).length}
                </Badge>
              )}
            </CardTitle>
            <Button variant="ghost" size="sm" asChild className="text-xs text-muted-foreground">
              <Link to="/tickets?priority=Critical&assigned_to=me">View All <ChevronRight className="h-3 w-3 ml-1 inline" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {critError ? (
              <ErrorState message={(critError as Error).message} onRetry={() => refetchCrit()} />
            ) : critLoading ? (
              <SectionSkeleton rows={3} />
            ) : (criticalTickets ?? []).length === 0 ? (
              <EmptyState icon={Star} title="No critical tickets!" description="You have no active critical priority tickets." />
            ) : (
              <div className="divide-y">
                {(criticalTickets ?? []).map(ticket => (
                  <TicketRow key={ticket.id} ticket={ticket} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Assignments */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-indigo-600" /> Recent Assignments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {raError ? (
              <ErrorState message={(raError as Error).message} onRetry={() => refetchRa()} />
            ) : raLoading ? (
              <SectionSkeleton rows={4} />
            ) : (recentAssignments ?? []).length === 0 ? (
              <EmptyState icon={Inbox} title="No recent assignments" description="No tickets were assigned to you in the past 3 days." />
            ) : (
              <div className="divide-y">
                {(recentAssignments ?? []).map(ticket => (
                  <TicketRow
                    key={ticket.id}
                    ticket={ticket}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Active Ticket Queue (full table) ──────────────────────────────── */}
      <ActiveTicketTable />

      {/* ── Waiting for User ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600" /> Waiting for User
            {!wLoading && (waitingTickets ?? []).length > 0 && (
              <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 text-[10px] font-bold">
                {(waitingTickets ?? []).length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {wError ? (
            <ErrorState message={(wError as Error).message} onRetry={() => refetchW()} />
          ) : wLoading ? (
            <SectionSkeleton rows={3} />
          ) : (waitingTickets ?? []).length === 0 ? (
            <EmptyState icon={CheckSquare} title="No tickets waiting" description="No tickets are currently waiting for user response." />
          ) : (
            <div className="space-y-2">
              {(waitingTickets ?? []).map(ticket => {
                const waitingSince = ticket.updated_at
                  ? Math.ceil((Date.now() - new Date(ticket.updated_at).getTime()) / 3_600_000)
                  : null;
                return (
                  <div key={ticket.id} className="flex items-start gap-3 p-3 border rounded-lg hover:border-primary/40 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-mono text-muted-foreground">{ticket.ticket_number}</span>
                        <PriorityDot priority={ticket.priority} />
                      </div>
                      <p className="text-sm font-medium line-clamp-1">{ticket.subject}</p>
                      {((ticket.creator as any)?.full_name ?? (ticket.creator as any)?.[0]?.full_name) && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {(ticket.creator as any)?.full_name ?? (ticket.creator as any)?.[0]?.full_name}
                          {waitingSince && <span className="ml-2 text-yellow-700 font-medium">waiting {waitingSince}h</span>}
                        </p>
                      )}
                    </div>
                    <Button size="sm" variant="outline" className="text-xs shrink-0" asChild>
                      <Link to={`/tickets/${ticket.id}`}>View Ticket</Link>
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Awaiting Confirmation ─────────────────────────────────────────── */}
      <Card className="border-orange-200">
        <CardHeader className="flex flex-row items-center justify-between pb-3 bg-orange-50/50">
          <CardTitle className="text-base font-semibold flex items-center gap-2 text-orange-900">
            <CheckCircle className="h-4 w-4 text-orange-600" /> Awaiting Employee Confirmation
            {!acLoading && (awaitingConfirmations ?? []).length > 0 && (
              <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 text-[10px] font-bold">
                {(awaitingConfirmations ?? []).length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {acError ? (
            <ErrorState message={(acError as Error).message} onRetry={() => refetchAc()} />
          ) : acLoading ? (
            <SectionSkeleton rows={2} />
          ) : (awaitingConfirmations ?? []).length === 0 ? (
            <EmptyState icon={CheckCheck} title="All confirmed" description="No tickets are awaiting confirmation from employees." />
          ) : (
            <div className="space-y-2 mt-4">
              {(awaitingConfirmations ?? []).map(ticket => {
                const waitingSince = (ticket as any).technician_completed_at
                  ? Math.ceil((Date.now() - new Date((ticket as any).technician_completed_at).getTime()) / 3_600_000)
                  : null;
                return (
                  <div key={ticket.id} className="flex items-start gap-3 p-3 border rounded-lg border-orange-100 bg-orange-50/30 hover:bg-orange-50/70 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-mono text-muted-foreground">{ticket.ticket_number}</span>
                        <PriorityDot priority={ticket.priority} />
                      </div>
                      <p className="text-sm font-medium line-clamp-1">{ticket.subject}</p>
                      {((ticket.creator as any)?.full_name ?? (ticket.creator as any)?.[0]?.full_name) && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {(ticket.creator as any)?.full_name ?? (ticket.creator as any)?.[0]?.full_name}
                          {waitingSince && <span className="ml-2 text-orange-700 font-medium">waiting {waitingSince}h</span>}
                        </p>
                      )}
                    </div>
                    <Button size="sm" variant="outline" className="text-xs shrink-0 bg-white border-orange-200 text-orange-700 hover:bg-orange-50 hover:text-orange-800" asChild>
                      <Link to={`/tickets/${ticket.id}`}>View Ticket</Link>
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>


      {/* ── Recently Resolved ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CheckCheck className="h-4 w-4 text-green-600" /> Recently Resolved
          </CardTitle>
          <Button variant="ghost" size="sm" asChild className="text-xs text-muted-foreground">
            <Link to="/tickets?status=Resolved&assigned_to=me">View All <ChevronRight className="h-3 w-3 ml-1 inline" /></Link>
          </Button>
        </CardHeader>
        <CardContent>
          {rError ? (
            <ErrorState message={(rError as Error).message} onRetry={() => refetchR()} />
          ) : rLoading ? (
            <SectionSkeleton rows={3} />
          ) : (resolvedTickets ?? []).length === 0 ? (
            <EmptyState icon={CheckCircle} title="No recently resolved tickets" description="Tickets you resolve will appear here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[11px] uppercase bg-muted/60 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Ticket</th>
                    <th className="px-3 py-2">Subject</th>
                    <th className="px-3 py-2">Employee</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Rating</th>
                    <th className="px-3 py-2">Resolved At</th>
                  </tr>
                </thead>
                <tbody>
                  {(resolvedTickets ?? []).map(ticket => {
                    const ticketRatings = Array.isArray((ticket as any).ratings) ? (ticket as any).ratings : [];
                    const latestRating = ticketRatings.length > 0 ? ticketRatings[ticketRatings.length - 1] : null;
                    return (
                    <tr key={ticket.id} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                      <td className="px-3 py-2">
                        <Link to={`/tickets/${ticket.id}`} className="text-primary hover:underline font-mono text-xs">
                          {ticket.ticket_number}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-xs line-clamp-1 max-w-48">{ticket.subject}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{((ticket.creator as any)?.full_name ?? (ticket.creator as any)?.[0]?.full_name) ?? '—'}</td>
                      <td className="px-3 py-2"><StatusBadge status={ticket.status} /></td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {latestRating?.rating ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700" title={latestRating.feedback_comment || undefined}>
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                            {latestRating.rating}/5
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {ticket.resolution_date
                          ? new Date(ticket.resolution_date).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </td>
                    </tr>
                  );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Performance + Workload Trend ──────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Performance */}
        <div className="xl:col-span-2">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-violet-600" /> My Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashLoading ? (
                <SectionSkeleton rows={6} />
              ) : performance ? (
                <div className="space-y-4">
                  {[
                    { label: 'Total Assigned', value: performance.totalAssigned, suffix: 'tickets', color: 'text-primary' },
                    { label: 'Total Resolved', value: performance.totalResolved, suffix: 'tickets', color: 'text-green-600' },
                    { label: 'Employee Star Rating', value: performance.avgRating !== null && performance.avgRating !== undefined ? `★ ${performance.avgRating}/5` : '—', suffix: performance.totalRatings ? `(${performance.totalRatings} ratings)` : 'no ratings', color: 'text-amber-600' },
                    { label: 'Avg Resolution Time', value: performance.avgResolutionHours, suffix: 'hours', color: 'text-blue-600' },
                    { label: 'SLA Compliance', value: performance.slaCompliance, suffix: '%', color: performance.slaCompliance >= 90 ? 'text-green-600' : performance.slaCompliance >= 70 ? 'text-orange-500' : 'text-red-600' },
                    { label: 'Currently Active', value: performance.pendingActive, suffix: 'tickets', color: 'text-purple-600' },
                    { label: 'Reopened', value: performance.reopened, suffix: 'tickets', color: performance.reopened > 0 ? 'text-orange-600' : 'text-green-600' },
                  ].map(({ label, value, suffix, color }) => (
                    <div
                      key={label}
                      className={cn(
                        'flex items-center justify-between py-2 border-b last:border-0',
                        label === 'Avg Resolution Time' && 'cursor-pointer hover:bg-muted/60 rounded px-1.5 -mx-1.5 transition-colors group'
                      )}
                      onClick={label === 'Avg Resolution Time' ? () => setResolutionDialogOpen(true) : undefined}
                      title={label === 'Avg Resolution Time' ? 'Click to inspect individual tickets and resolution times' : undefined}
                    >
                      <span className={cn('text-sm text-muted-foreground', label === 'Avg Resolution Time' && 'group-hover:text-primary font-medium flex items-center gap-1')}>
                        {label} {label === 'Avg Resolution Time' && <Timer className="h-3 w-3 inline opacity-60 group-hover:opacity-100" />}
                      </span>
                      <span className={cn('text-sm font-bold', color)}>{value} <span className="text-xs font-normal text-muted-foreground">{suffix}</span></span>
                    </div>
                  ))}
                  {/* SLA bar */}
                  <div className="pt-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">SLA Compliance</span>
                      <span className="font-semibold">{performance.slaCompliance}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', performance.slaCompliance >= 90 ? 'bg-green-500' : performance.slaCompliance >= 70 ? 'bg-orange-500' : 'bg-red-500')}
                        style={{ width: `${performance.slaCompliance}%` }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState icon={TrendingUp} title="No performance data" description="Performance metrics will appear once you have assigned tickets." />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Workload Trend */}
        <div className="xl:col-span-3">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-600" /> Workload Trend (30 days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashLoading ? (
                <div className="h-48 flex items-center justify-center"><Skeleton className="h-full w-full" /></div>
              ) : trend.length === 0 || trend.every(t => t.assigned === 0) ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                  No workload data for the last 30 days
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="assigned" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="resolved" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Area type="monotone" dataKey="assigned" name="Assigned" stroke="#6366f1" fill="url(#assigned)" strokeWidth={2} />
                    <Area type="monotone" dataKey="resolved" name="Resolved" stroke="#22c55e" fill="url(#resolved)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Status Overview + Priority Overview ───────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Status overview */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Ticket Status Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {(statusOverview ?? []).length === 0 ? (
              <EmptyState icon={Ticket} title="No data" description="No tickets assigned." />
            ) : (
              <div className="flex flex-col md:flex-row items-center gap-4">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={statusOverview} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {(statusOverview ?? []).map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 min-w-36">
                  {(statusOverview ?? []).map((item, i) => (
                    <div key={item.name} className="flex items-center gap-2 text-xs">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-muted-foreground flex-1">{item.name}</span>
                      <span className="font-bold">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Priority overview */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Priority Overview (Active)</CardTitle>
          </CardHeader>
          <CardContent>
            {(priorityOverview ?? []).length === 0 ? (
              <EmptyState icon={Ticket} title="No active tickets" description="No active tickets in workload." />
            ) : (
              <div className="flex flex-col md:flex-row items-center gap-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={priorityOverview} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                    <Bar dataKey="value" name="Tickets" radius={[4, 4, 0, 0]}>
                      {(priorityOverview ?? []).map((entry) => (
                        <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name] ?? '#94a3b8'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="space-y-2 min-w-28">
                  {(priorityOverview ?? []).map(item => (
                    <Link key={item.name} to={`/tickets?priority=${item.name}&assigned_to=me`}
                      className="flex items-center gap-2 text-xs hover:underline"
                    >
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: PRIORITY_COLORS[item.name] ?? '#94a3b8' }} />
                      <span className="text-muted-foreground flex-1">{item.name}</span>
                      <span className="font-bold">{item.value}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Support Assets + Knowledge Base ────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Support Assets */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Package className="h-4 w-4 text-teal-600" /> Support Assets
            </CardTitle>
            <Button variant="ghost" size="sm" asChild className="text-xs text-muted-foreground">
              <Link to="/assets">View All <ChevronRight className="h-3 w-3 ml-1 inline" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {assetsLoading ? (
              <SectionSkeleton rows={3} />
            ) : (supportAssets ?? []).length === 0 ? (
              <EmptyState icon={Package} title="No assets in scope" description="Assets linked to your active tickets will appear here." />
            ) : (
              <div className="space-y-2">
                {(supportAssets ?? []).map(asset => (
                  <Link key={asset.id} to={`/assets/${asset.id}`}
                    className="flex items-start gap-3 p-3 border rounded-lg hover:border-primary/40 hover:bg-muted/40 transition-all group"
                  >
                    <div className="w-9 h-9 rounded-md bg-teal-50 flex items-center justify-center shrink-0">
                      <Monitor className="h-4 w-4 text-teal-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">{asset.asset_code}</span>
                        <span className="text-xs text-muted-foreground">{((asset.asset_categories as any)?.name ?? (asset.asset_categories as any)?.[0]?.name) ?? '—'}</span>
                      </div>
                      <p className="text-sm font-medium line-clamp-1">{asset.name}</p>
                      {asset.linkedTicket && (
                        <p className="text-[10px] text-muted-foreground">
                          Linked: {(asset.linkedTicket as any).ticket_number}
                        </p>
                      )}
                    </div>
                    <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded shrink-0',
                      asset.status === 'Assigned' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    )}>{asset.status}</span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Knowledge Base */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-600" /> Knowledge Base
            </CardTitle>
            <Button variant="ghost" size="sm" asChild className="text-xs text-muted-foreground">
              <Link to="/help-center">Browse All <ChevronRight className="h-3 w-3 ml-1 inline" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={kbSearch}
                onChange={e => setKbSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && kbSearch.trim()) {
                    window.location.href = `/help-center?q=${encodeURIComponent(kbSearch.trim())}`;
                  }
                }}
                placeholder="Search troubleshooting guides..."
                className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            {(kbArticles ?? []).length > 0 ? (
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {kbSearch ? 'Search Results' : 'Popular Guides'}
                </p>
                {(kbArticles ?? []).map(article => (
                  <Link key={article.id} to={`/help-center/article/${article.slug}`}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                  >
                    <div className="w-7 h-7 rounded bg-blue-50 flex items-center justify-center shrink-0">
                      <FileText className="h-3.5 w-3.5 text-blue-600" />
                    </div>
                    <span className="text-sm line-clamp-1 group-hover:text-primary transition-colors flex-1">{article.title}</span>
                    <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Quick Guides</p>
                {[
                  { icon: WifiOff, label: 'Network & VPN Troubleshooting', path: '/help-center' },
                  { icon: Monitor, label: 'Windows Troubleshooting', path: '/help-center' },
                  { icon: PrinterIcon, label: 'Printer Issues', path: '/help-center' },
                ].map(({ icon: Icon, label, path }) => (
                  <Link key={label} to={path}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                  >
                    <div className="w-7 h-7 rounded bg-blue-50 flex items-center justify-center shrink-0">
                      <Icon className="h-3.5 w-3.5 text-blue-600" />
                    </div>
                    <span className="text-sm group-hover:text-primary transition-colors">{label}</span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Notifications + Profile ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Notifications */}
        <div className="xl:col-span-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Bell className="h-4 w-4 text-blue-600" /> Notifications
                {unreadNotifCount > 0 && (
                  <span className="h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadNotifCount}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {notifLoading ? (
                <SectionSkeleton rows={5} />
              ) : (notifications ?? []).length === 0 ? (
                <EmptyState icon={Bell} title="No notifications" description="Assignment updates, employee replies, and SLA warnings will appear here in real time." />
              ) : (
                <div className="divide-y">
                  {(notifications ?? []).slice(0, 10).map(n => (
                    <div
                      key={n.id}
                      className={cn('flex items-start gap-3 py-3 px-2 -mx-2 rounded-md cursor-pointer hover:bg-muted/40 transition-colors', !n.is_read && 'bg-blue-50/50')}
                      onClick={() => handleNotifClick(n)}
                    >
                      <div className={cn('w-2 h-2 rounded-full mt-2 shrink-0', !n.is_read ? 'bg-blue-500' : 'bg-transparent border border-muted-foreground/30')} />
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm', !n.is_read ? 'font-semibold' : 'font-medium')}>{n.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.message}</p>
                        <span className="text-[10px] text-muted-foreground mt-1 block">
                          {new Date(n.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Profile */}
        <div className="xl:col-span-2">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">My Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 ring-2 ring-violet-200">
                  <AvatarImage src={profile?.profile_picture_url} alt={profile?.full_name} />
                  <AvatarFallback className="text-lg font-semibold bg-violet-50 text-violet-700">
                    {profile?.full_name?.charAt(0) || 'T'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{profile?.full_name}</p>
                  <p className="text-sm text-muted-foreground">{profile?.designation || 'IT Technician'}</p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 text-violet-800 mt-1">
                    <Wrench className="h-2.5 w-2.5 mr-1" />{profile?.employee_id}
                  </span>
                </div>
              </div>
              <div className="space-y-2.5 border-t pt-4">
                {profile?.email_address && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground text-xs truncate">{profile.email_address}</span>
                  </div>
                )}
                {profile?.mobile_number && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground text-xs">{profile.mobile_number}</span>
                  </div>
                )}
                {profile?.departments?.name && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground text-xs">{profile.departments.name}</span>
                  </div>
                )}
                {profile?.units?.name && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground text-xs">{profile.units.name}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full',
                    profile?.employment_status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  )}>{profile?.employment_status || 'Active'}</span>
                </div>
              </div>
              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link to="/profile"><User className="mr-2 h-3.5 w-3.5" />View Full Profile</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <ResolutionBreakdownDialog
        open={resolutionDialogOpen}
        onOpenChange={setResolutionDialogOpen}
        technicianId={profile?.id}
      />
    </div>
  );
}
