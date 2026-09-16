import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Loader2 } from 'lucide-react';

export function RoutingSettings() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'assignments' | 'rules'>('assignments');

  // Modals state
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);

  // Form states
  const [assignmentForm, setAssignmentForm] = useState({
    technician_id: '',
    unit_id: '',
    assignment_type: 'Manual Assignment',
    is_primary: false,
  });

  const [ruleForm, setRuleForm] = useState({
    unit_id: '',
    department_id: '',
    category_id: '',
    technician_id: '',
    priority: 1,
    is_active: true,
  });

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

  // Supporting queries for dropdowns
  const { data: units } = useQuery({
    queryKey: ['units'],
    queryFn: async () => {
      const res = await api.get('/units');
      return res.data.data;
    }
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const res = await api.get('/departments');
      return res.data.data;
    }
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/categories');
      return res.data.data;
    }
  });

  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const res = await api.get('/employees');
      return res.data.data;
    }
  });

  // Mutations
  const createAssignment = useMutation({
    mutationFn: async (payload: typeof assignmentForm) => {
      return await api.post('/routing/assignments', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routing_assignments'] });
      setIsAssignmentModalOpen(false);
      setAssignmentForm({
        technician_id: '',
        unit_id: '',
        assignment_type: 'Manual Assignment',
        is_primary: false,
      });
      alert('Technician assignment added successfully.');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to add assignment');
    }
  });

  const deleteAssignment = useMutation({
    mutationFn: async (id: string) => await api.delete(`/routing/assignments/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['routing_assignments'] }),
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to delete assignment');
    }
  });

  const createRule = useMutation({
    mutationFn: async (payload: typeof ruleForm) => {
      const cleanPayload: any = {
        unit_id: payload.unit_id,
        technician_id: payload.technician_id,
        priority: Number(payload.priority) || 1,
        is_active: payload.is_active,
      };
      if (payload.department_id) cleanPayload.department_id = payload.department_id;
      if (payload.category_id) cleanPayload.category_id = payload.category_id;
      return await api.post('/routing/rules', cleanPayload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routing_rules'] });
      setIsRuleModalOpen(false);
      setRuleForm({
        unit_id: '',
        department_id: '',
        category_id: '',
        technician_id: '',
        priority: 1,
        is_active: true,
      });
      alert('Routing rule created successfully.');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to create rule');
    }
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => await api.delete(`/routing/rules/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['routing_rules'] }),
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to delete rule');
    }
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
            <Button size="sm" onClick={() => setIsAssignmentModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2"/> Add Assignment
            </Button>
          </CardHeader>
          <CardContent>
            {loadingAssignments ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="animate-spin h-6 w-6 text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Technician</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Primary</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments?.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No assignments configured.</TableCell></TableRow>
                  ) : assignments?.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.profiles?.full_name || 'Unknown'}</TableCell>
                      <TableCell>{a.units?.name || 'Unknown'}</TableCell>
                      <TableCell>{a.assignment_type}</TableCell>
                      <TableCell>
                        <Badge variant={a.is_primary ? 'default' : 'outline'}>
                          {a.is_primary ? 'Yes' : 'No'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            if (confirm('Are you sure you want to remove this assignment?')) {
                              deleteAssignment.mutate(a.id);
                            }
                          }}
                          disabled={deleteAssignment.isPending}
                        >
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
            <Button size="sm" onClick={() => setIsRuleModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2"/> Add Rule
            </Button>
          </CardHeader>
          <CardContent>
            {loadingRules ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="animate-spin h-6 w-6 text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unit</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Assign To</TableHead>
                    <TableHead>Priority Level</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules?.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No rules configured.</TableCell></TableRow>
                  ) : rules?.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.units?.name || 'Any'}</TableCell>
                      <TableCell>{r.departments?.name || 'Any'}</TableCell>
                      <TableCell>{r.ticket_categories?.name || 'Any'}</TableCell>
                      <TableCell>{r.profiles?.full_name || 'Unassigned'}</TableCell>
                      <TableCell>{r.priority}</TableCell>
                      <TableCell>
                        <Badge variant={r.is_active ? 'default' : 'secondary'}>
                          {r.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this rule?')) {
                              deleteRule.mutate(r.id);
                            }
                          }}
                          disabled={deleteRule.isPending}
                        >
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

      {/* Add Assignment Modal */}
      <Dialog open={isAssignmentModalOpen} onOpenChange={setIsAssignmentModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Technician Unit Assignment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Technician *</Label>
              <select
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={assignmentForm.technician_id}
                onChange={e => setAssignmentForm({ ...assignmentForm, technician_id: e.target.value })}
              >
                <option value="">Select Technician...</option>
                {employees?.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.email_address})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Unit *</Label>
              <select
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={assignmentForm.unit_id}
                onChange={e => setAssignmentForm({ ...assignmentForm, unit_id: e.target.value })}
              >
                <option value="">Select Unit...</option>
                {units?.map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Assignment Type</Label>
              <select
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={assignmentForm.assignment_type}
                onChange={e => setAssignmentForm({ ...assignmentForm, assignment_type: e.target.value })}
              >
                <option value="Manual Assignment">Manual Assignment</option>
                <option value="Primary Handler">Primary Handler</option>
                <option value="Backup Handler">Backup Handler</option>
                <option value="Escalation Handler">Escalation Handler</option>
              </select>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Switch
                checked={assignmentForm.is_primary}
                onCheckedChange={c => setAssignmentForm({ ...assignmentForm, is_primary: c })}
              />
              <Label>Set as Primary Technician for this Unit</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignmentModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createAssignment.mutate(assignmentForm)}
              disabled={!assignmentForm.technician_id || !assignmentForm.unit_id || createAssignment.isPending}
            >
              {createAssignment.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : 'Save Assignment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Rule Modal */}
      <Dialog open={isRuleModalOpen} onOpenChange={setIsRuleModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Ticket Routing Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Unit *</Label>
              <select
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={ruleForm.unit_id}
                onChange={e => setRuleForm({ ...ruleForm, unit_id: e.target.value })}
              >
                <option value="">Select Unit...</option>
                {units?.map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Department (Optional)</Label>
              <select
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={ruleForm.department_id}
                onChange={e => setRuleForm({ ...ruleForm, department_id: e.target.value })}
              >
                <option value="">Any Department</option>
                {departments?.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Category (Optional)</Label>
              <select
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={ruleForm.category_id}
                onChange={e => setRuleForm({ ...ruleForm, category_id: e.target.value })}
              >
                <option value="">Any Category</option>
                {categories?.map((cat: any) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Assign To Technician *</Label>
              <select
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={ruleForm.technician_id}
                onChange={e => setRuleForm({ ...ruleForm, technician_id: e.target.value })}
              >
                <option value="">Select Technician...</option>
                {employees?.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.email_address})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Priority Level (Higher = More Precedent)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={ruleForm.priority}
                onChange={e => setRuleForm({ ...ruleForm, priority: Number(e.target.value) })}
              />
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Switch
                checked={ruleForm.is_active}
                onCheckedChange={c => setRuleForm({ ...ruleForm, is_active: c })}
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRuleModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createRule.mutate(ruleForm)}
              disabled={!ruleForm.unit_id || !ruleForm.technician_id || createRule.isPending}
            >
              {createRule.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : 'Save Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
