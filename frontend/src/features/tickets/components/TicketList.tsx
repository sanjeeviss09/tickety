import { useEffect, useState } from 'react';
import { useTicketStore } from '../../../store/ticketStore';
import { useAuthStore } from '../../../store/authStore';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Plus, Ticket, Search } from 'lucide-react';

export function TicketList() {
  const { tickets, loading, fetchTickets, subscribeToTickets, unsubscribeFromTickets } = useTicketStore();
  const { profile } = useAuthStore();
  const [searchParams] = useSearchParams();

  const initialStatus = searchParams.get('status') || 'All';
  const initialPriority = searchParams.get('priority') || 'All';
  const initialSla = searchParams.get('sla') || 'All';

  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [priorityFilter, setPriorityFilter] = useState(initialPriority);
  const [slaFilter, setSlaFilter] = useState(initialSla);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchTickets();
    if (profile) {
      subscribeToTickets(profile.id, profile.roles?.name);
    }
    return () => {
      unsubscribeFromTickets();
    };
  }, [profile]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical': return 'destructive';
      case 'High': return 'default';
      case 'Medium': return 'secondary';
      case 'Low': return 'outline';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open': return 'bg-blue-100 text-blue-800';
      case 'In Progress': return 'bg-purple-100 text-purple-800';
      case 'Resolved': return 'bg-green-100 text-green-800';
      case 'Closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = 
      ticket.ticket_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.subject?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'All' 
      ? true 
      : statusFilter.includes(',')
        ? statusFilter.split(',').includes(ticket.status)
        : ticket.status === statusFilter;

    const matchesPriority = priorityFilter === 'All' || ticket.priority === priorityFilter;

    let matchesSla = true;
    if (slaFilter === 'breached') {
      const now = new Date();
      if (!ticket.due_date || ['Resolved', 'Closed', 'Cancelled'].includes(ticket.status)) matchesSla = false;
      else {
        const dh = (new Date(ticket.due_date).getTime() - now.getTime()) / 3_600_000;
        matchesSla = dh >= 0 && dh < 4; // Approaching SLA/Breaching
      }
    } else if (slaFilter === 'overdue') {
      const now = new Date();
      if (!ticket.due_date || ['Resolved', 'Closed', 'Cancelled'].includes(ticket.status)) matchesSla = false;
      else {
        const dh = (new Date(ticket.due_date).getTime() - now.getTime()) / 3_600_000;
        matchesSla = dh < 0; // Overdue
      }
    }

    return matchesSearch && matchesStatus && matchesPriority && matchesSla;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tickets</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {filteredTickets.length > 0 ? `${filteredTickets.length} ticket${filteredTickets.length !== 1 ? 's' : ''}` : 'Manage all support tickets'}
          </p>
        </div>
        {/* All roles can raise a ticket */}
        <Button asChild size="default">
          <Link to="/tickets/new">
            <Plus className="mr-2 h-4 w-4" /> Raise Ticket
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4 border-b">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <CardTitle>All Tickets</CardTitle>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search tickets..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Status</SelectItem>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Resolved">Resolved</SelectItem>
                  <SelectItem value="Closed">Closed</SelectItem>
                  <SelectItem value="Resolved,Closed">Resolved / Closed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-full sm:w-36">
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
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading && tickets.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">Loading tickets...</div>
          ) : tickets.length === 0 ? (
            /* Empty state with CTA */
            <div className="flex flex-col items-center justify-center py-20 gap-5 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Ticket className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">No tickets yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Raise a new support ticket to get help from your IT team.
                </p>
              </div>
              <Button asChild>
                <Link to="/tickets/new">
                  <Plus className="mr-2 h-4 w-4" /> Raise Your First Ticket
                </Link>
              </Button>
            </div>
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 rounded-tl-lg">Ticket ID</th>
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Created By</th>
                    <th className="px-4 py-3">Assignee</th>
                    <th className="px-4 py-3 rounded-tr-lg">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((ticket) => (
                    <tr key={ticket.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        <Link to={`/tickets/${ticket.id}`} className="text-primary hover:underline">
                          {ticket.ticket_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{ticket.subject}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(ticket.status)}`}>
                          {ticket.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={getPriorityColor(ticket.priority) as any}>{ticket.priority}</Badge>
                      </td>
                      <td className="px-4 py-3">{ticket.creator?.full_name || 'System'}</td>
                      <td className="px-4 py-3">{ticket.assignee?.full_name || 'Unassigned'}</td>
                      <td className="px-4 py-3">{new Date(ticket.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {filteredTickets.length > 0 && (
            <div className="p-4 border-t text-xs text-muted-foreground text-center">
              Showing {filteredTickets.length} of {tickets.length} tickets
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
