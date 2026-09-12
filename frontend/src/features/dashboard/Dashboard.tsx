import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useAnalyticsStore } from '../../store/analyticsStore';
import {
  useMyTicketsSummary,
  useMyRecentTickets,
  useMyPendingActions,
  useMyAssets,
  useMyNotifications,
  useMyServiceRequests,
  usePopularArticles,
  useMyTicketsRealtime,
  useMyAssetsRealtime,
  useMyAwaitingConfirmations,
} from './hooks/useEmployeeDashboard';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Ticket, Clock, CheckCircle, AlertTriangle, Timer, RefreshCw,
  Plus, Eye, Package, BookOpen, Wrench, Bell, AlertCircle,
  ChevronRight, Search, ExternalLink, Shield, User, Building2,
  MapPin, Phone, Mail, XCircle, CheckSquare, FileText,
  Monitor, WifiOff, PrinterIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';



// ─── Admin/Tech dashboard ─────────────────────────────────────────────────
import { KpiCard } from '../../components/analytics/KpiCard';
import { TicketTrendChart } from '../../components/analytics/TicketTrendChart';
import { DistributionPieChart } from '../../components/analytics/DistributionPieChart';
import { SlaGaugeChart } from '../../components/analytics/SlaGaugeChart';
import { TechnicianRankTable } from '../../components/analytics/TechnicianRankTable';
import { TechnicianDashboard } from './TechnicianDashboard';

// ─── Helper functions ──────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  'Open': { label: 'Open', bg: 'bg-blue-100', text: 'text-blue-800' },
  'Assigned': { label: 'Assigned', bg: 'bg-indigo-100', text: 'text-indigo-800' },
  'Accepted': { label: 'Accepted', bg: 'bg-violet-100', text: 'text-violet-800' },
  'In Progress': { label: 'In Progress', bg: 'bg-purple-100', text: 'text-purple-800' },
  'Waiting for User': { label: 'Waiting for You', bg: 'bg-yellow-100', text: 'text-yellow-800' },
  'Resolved': { label: 'Resolved', bg: 'bg-green-100', text: 'text-green-800' },
  'Closed': { label: 'Closed', bg: 'bg-gray-100', text: 'text-gray-700' },
  'Cancelled': { label: 'Cancelled', bg: 'bg-red-100', text: 'text-red-700' },
  'Reopened': { label: 'Reopened', bg: 'bg-orange-100', text: 'text-orange-800' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  'Low': { label: 'Low', color: 'text-slate-500' },
  'Medium': { label: 'Medium', color: 'text-blue-600' },
  'High': { label: 'High', color: 'text-orange-600' },
  'Critical': { label: 'Critical', color: 'text-red-600' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, bg: 'bg-gray-100', text: 'text-gray-700' };
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold', cfg.bg, cfg.text)}>
      {cfg.label}
    </span>
  );
}

function SlaIndicator({ dueDate, status }: { dueDate: string | null; status: string }) {
  if (!dueDate || ['Resolved', 'Closed', 'Cancelled'].includes(status)) return null;
  const now = new Date();
  const due = new Date(dueDate);
  const diffH = (due.getTime() - now.getTime()) / 3_600_000;

  if (diffH < 0) return (
    <span className="flex items-center gap-0.5 text-[10px] font-semibold text-red-600">
      <AlertTriangle className="h-3 w-3" /> Overdue
    </span>
  );
  if (diffH < 4) return (
    <span className="flex items-center gap-0.5 text-[10px] font-semibold text-orange-500">
      <Timer className="h-3 w-3" /> Breaching
    </span>
  );
  return (
    <span className="flex items-center gap-0.5 text-[10px] font-semibold text-green-600">
      <CheckCircle className="h-3 w-3" /> On Track
    </span>
  );
}

function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, title, description, action }: {
  icon: React.ComponentType<any>;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">{description}</p>
      </div>
      {action}
    </div>
  );
}

// ─── Employee Summary Card ────────────────────────────────────────────────
function TicketSummaryCard({
  title, value, icon, colorClass, bgClass, filterStatus, loading
}: {
  title: string; value: number; icon: React.ReactNode;
  colorClass: string; bgClass: string; filterStatus?: string; loading?: boolean;
}) {
  const navigate = useNavigate();

  return (
    <div
      className={cn(
        'relative bg-card rounded-xl border shadow-sm p-4 flex flex-col gap-2 transition-all cursor-pointer',
        filterStatus ? 'hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5' : 'cursor-default'
      )}
      onClick={() => filterStatus && navigate(`/tickets?status=${encodeURIComponent(filterStatus)}`)}
    >
      <div className={cn('absolute top-0 right-0 w-20 h-20 rounded-bl-full opacity-20', bgClass)} />
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-muted-foreground leading-tight">{title}</p>
        <div className={cn('p-1.5 rounded-lg', bgClass)}>
          <span className={colorClass}>{icon}</span>
        </div>
      </div>
      {loading ? (
        <Skeleton className="h-8 w-12" />
      ) : (
        <p className={cn('text-3xl font-bold tracking-tight', colorClass)}>{value}</p>
      )}
    </div>
  );
}

// ─── Employee Dashboard ───────────────────────────────────────────────────
export function EmployeeDashboard() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [kbSearch, setKbSearch] = useState('');

  // Realtime subscriptions
  useMyTicketsRealtime();
  useMyAssetsRealtime();

  // Data hooks
  const { data: summary, isLoading: sumLoading, error: sumError, refetch: refetchSummary } = useMyTicketsSummary();
  const { data: recentTickets, isLoading: rtLoading, error: rtError, refetch: refetchRecent } = useMyRecentTickets(8);
  const { data: pendingActions, isLoading: paLoading } = useMyPendingActions();
  const { data: myAssets, isLoading: assetsLoading, error: assetsError } = useMyAssets();
  const { data: notifications, isLoading: notifLoading } = useMyNotifications();
  const { data: serviceRequests } = useMyServiceRequests();
  const { data: popularArticles } = usePopularArticles(4);
  const { data: awaitingConfirmations, isLoading: awaitingLoading } = useMyAwaitingConfirmations();

  // Mark notification as read
  const markRead = useMutation({
    mutationFn: async (id: string) => await api.patch(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-notifications'] }),
  });

  const handleNotifClick = (notif: any) => {
    if (!notif.is_read) markRead.mutate(notif.id);
    if (notif.type === 'ticket' && notif.related_id) navigate(`/tickets/${notif.related_id}`);
    else if (notif.type === 'asset' && notif.related_id) navigate(`/assets/${notif.related_id}`);
  };

  const getPendingActionLabel = (ticket: any) => {
    switch (ticket.status) {
      case 'Waiting for User': return { label: 'Awaiting your response', action: 'Respond', color: 'text-yellow-700 bg-yellow-50' };
      case 'Resolved': return { label: 'Please confirm resolution', action: 'Confirm Resolution', color: 'text-green-700 bg-green-50' };
      case 'Reopened': return { label: 'Ticket was reopened', action: 'View Ticket', color: 'text-orange-700 bg-orange-50' };
      default: return { label: 'Action required', action: 'View', color: 'text-blue-700 bg-blue-50' };
    }
  };

  const warrantyStatus = (asset: any) => {
    const w = asset.warranty?.[0] ?? asset.warranty;
    if (!w) return null;
    const end = w.warranty_end_date ? new Date(w.warranty_end_date) : null;
    if (!end) return null;
    const daysLeft = Math.ceil((end.getTime() - Date.now()) / 86_400_000);
    if (daysLeft < 0) return <span className="text-xs text-red-600 font-medium">Expired</span>;
    if (daysLeft < 30) return <span className="text-xs text-orange-500 font-medium">Expiring {daysLeft}d</span>;
    return <span className="text-xs text-green-600 font-medium">Valid</span>;
  };

  const now = new Date();
  const overdueTickets = (recentTickets ?? []).filter(
    t => t.due_date && new Date(t.due_date) < now && !['Resolved', 'Closed', 'Cancelled'].includes(t.status)
  );
  const slaWarningTickets = (recentTickets ?? []).filter(t => {
    if (!t.due_date || ['Resolved', 'Closed', 'Cancelled'].includes(t.status)) return false;
    const dh = (new Date(t.due_date).getTime() - now.getTime()) / 3_600_000;
    return dh >= 0 && dh < 4;
  });

  return (
    <div className="space-y-8">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back, {profile?.full_name || 'Employee'} 👋
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
                <Building2 className="h-3.5 w-3.5" />
                {profile.departments.name}
              </span>
            )}
            {profile?.units?.name && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {profile.units.name}
              </span>
            )}
            {profile?.designation && (
              <span className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                {profile.designation}
              </span>
            )}
          </div>
        </div>
        <Button asChild>
          <Link to="/tickets/new">
            <Plus className="mr-2 h-4 w-4" /> Raise New Ticket
          </Link>
        </Button>
      </div>

      {/* ── Ticket Summary Cards ──────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">My Ticket Summary</h2>
        {sumError ? (
          <div className="flex items-center gap-3 p-4 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Failed to load ticket summary.</span>
            <Button size="sm" variant="outline" onClick={() => refetchSummary()} className="ml-auto text-red-700 border-red-300">
              <RefreshCw className="h-3 w-3 mr-1" /> Retry
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3">
            <TicketSummaryCard title="Total" value={summary?.total ?? 0} icon={<Ticket className="h-4 w-4" />} colorClass="text-primary" bgClass="bg-primary/10" loading={sumLoading} />
            <TicketSummaryCard title="Open" value={summary?.open ?? 0} icon={<Clock className="h-4 w-4" />} colorClass="text-blue-600" bgClass="bg-blue-100" filterStatus="Open" loading={sumLoading} />
            <TicketSummaryCard title="In Progress" value={summary?.inProgress ?? 0} icon={<Timer className="h-4 w-4" />} colorClass="text-purple-600" bgClass="bg-purple-100" filterStatus="In Progress" loading={sumLoading} />
            <TicketSummaryCard title="Waiting for You" value={summary?.waitingForUser ?? 0} icon={<AlertTriangle className="h-4 w-4" />} colorClass="text-yellow-700" bgClass="bg-yellow-100" filterStatus="Waiting for User" loading={sumLoading} />
            <TicketSummaryCard title="Resolved" value={summary?.resolved ?? 0} icon={<CheckCircle className="h-4 w-4" />} colorClass="text-green-600" bgClass="bg-green-100" filterStatus="Resolved" loading={sumLoading} />
            <TicketSummaryCard title="Closed" value={summary?.closed ?? 0} icon={<XCircle className="h-4 w-4" />} colorClass="text-gray-600" bgClass="bg-gray-100" filterStatus="Closed" loading={sumLoading} />
            <TicketSummaryCard title="Self-Solved" value={summary?.selfServiceSolved ?? 0} icon={<BookOpen className="h-4 w-4" />} colorClass="text-teal-600" bgClass="bg-teal-100" loading={sumLoading} />
            <TicketSummaryCard title="Overdue" value={summary?.overdue ?? 0} icon={<AlertCircle className="h-4 w-4" />} colorClass="text-red-600" bgClass="bg-red-100" loading={sumLoading} />
          </div>
        )}
      </div>

      {awaitingConfirmations && awaitingConfirmations.length > 0 && (
        <Card className="border-orange-200 shadow-md">
          <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-t-lg border-b border-orange-100 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-orange-900 flex items-center gap-2 text-lg">
                  <CheckCircle className="h-5 w-5" /> Awaiting Your Confirmation
                </CardTitle>
                <p className="text-sm text-orange-700 mt-1">
                  The following tickets have been marked as resolved by a technician. Please review and confirm.
                </p>
              </div>
              <Badge variant="outline" className="bg-white text-orange-700 border-orange-300">
                {awaitingConfirmations.length} Pending
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y border-t border-orange-100">
              {awaitingConfirmations.map((ticket: any) => (
                <div key={ticket.id} className="p-4 hover:bg-orange-50/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <Link to={`/tickets/${ticket.id}`} className="font-semibold text-base hover:underline text-orange-900">
                      {ticket.ticket_number}: {ticket.subject}
                    </Link>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        Resolved {new Date(ticket.technician_completed_at).toLocaleString()}
                      </span>
                      {ticket.assignee && (
                        <span className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5" />
                          By {ticket.assignee.full_name}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button onClick={() => navigate(`/tickets/${ticket.id}`)} className="bg-orange-600 hover:bg-orange-700 whitespace-nowrap">
                    Review Resolution
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Quick Actions ─────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/tickets/new"><Plus className="mr-2 h-4 w-4" />Raise New Ticket</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/tickets"><Eye className="mr-2 h-4 w-4" />View My Tickets</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/assets"><Package className="mr-2 h-4 w-4" />My Assets</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/help-center"><BookOpen className="mr-2 h-4 w-4" />Help Center</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/help-center/services"><FileText className="mr-2 h-4 w-4" />Service Catalog</Link>
          </Button>
        </div>
      </div>

      {/* ── Recent Tickets + Action Required ─────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Recent Tickets */}
        <div className="xl:col-span-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-semibold">Recent Tickets</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/tickets" className="text-xs text-muted-foreground hover:text-foreground">
                  View All <ChevronRight className="h-3 w-3 ml-1 inline" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {rtError ? (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>Failed to load tickets.</span>
                  <Button size="sm" variant="outline" onClick={() => refetchRecent()} className="ml-auto border-red-300 text-red-700">
                    <RefreshCw className="h-3 w-3 mr-1" /> Retry
                  </Button>
                </div>
              ) : rtLoading ? (
                <SectionSkeleton rows={5} />
              ) : (recentTickets ?? []).length === 0 ? (
                <EmptyState
                  icon={Ticket}
                  title="No tickets yet"
                  description="Raise a support ticket to get help from the IT team."
                  action={<Button size="sm" asChild><Link to="/tickets/new"><Plus className="mr-1 h-3 w-3" />Raise Ticket</Link></Button>}
                />
              ) : (
                <div className="space-y-0 divide-y">
                  {(recentTickets ?? []).map(ticket => (
                    <Link
                      key={ticket.id}
                      to={`/tickets/${ticket.id}`}
                      className="flex items-start gap-3 py-3 hover:bg-muted/40 transition-colors rounded-md px-2 -mx-2 group"
                    >
                      <div className="shrink-0 pt-0.5">
                        <span className={cn(
                          'w-2 h-2 rounded-full inline-block mt-1.5',
                          ['Open', 'Assigned', 'Accepted'].includes(ticket.status) ? 'bg-blue-500' :
                            ticket.status === 'In Progress' ? 'bg-purple-500' :
                              ticket.status === 'Waiting for User' ? 'bg-yellow-500' :
                                ticket.status === 'Resolved' ? 'bg-green-500' :
                                  ticket.status === 'Reopened' ? 'bg-orange-500' : 'bg-gray-400'
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-muted-foreground">{ticket.ticket_number}</span>
                          <span className={cn('text-xs font-semibold', PRIORITY_CONFIG[ticket.priority]?.color)}>
                            {ticket.priority}
                          </span>
                        </div>
                        <p className="text-sm font-medium line-clamp-1 group-hover:text-primary transition-colors">
                          {ticket.subject}
                        </p>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <StatusBadge status={ticket.status} />
                          {((Array.isArray(ticket.assignee) ? ticket.assignee[0]?.full_name : (ticket.assignee as any)?.full_name)) && (
                            <span className="text-xs text-muted-foreground">
                              → {Array.isArray(ticket.assignee) ? ticket.assignee[0]?.full_name : (ticket.assignee as any)?.full_name}
                            </span>
                          )}
                          <SlaIndicator dueDate={ticket.due_date} status={ticket.status} />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-muted-foreground block">
                          {new Date(ticket.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                        <ChevronRight className="h-3 w-3 text-muted-foreground mt-2 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Action Required */}
        <div className="xl:col-span-2">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                Action Required
                {!paLoading && (pendingActions ?? []).length > 0 && (
                  <Badge className="ml-auto bg-yellow-100 text-yellow-800 hover:bg-yellow-100 text-[10px] font-bold">
                    {(pendingActions ?? []).length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {paLoading ? (
                <SectionSkeleton rows={3} />
              ) : (pendingActions ?? []).length === 0 ? (
                <EmptyState
                  icon={CheckSquare}
                  title="All caught up!"
                  description="No tickets require your attention right now."
                />
              ) : (
                <div className="space-y-3">
                  {(pendingActions ?? []).map(ticket => {
                    const { label, action, color } = getPendingActionLabel(ticket);
                    return (
                      <div key={ticket.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-mono text-muted-foreground">{ticket.ticket_number}</span>
                            <p className="text-sm font-medium line-clamp-2 mt-0.5">{ticket.subject}</p>
                          </div>
                          <StatusBadge status={ticket.status} />
                        </div>
                        <p className={cn('text-xs px-2 py-1 rounded font-medium', color)}>{label}</p>
                        <Button size="sm" variant="outline" className="w-full text-xs" asChild>
                          <Link to={`/tickets/${ticket.id}`}>{action}</Link>
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── SLA Awareness (visible only if there are active tickets) ── */}
      {(overdueTickets.length > 0 || slaWarningTickets.length > 0) && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-orange-800">
              <Timer className="h-4 w-4" /> SLA Awareness
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overdueTickets.map(t => (
                <Link key={t.id} to={`/tickets/${t.id}`} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <div>
                      <p className="text-sm font-medium text-red-800">{t.subject}</p>
                      <p className="text-xs text-red-600">{t.ticket_number} · Overdue since {new Date(t.due_date!).toLocaleDateString('en-IN')}</p>
                    </div>
                  </div>
                  <Badge className="bg-red-100 text-red-800 text-[10px]">Overdue</Badge>
                </Link>
              ))}
              {slaWarningTickets.map(t => (
                <Link key={t.id} to={`/tickets/${t.id}`} className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors">
                  <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4 text-orange-600" />
                    <div>
                      <p className="text-sm font-medium text-orange-800">{t.subject}</p>
                      <p className="text-xs text-orange-600">{t.ticket_number} · Due {new Date(t.due_date!).toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                  <Badge className="bg-orange-100 text-orange-800 text-[10px]">Approaching SLA</Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── My Assets + Help Center ────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* My Assets */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Package className="h-4 w-4 text-teal-600" /> My Assets
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/assets" className="text-xs text-muted-foreground">
                View All <ChevronRight className="h-3 w-3 ml-1 inline" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {assetsError ? (
              <div className="text-sm text-red-600 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> Failed to load assets.
              </div>
            ) : assetsLoading ? (
              <SectionSkeleton rows={3} />
            ) : (myAssets ?? []).length === 0 ? (
              <EmptyState
                icon={Package}
                title="No assets assigned"
                description="No assets are currently assigned to you. Contact IT if you expect to see an asset here."
              />
            ) : (
              <div className="space-y-3">
                {(myAssets ?? []).slice(0, 5).map(asset => (
                  <Link key={asset.id} to={`/assets/${asset.id}`}
                    className="flex items-start gap-3 p-3 rounded-lg border hover:border-primary/40 hover:bg-muted/40 transition-all group"
                  >
                    <div className="w-9 h-9 rounded-md bg-teal-50 flex items-center justify-center shrink-0">
                      <Monitor className="h-4 w-4 text-teal-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground">{asset.asset_code}</span>
                        <span className="text-xs text-muted-foreground">{Array.isArray(asset.category) ? asset.category[0]?.name : (asset.category as any)?.name}</span>
                      </div>
                      <p className="text-sm font-medium line-clamp-1">{asset.name}</p>
                      {(asset.brand || asset.model) && (
                        <p className="text-xs text-muted-foreground">{[asset.brand, asset.model].filter(Boolean).join(' · ')}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <span className={cn(
                        'text-xs font-semibold px-1.5 py-0.5 rounded',
                        asset.status === 'Assigned' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      )}>{asset.status}</span>
                      {warrantyStatus(asset)}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Help Center */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-600" /> Help Center
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/help-center" className="text-xs text-muted-foreground">
                Browse All <ChevronRight className="h-3 w-3 ml-1 inline" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={kbSearch}
                onChange={e => setKbSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && kbSearch.trim()) {
                    navigate(`/help-center?q=${encodeURIComponent(kbSearch.trim())}`);
                  }
                }}
                placeholder="What do you need help with?"
                className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            {/* Popular articles */}
            {(popularArticles ?? []).length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Popular Articles</p>
                {(popularArticles ?? []).map(article => (
                  <Link key={article.id} to={`/help-center/article/${article.slug}`}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                  >
                    <div className="w-7 h-7 rounded bg-blue-50 flex items-center justify-center shrink-0">
                      <FileText className="h-3.5 w-3.5 text-blue-600" />
                    </div>
                    <span className="text-sm line-clamp-1 group-hover:text-primary transition-colors">{article.title}</span>
                    <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick Help</p>
                {[
                  { icon: Shield, label: 'How to reset your password', path: '/help-center' },
                  { icon: WifiOff, label: 'VPN / Network issues', path: '/help-center' },
                  { icon: PrinterIcon, label: 'Printer troubleshooting', path: '/help-center' },
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

      {/* ── Service Requests ──────────────────────────────────────── */}
      {(serviceRequests && serviceRequests.length > 0) && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Wrench className="h-4 w-4 text-violet-600" /> My Service Requests
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/help-center/services" className="text-xs text-muted-foreground">
                Browse Services <ChevronRight className="h-3 w-3 ml-1 inline" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {serviceRequests.map(sr => (
                <div key={sr.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/40 transition-colors">
                  <div>
                    <p className="text-sm font-medium">{(Array.isArray(sr.service) ? (sr.service as any[])[0]?.name : (sr.service as any)?.name) ?? 'Service Request'}</p>
                    <p className="text-xs text-muted-foreground">
                      {sr.request_number} · Submitted {new Date(sr.created_at).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <StatusBadge status={sr.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Notifications + Profile ───────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Notifications */}
        <div className="xl:col-span-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Bell className="h-4 w-4 text-blue-600" /> Recent Notifications
                {!notifLoading && (notifications ?? []).filter(n => !n.is_read).length > 0 && (
                  <span className="h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {(notifications ?? []).filter(n => !n.is_read).length}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {notifLoading ? (
                <SectionSkeleton rows={4} />
              ) : (notifications ?? []).length === 0 ? (
                <EmptyState
                  icon={Bell}
                  title="No notifications"
                  description="You're all caught up. Notifications for ticket updates and assignments will appear here."
                />
              ) : (
                <div className="space-y-0 divide-y">
                  {(notifications ?? []).slice(0, 8).map(n => (
                    <div
                      key={n.id}
                      className={cn(
                        'flex items-start gap-3 py-3 px-2 -mx-2 rounded-md cursor-pointer hover:bg-muted/40 transition-colors',
                        !n.is_read && 'bg-blue-50/50'
                      )}
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

        {/* Employee Profile Summary */}
        <div className="xl:col-span-2">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">My Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 ring-2 ring-primary/20">
                  <AvatarImage src={profile?.profile_picture_url} alt={profile?.full_name} />
                  <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">
                    {profile?.full_name?.charAt(0) || 'E'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-foreground">{profile?.full_name}</p>
                  <p className="text-sm text-muted-foreground">{profile?.designation || profile?.roles?.name}</p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary mt-1">
                    {profile?.employee_id}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 border-t pt-4">
                {profile?.email_address && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground truncate">{profile.email_address}</span>
                  </div>
                )}
                {profile?.mobile_number && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">{profile.mobile_number}</span>
                  </div>
                )}
                {profile?.departments?.name && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">{profile.departments.name}</span>
                  </div>
                )}
                {profile?.units?.name && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">{profile.units.name}</span>
                  </div>
                )}
                {profile?.employment_status && (
                  <div className="flex items-center gap-2 text-sm">
                    <Shield className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className={cn(
                      'text-xs font-semibold px-2 py-0.5 rounded-full',
                      profile.employment_status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    )}>{profile.employment_status}</span>
                  </div>
                )}
              </div>

              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link to="/profile"><User className="mr-2 h-3.5 w-3.5" />View Full Profile</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Admin / Technician Dashboard (unchanged) ─────────────────────────────
export function AdminDashboard() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const {
    summary, ticketTrends, ticketDistribution, assetDistribution, technicianPerformance,
    loading,
    fetchSummary, fetchTicketTrends, fetchTicketDistribution, fetchAssetDistribution, fetchTechnicianPerformance
  } = useAnalyticsStore();

  const isAdmin = profile?.roles?.name === 'Admin';

  useEffect(() => {
    fetchSummary();
    fetchTicketTrends('month');
    fetchTicketDistribution('status');
    fetchAssetDistribution('status');
    if (isAdmin) fetchTechnicianPerformance();
  }, [profile?.id]);

  const s = summary;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Executive Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Real-time enterprise metrics · {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild><Link to="/analytics">Full Analytics →</Link></Button>
          <Button variant="outline" size="sm" asChild><Link to="/reports">Reports →</Link></Button>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Ticket Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          <KpiCard title="Total Tickets" value={s?.totalTickets ?? '—'} icon={<Ticket className="h-5 w-5" />} colorClass="text-primary" bgClass="bg-primary/10" onClick={() => navigate('/tickets')} />
          <KpiCard title="Open" value={s?.openTickets ?? '—'} subtitle="Waiting for action" icon={<Clock className="h-5 w-5" />} colorClass="text-blue-600" bgClass="bg-blue-50" onClick={() => navigate('/tickets?status=Open')} />
          <KpiCard title="In Progress" value={s?.inProgressTickets ?? '—'} icon={<Timer className="h-5 w-5" />} colorClass="text-indigo-600" bgClass="bg-indigo-50" onClick={() => navigate('/tickets?status=In Progress')} />
          <KpiCard title="Resolved / Closed" value={(s?.resolvedTickets ?? 0) + (s?.closedTickets ?? 0)} icon={<CheckCircle className="h-5 w-5" />} colorClass="text-green-600" bgClass="bg-green-50" onClick={() => navigate('/tickets?status=Resolved,Closed')} />
          <KpiCard title="Critical" value={s?.criticalTickets ?? '—'} subtitle="Requires immediate attention" icon={<AlertTriangle className="h-5 w-5" />} colorClass="text-red-600" bgClass="bg-red-50" onClick={() => navigate('/tickets?priority=Critical')} />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">SLA & Performance</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <KpiCard title="SLA Compliance" value={s?.slaCompliance ?? '—'} format="percent" icon={<Shield className="h-5 w-5" />} colorClass="text-emerald-600" bgClass="bg-emerald-50" />
          <KpiCard title="SLA Breaches" value={s?.slaBreaches ?? '—'} icon={<AlertTriangle className="h-5 w-5" />} colorClass="text-orange-600" bgClass="bg-orange-50" onClick={() => navigate('/tickets?sla=breached')} />
          <KpiCard title="Overdue Tickets" value={s?.overdueTickets ?? '—'} icon={<AlertCircle className="h-5 w-5" />} colorClass="text-red-600" bgClass="bg-red-50" onClick={() => navigate('/tickets?sla=overdue')} />
          <KpiCard title="Avg Resolution" value={s?.avgResolutionHours ?? '—'} format="hours" subtitle="Per resolved ticket" icon={<Timer className="h-5 w-5" />} colorClass="text-violet-600" bgClass="bg-violet-50" />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Assets & Infrastructure</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <KpiCard title="Active Employees" value={s?.activeEmployees ?? '—'} icon={<User className="h-5 w-5" />} colorClass="text-cyan-600" bgClass="bg-cyan-50" onClick={() => navigate('/directory')} />
          <KpiCard title="Total Assets" value={s?.totalAssets ?? '—'} icon={<Package className="h-5 w-5" />} colorClass="text-teal-600" bgClass="bg-teal-50" onClick={() => navigate('/assets')} />
          <KpiCard title="Under Maintenance" value={s?.assetsUnderMaintenance ?? '—'} icon={<Wrench className="h-5 w-5" />} colorClass="text-yellow-600" bgClass="bg-yellow-50" onClick={() => navigate('/assets?status=Under Maintenance')} />
          <KpiCard title="Warranty Expiring" value={s?.warrantyExpiringSoon ?? '—'} subtitle="Within 30 days" icon={<AlertCircle className="h-5 w-5" />} colorClass="text-pink-600" bgClass="bg-pink-50" onClick={() => navigate('/assets?warranty=expiring')} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TicketTrendChart data={ticketTrends} onPeriodChange={fetchTicketTrends} loading={loading && ticketTrends.length === 0} />
        </div>
        <SlaGaugeChart compliance={s?.slaCompliance ?? 100} subtitle="Overall SLA performance" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DistributionPieChart
          data={ticketDistribution} title="Ticket Distribution" subtitle="Breakdown by grouping"
          groupByOptions={[
            { label: 'Status', value: 'status' }, { label: 'Priority', value: 'priority' },
            { label: 'Category', value: 'category' }, { label: 'Unit', value: 'unit' },
          ]}
          onGroupByChange={fetchTicketDistribution}
          loading={loading && ticketDistribution.length === 0}
        />
        <DistributionPieChart
          data={assetDistribution} title="Asset Distribution" subtitle="Breakdown by grouping"
          groupByOptions={[
            { label: 'Status', value: 'status' }, { label: 'Category', value: 'category' },
            { label: 'Unit', value: 'unit' },
          ]}
          onGroupByChange={fetchAssetDistribution}
          loading={loading && assetDistribution.length === 0}
        />
      </div>

      {isAdmin && (
        <TechnicianRankTable data={technicianPerformance} loading={loading && technicianPerformance.length === 0} />
      )}
    </div>
  );
}

// ─── Root Dashboard — routes by role ─────────────────────────────────────
export function Dashboard() {
  const { profile } = useAuthStore();
  const role = profile?.roles?.name;

  if (role === 'Employee') return <EmployeeDashboard />;
  if (role === 'Technician') return <TechnicianDashboard />;
  return <AdminDashboard />;
}
