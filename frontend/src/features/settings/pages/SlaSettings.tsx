import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Clock, Plus, AlertTriangle, ShieldCheck, Activity } from 'lucide-react';
import api from '@/lib/api';
import { SlaPolicyForm } from '../components/SlaPolicyForm';

export function SlaSettings() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<any>(null);

  const { data: response, isLoading } = useQuery({
    queryKey: ['sla_policies'],
    queryFn: async () => {
      const res = await api.get('/sla/policies');
      return res.data;
    }
  });

  const policies = response?.data || [];

  const handleCreate = () => {
    setEditingPolicy(null);
    setIsFormOpen(true);
  };

  const handleEdit = (policy: any) => {
    setEditingPolicy(policy);
    setIsFormOpen(true);
  };

  if (isFormOpen) {
    return <SlaPolicyForm policy={editingPolicy} onBack={() => setIsFormOpen(false)} />;
  }

  return (
    <div className="space-y-6">
      {/* Overview Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center space-x-4">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-full">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Policies</p>
              <h4 className="text-2xl font-bold">{policies.filter((p: any) => p.is_active).length}</h4>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center space-x-4">
            <div className="p-3 bg-green-100 text-green-600 rounded-full">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">SLA Compliance</p>
              <h4 className="text-2xl font-bold">--%</h4>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center space-x-4">
            <div className="p-3 bg-amber-100 text-amber-600 rounded-full">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">At Risk Tickets</p>
              <h4 className="text-2xl font-bold">--</h4>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center space-x-4">
            <div className="p-3 bg-red-100 text-red-600 rounded-full">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Breached Tickets</p>
              <h4 className="text-2xl font-bold">--</h4>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>SLA Policies</CardTitle>
            <CardDescription>Manage SLA configurations for different combinations of Unit, Category, and Priority.</CardDescription>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" /> Add Policy
          </Button>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Policy Name</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>First Response</TableHead>
                  <TableHead>Resolution</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8">Loading policies...</TableCell></TableRow>
                ) : policies.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No SLA policies configured.</TableCell></TableRow>
                ) : (
                  policies.map((policy: any) => (
                    <TableRow key={policy.id}>
                      <TableCell className="font-medium">
                        {policy.name}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-muted-foreground">
                          <div>Unit: {policy.unit_id ? 'Specific' : 'All Units'}</div>
                          <div>Cat: {policy.category_id ? 'Specific' : 'All Categories'}</div>
                          <div>Pri: {policy.priority || 'All Priorities'}</div>
                        </div>
                      </TableCell>
                      <TableCell>{policy.first_response_hours} hrs</TableCell>
                      <TableCell>{policy.resolution_hours} hrs</TableCell>
                      <TableCell>
                        <Badge variant={policy.is_active ? 'default' : 'secondary'}>
                          {policy.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(policy)}>Edit</Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
