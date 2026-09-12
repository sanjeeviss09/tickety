import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

export function MyAssignedTickets() {
  const { profile } = useAuthStore();
  const [filter, setFilter] = useState<string>('All');

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['my_assigned_tickets', profile?.id, filter],
    queryFn: async () => {
      if (!profile?.id) return [];
      let query = supabase.from('tickets')
        .select(`
          *,
          departments(name),
          units(name),
          ticket_categories(name),
          creator:profiles!tickets_created_by_fkey(full_name)
        `)
        .eq('assigned_to', profile.id)
        .order('created_at', { ascending: false });

      if (filter !== 'All') {
        if (filter === 'Overdue') {
          query = query.lt('due_date', new Date().toISOString()).not('status', 'in', '("Resolved","Closed","Cancelled")');
        } else {
          query = query.eq('status', filter);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

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
      case 'Assigned': return 'bg-indigo-100 text-indigo-800';
      case 'In Progress': return 'bg-purple-100 text-purple-800';
      case 'Waiting for User': return 'bg-yellow-100 text-yellow-800';
      case 'Resolved': return 'bg-green-100 text-green-800';
      case 'Closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Assigned Tickets</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage tickets routed to you</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">Active Workload</CardTitle>
            <div className="flex space-x-2">
              {['All', 'Assigned', 'In Progress', 'Waiting for User', 'Overdue'].map(f => (
                <Button 
                  key={f} 
                  size="sm" 
                  variant={filter === f ? 'default' : 'outline'}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading tickets...</div>
          ) : tickets?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Inbox className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">No tickets found</h3>
                <p className="text-sm text-muted-foreground">You do not have any tickets matching this filter.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 rounded-tl-lg">Ticket</th>
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Requester</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 rounded-tr-lg">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets?.map((ticket) => (
                    <tr key={ticket.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        <Link to={`/tickets/${ticket.id}`} className="text-primary hover:underline">
                          {ticket.ticket_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 line-clamp-1 max-w-[200px]">{ticket.subject}</td>
                      <td className="px-4 py-3 text-muted-foreground">{ticket.creator?.full_name}</td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-1 rounded-full text-xs font-semibold', getStatusColor(ticket.status))}>
                          {ticket.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={getPriorityColor(ticket.priority) as any}>{ticket.priority}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                         <Button size="sm" variant="outline" asChild>
                           <Link to={`/tickets/${ticket.id}`}>View</Link>
                         </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
