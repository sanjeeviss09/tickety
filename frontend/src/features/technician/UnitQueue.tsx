import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle } from 'lucide-react';

export function UnitQueue() {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const isAdmin = profile?.roles?.name === 'Admin';

  // Get Tech's units from technician_unit_assignments junction table
  const { data: techUnits } = useQuery({
    queryKey: ['my_units', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('technician_unit_assignments')
        .select('unit_id, units(name)')
        .eq('technician_id', profile?.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.id
  });

  const unitIds = Array.from(new Set([
    ...(profile?.unit_id ? [profile.unit_id] : []),
    ...(techUnits?.map((u: any) => u.unit_id) || [])
  ]));

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['unit_queue', unitIds, isAdmin],
    queryFn: async () => {
      if (!isAdmin && unitIds.length === 0) return [];
      
      let query = supabase.from('tickets')
        .select(`
          *,
          departments(name),
          units(name),
          ticket_categories(name),
          creator:profiles!tickets_created_by_fkey(full_name)
        `)
        .is('assigned_to', null)
        .order('created_at', { ascending: false });

      if (!isAdmin) {
        query = query.in('unit_id', unitIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: isAdmin || unitIds.length > 0,
  });

  const acceptTicket = useMutation({
    mutationFn: async (ticketId: string) => {
      const { data, error } = await supabase.from('tickets')
        .update({ assigned_to: profile?.id, assigned_at: new Date().toISOString(), status: 'Assigned' })
        .eq('id', ticketId)
        .select().single();
        
      if (error) throw error;

      // Create timeline
      await supabase.from('ticket_timeline').insert([{
        ticket_id: ticketId,
        user_id: profile?.id,
        action_type: 'ASSIGNMENT',
        message: 'Technician self-assigned ticket from Unit Queue',
      }]);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unit_queue'] });
      queryClient.invalidateQueries({ queryKey: ['my_assigned_tickets'] });
    }
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Unit Unassigned Queue</h1>
          <p className="text-muted-foreground text-sm mt-1">Pick up tickets from your assigned Units</p>
        </div>
      </div>

      {!isAdmin && unitIds.length === 0 && (
        <div className="bg-orange-50 border border-orange-200 text-orange-800 p-4 rounded-lg flex gap-3 items-center">
          <AlertCircle className="w-5 h-5 text-orange-500" />
          <p className="text-sm">You are not assigned to any Units. Please contact your Admin to assign you to a Unit.</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Unassigned Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading queue...</div>
          ) : tickets?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Queue is empty</h3>
                <p className="text-sm text-muted-foreground">There are no unassigned tickets in your units.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 rounded-tl-lg">Ticket</th>
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-4 py-3">Requester</th>
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
                      <td className="px-4 py-3 font-medium text-muted-foreground">{ticket.units?.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{ticket.creator?.full_name}</td>
                      <td className="px-4 py-3">
                        <Badge variant={getPriorityColor(ticket.priority) as any}>{ticket.priority}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 flex gap-2">
                         {!isAdmin && (
                           <Button 
                              size="sm" 
                              variant="default"
                              onClick={() => acceptTicket.mutate(ticket.id)}
                              disabled={acceptTicket.isPending}
                            >
                             Accept
                           </Button>
                         )}
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
