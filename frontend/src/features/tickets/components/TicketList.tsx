import { useState, useEffect } from 'react';
import { useAuthStore } from '../../../store/authStore';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/StatusBadge';
import { PriorityBadge } from '@/components/PriorityBadge';
import { SlaBadge } from '@/components/SlaBadge';
import { Plus, Ticket, Search, Trash2, ChevronRight, AlertCircle, RefreshCw, X, ChevronLeft } from 'lucide-react';
import { useTickets } from '../hooks/useTickets';
import { useDebounce } from '../../../hooks/useDebounce';
import api from '../../../lib/api';
import { useQueryClient } from '@tanstack/react-query';

export function TicketList() {
  const { profile } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const initialStatus = searchParams.get('status') || 'All';
  const initialPriority = searchParams.get('priority') || 'All';
  const initialSla = searchParams.get('sla') || 'All';

  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [priorityFilter, setPriorityFilter] = useState(initialPriority);
  const [slaFilter, setSlaFilter] = useState(initialSla);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const limit = 20;

  // Keep state in sync with URL searchParams (e.g. when navigating from dashboard KPI cards)
  useEffect(() => {
    setStatusFilter(searchParams.get('status') || 'All');
    setPriorityFilter(searchParams.get('priority') || 'All');
    setSlaFilter(searchParams.get('sla') || 'All');
    setPage(0);
  }, [searchParams]);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Use the new TanStack Query hook
  const { data: ticketsData, isLoading: loading, error, refetch } = useTickets({
    status: statusFilter === 'All' ? undefined : statusFilter,
    priority: priorityFilter === 'All' ? undefined : priorityFilter,
    sla: slaFilter === 'All' ? undefined : slaFilter,
    search: debouncedSearchTerm || undefined,
    page,
    limit
  });

  const tickets = ticketsData?.data || [];
  const totalCount = ticketsData?.count || 0;
  const hasMore = (page + 1) * limit < totalCount;

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this ticket?')) {
      try {
        await api.delete(`/tickets/${id}`);
        queryClient.invalidateQueries({ queryKey: ['tickets'] });
      } catch (err: any) {
        alert(err.response?.data?.message || 'Failed to delete ticket');
      }
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('All');
    setPriorityFilter('All');
    setSlaFilter('All');
    setPage(0);
    setSearchParams({});
  };

  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'All' || priorityFilter !== 'All' || slaFilter !== 'All';

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      {/* ── Page Header ── */}
      <div className="flex flex-wrap sm:flex-nowrap justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tickets</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {totalCount > 0 ? `${totalCount} ticket${totalCount !== 1 ? 's' : ''}` : 'Manage all support tickets'}
          </p>
        </div>
        <Button asChild size="default" className="w-full sm:w-auto h-11 sm:h-10">
          <Link to="/tickets/new">
            <Plus className="mr-2 h-4 w-4" /> Raise Ticket
          </Link>
        </Button>
      </div>

      <Card className="border-0 shadow-none sm:shadow-sm sm:border bg-transparent sm:bg-card">
        {/* ── Search and Filters ── */}
        <CardHeader className="pb-4 sm:border-b px-0 sm:px-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-3 w-full">
              {/* Search */}
              <div className="relative w-full md:flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by ID or Subject..."
                  className="pl-9 h-10 w-full bg-background sm:bg-background"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
                />
              </div>
              
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <Select 
                  value={statusFilter} 
                  onValueChange={(val) => { 
                    setStatusFilter(val); 
                    setPage(0);
                    const newParams = new URLSearchParams(searchParams);
                    if (val === 'All') newParams.delete('status');
                    else newParams.set('status', val);
                    setSearchParams(newParams);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[150px] h-10 bg-background sm:bg-background">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Status</SelectItem>
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="Assigned">Assigned</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Waiting for User">Waiting for User</SelectItem>
                    <SelectItem value="Awaiting Employee Confirmation">Awaiting Confirmation</SelectItem>
                    <SelectItem value="Resolved">Resolved</SelectItem>
                    <SelectItem value="Closed">Closed</SelectItem>
                    <SelectItem value="Reopened">Reopened</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>

                <Select 
                  value={priorityFilter} 
                  onValueChange={(val) => { 
                    setPriorityFilter(val); 
                    setPage(0);
                    const newParams = new URLSearchParams(searchParams);
                    if (val === 'All') newParams.delete('priority');
                    else newParams.set('priority', val);
                    setSearchParams(newParams);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[140px] h-10 bg-background sm:bg-background">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Priority</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Critical">Critical</SelectItem>
                  </SelectContent>
                </Select>

                <Select 
                  value={slaFilter} 
                  onValueChange={(val) => { 
                    setSlaFilter(val); 
                    setPage(0);
                    const newParams = new URLSearchParams(searchParams);
                    if (val === 'All') newParams.delete('sla');
                    else newParams.set('sla', val);
                    setSearchParams(newParams);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[150px] h-10 bg-background sm:bg-background">
                    <SelectValue placeholder="SLA" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All SLA</SelectItem>
                    <SelectItem value="breached">SLA Breached</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="approaching">Approaching</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>

        {/* ── Content Area ── */}
        <CardContent className="p-0 sm:p-6">
          {error ? (
            /* Error State */
            <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center text-red-700 bg-red-50 m-4 sm:m-0 rounded-lg border border-red-100 shadow-sm">
              <AlertCircle className="h-10 w-10 mb-4 text-red-500" />
              <h3 className="text-lg font-semibold mb-1">Unable to load tickets</h3>
              <p className="text-sm opacity-80 max-w-md mb-6">{error instanceof Error ? error.message : 'Unknown error'}</p>
              <Button variant="outline" onClick={() => refetch()} className="bg-white hover:bg-red-50 border-red-200">
                <RefreshCw className="mr-2 h-4 w-4" /> Retry
              </Button>
            </div>
          ) : loading && tickets.length === 0 ? (
            /* Loading State */
            <div className="w-full mt-4 sm:mt-0">
              <div className="hidden md:block border rounded-md bg-card shadow-sm">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted border-b">
                    <tr>
                      <th className="px-4 py-3"><Skeleton className="h-4 w-20" /></th>
                      <th className="px-4 py-3"><Skeleton className="h-4 w-40" /></th>
                      <th className="px-4 py-3"><Skeleton className="h-4 w-24" /></th>
                      <th className="px-4 py-3"><Skeleton className="h-4 w-20" /></th>
                      <th className="px-4 py-3"><Skeleton className="h-4 w-28" /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3, 4, 5].map(i => (
                      <tr key={i} className="border-b">
                        <td className="px-4 py-4"><Skeleton className="h-4 w-24" /></td>
                        <td className="px-4 py-4"><Skeleton className="h-4 w-full max-w-[300px]" /></td>
                        <td className="px-4 py-4"><Skeleton className="h-6 w-20 rounded-full" /></td>
                        <td className="px-4 py-4"><Skeleton className="h-6 w-16 rounded-full" /></td>
                        <td className="px-4 py-4"><Skeleton className="h-4 w-32" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden flex flex-col gap-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="p-4 space-y-4 rounded-xl border bg-card shadow-sm">
                    <div className="flex justify-between items-start">
                      <Skeleton className="h-4 w-24" />
                      <div className="flex gap-2">
                        <Skeleton className="h-5 w-20 rounded-full" />
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </div>
                    </div>
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))}
              </div>
            </div>
          ) : tickets.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-20 px-4 gap-4 text-center border sm:rounded-md mt-4 sm:mt-0 bg-card shadow-sm">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Ticket className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">No tickets found</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  {hasActiveFilters 
                    ? "We couldn't find any tickets matching your current search or filters." 
                    : "You don't have any tickets yet. Raise a new ticket to get help from your IT team."}
                </p>
              </div>
              {hasActiveFilters ? (
                <Button variant="outline" onClick={clearFilters} className="mt-2">
                  <X className="mr-2 h-4 w-4" /> Clear Filters
                </Button>
              ) : (
                <Button asChild className="mt-2">
                  <Link to="/tickets/new">
                    <Plus className="mr-2 h-4 w-4" /> Raise Your First Ticket
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="w-full mt-4 sm:mt-0 space-y-4">
              {/* ── Desktop Data Table (hidden on mobile) ── */}
              <div className="hidden md:block rounded-md border overflow-hidden bg-card shadow-sm">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-muted text-muted-foreground border-b">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Ticket ID</th>
                      <th className="px-4 py-3 font-semibold">Subject</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Priority</th>
                      <th className="px-4 py-3 font-semibold">SLA</th>
                      <th className="px-4 py-3 font-semibold hidden lg:table-cell">Category</th>
                      <th className="px-4 py-3 font-semibold">Assignee</th>
                      <th className="px-4 py-3 font-semibold hidden lg:table-cell">Updated</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {tickets.map((ticket: any) => (
                      <tr key={ticket.id} className="hover:bg-muted/50 transition-colors group">
                        <td className="px-4 py-3 font-medium whitespace-nowrap">
                          <Link to={`/tickets/${ticket.id}`} className="text-primary hover:underline">
                            {ticket.ticket_number}
                          </Link>
                        </td>
                        <td className="px-4 py-3 max-w-[300px]">
                          <div className="truncate font-medium">{ticket.subject}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <StatusBadge status={ticket.status} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <PriorityBadge priority={ticket.priority} showIcon={false} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <SlaBadge 
                            dueDate={ticket.due_date} 
                            status={ticket.status} 
                            resolutionDate={ticket.resolution_date} 
                            closedAt={ticket.closed_at} 
                            createdAt={ticket.created_at}
                          />
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground truncate max-w-[150px]">
                          {ticket.ticket_categories?.name || ticket.categories?.name || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                          {Array.isArray(ticket.assignee) ? ticket.assignee[0]?.full_name : ticket.assignee?.full_name || 'Unassigned'}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell whitespace-nowrap text-muted-foreground text-xs">
                          {new Date(ticket.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <Link to={`/tickets/${ticket.id}`} className="text-primary hover:underline text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                              View
                            </Link>
                            {((profile?.roles?.name || profile?.roles?.[0]?.name || profile?.role?.name || profile?.role) === 'Admin' || ticket.created_by === profile?.id) && (
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleDelete(ticket.id);
                                }}
                                aria-label="Delete ticket"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Mobile Card List (hidden on desktop) ── */}
              <div className="md:hidden flex flex-col gap-3">
                {tickets.map((ticket: any) => (
                  <Link 
                    to={`/tickets/${ticket.id}`} 
                    key={ticket.id} 
                    className="p-4 rounded-xl border bg-card shadow-sm hover:border-primary/50 transition-colors flex flex-col gap-3 relative block active:bg-muted/50"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-xs font-mono font-medium text-muted-foreground">
                        {ticket.ticket_number}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5 justify-end">
                        <SlaBadge 
                          dueDate={ticket.due_date} 
                          status={ticket.status} 
                          resolutionDate={ticket.resolution_date} 
                          closedAt={ticket.closed_at} 
                          createdAt={ticket.created_at}
                        />
                        <StatusBadge status={ticket.status} />
                        <PriorityBadge priority={ticket.priority} showIcon={false} />
                      </div>
                    </div>
                    <h3 className="font-semibold text-foreground text-base leading-snug pr-6 break-words">
                      {ticket.subject}
                    </h3>
                    <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground opacity-30" />
                    <div className="flex flex-col gap-1.5 mt-1 pt-3 border-t">
                      <p className="text-xs text-muted-foreground">
                        {ticket.ticket_categories?.name || ticket.categories?.name || 'General'} • {Array.isArray(ticket.assignee) ? ticket.assignee[0]?.full_name : ticket.assignee?.full_name || 'Unassigned'}
                      </p>
                      <p className="text-[11px] text-muted-foreground/70">
                        Updated {new Date(ticket.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} • {new Date(ticket.updated_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Server-Side Pagination Controls */}
              <div className="flex items-center justify-between border-t pt-4">
                <span className="text-sm text-muted-foreground">
                  Showing {page * limit + 1} to {Math.min((page + 1) * limit, totalCount)} of {totalCount} entries
                </span>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0 || loading}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setPage(p => p + 1)}
                    disabled={!hasMore || loading}
                  >
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>

            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
