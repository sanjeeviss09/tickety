import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';

export function RoutingSettings() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'assignments' | 'rules'>('assignments');

  // Fetch Tech Assignments
  const { data: assignments, isLoading: loadingAssignments } = useQuery({
    queryKey: ['routing_assignments'],
    queryFn: async () => {
      const res = await api.get('/routing/assignments');
      return res.data.data;
    }
  });

  // Fetch Rules
  const { data: rules, isLoading: loadingRules } = useQuery({
    queryKey: ['routing_rules'],
    queryFn: async () => {
      const res = await api.get('/routing/rules');
      return res.data.data;
    }
  });

  const deleteAssignment = useMutation({
    mutationFn: async (id: string) => await api.delete(`/routing/assignments/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['routing_assignments'] })
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => await api.delete(`/routing/rules/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['routing_rules'] })
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h3 className="text-lg font-medium">Ticket Routing & Assignment</h3>
        <p className="text-sm text-muted-foreground">
          Manage how tickets are routed to technicians across your units.
        </p>
      </div>

      <div className="flex border-b">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'assignments' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
          onClick={() => setActiveTab('assignments')}
        >
          Technician Units
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'rules' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
          onClick={() => setActiveTab('rules')}
        >
          Routing Rules
        </button>
      </div>

      {activeTab === 'assignments' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Technician Unit Assignments</CardTitle>
              <CardDescription>Assign technicians to units they are responsible for.</CardDescription>
            </div>
            <Button size="sm"><Plus className="w-4 h-4 mr-2"/> Add Assignment</Button>
          </CardHeader>
          <CardContent>
            {loadingAssignments ? <p>Loading...</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Technician</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Primary</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments?.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No assignments configured.</TableCell></TableRow>
                  ) : assignments?.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.profiles?.full_name}</TableCell>
                      <TableCell>{a.units?.name}</TableCell>
                      <TableCell>{a.assignment_type}</TableCell>
                      <TableCell>{a.is_primary ? 'Yes' : 'No'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => deleteAssignment.mutate(a.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'rules' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Routing Rules</CardTitle>
              <CardDescription>Override default workload assignment with specific technician mapping.</CardDescription>
            </div>
            <Button size="sm"><Plus className="w-4 h-4 mr-2"/> Add Rule</Button>
          </CardHeader>
          <CardContent>
            {loadingRules ? <p>Loading...</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unit</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Assign To</TableHead>
                    <TableHead>Priority Level</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules?.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No rules configured.</TableCell></TableRow>
                  ) : rules?.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.units?.name}</TableCell>
                      <TableCell>{r.departments?.name || 'Any'}</TableCell>
                      <TableCell>{r.ticket_categories?.name || 'Any'}</TableCell>
                      <TableCell>{r.profiles?.full_name}</TableCell>
                      <TableCell>{r.priority}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => deleteRule.mutate(r.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
