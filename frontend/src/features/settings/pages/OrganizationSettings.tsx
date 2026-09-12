import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { Loader2, Plus, Edit, AlertCircle, Building2, Layers, Trash2 } from 'lucide-react';

export function OrganizationSettings() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('units');

  const { data: units, isLoading: loadingUnits } = useQuery({
    queryKey: ['units'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('units')
          .select('*')
          .order('name', { ascending: true });
        if (!error && data) return data;
      } catch (e) {}

      const res = await api.get('/units');
      return res.data.data || [];
    },
    staleTime: 30000,
  });

  const { data: departments, isLoading: loadingDepts } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('departments')
          .select('*, units(name)')
          .order('name', { ascending: true });
        if (!error && data) return data;
      } catch (e) {}

      const res = await api.get('/departments');
      return res.data.data || [];
    },
    staleTime: 30000,
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Organization Settings</CardTitle>
          <CardDescription>
            Manage company business units and departments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList>
              <TabsTrigger value="units" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" /> Business Units
              </TabsTrigger>
              <TabsTrigger value="departments" className="flex items-center gap-2">
                <Layers className="h-4 w-4" /> Departments
              </TabsTrigger>
            </TabsList>

            <TabsContent value="units">
              <UnitsManager units={units} loading={loadingUnits} queryClient={queryClient} />
            </TabsContent>

            <TabsContent value="departments">
              <DepartmentsManager departments={departments} units={units} loading={loadingDepts} queryClient={queryClient} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function UnitsManager({ units, loading, queryClient }: any) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<any>(null);
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingUnit) {
        return await api.put(`/units/${editingUnit.id}`, payload);
      } else {
        return await api.post('/units', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      setIsModalOpen(false);
      alert(`Unit ${editingUnit ? 'updated' : 'created'} successfully`);
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to save unit');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await api.delete(`/units/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      alert('Unit deleted successfully');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to delete unit');
    }
  });

  const handleSave = () => {
    mutation.mutate({ name, is_active: isActive });
  };

  const openModal = (unit?: any) => {
    if (unit) {
      setEditingUnit(unit);
      setName(unit.name);
      setIsActive(unit.is_active);
    } else {
      setEditingUnit(null);
      setName('');
      setIsActive(true);
    }
    setIsModalOpen(true);
  };

  if (loading) return <div className="p-4 flex justify-center"><Loader2 className="animate-spin h-6 w-6" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Manage Units</h3>
        <Button onClick={() => openModal()}><Plus className="h-4 w-4 mr-2" /> Add Unit</Button>
      </div>
      
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unit Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {units?.length === 0 && (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No units found</TableCell></TableRow>
            )}
            {units?.map((u: any) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell>
                  <Badge variant={u.is_active ? 'default' : 'secondary'}>{u.is_active ? 'Active' : 'Inactive'}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openModal(u)}>
                      <Edit className="h-4 w-4 mr-2" /> Edit
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => {
                      if (window.confirm('Are you sure you want to delete this unit?')) {
                        deleteMutation.mutate(u.id);
                      }
                    }}>
                      <Trash2 className="h-4 w-4 mr-2" /> Remove
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUnit ? 'Edit Unit' : 'Create Unit'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Unit Name *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Corporate" />
            </div>
            {editingUnit && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={isActive ? 'active' : 'inactive'} onValueChange={v => setIsActive(v === 'active')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" /> Deactivating prevents new assignments but preserves history.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!name || mutation.isPending}>
              {mutation.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DepartmentsManager({ departments, units, loading, queryClient }: any) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<any>(null);
  const [name, setName] = useState('');
  const [unitId, setUnitId] = useState('');
  const [isActive, setIsActive] = useState(true);

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingDept) {
        return await api.put(`/departments/${editingDept.id}`, payload);
      } else {
        return await api.post('/departments', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setIsModalOpen(false);
      alert(`Department ${editingDept ? 'updated' : 'created'} successfully`);
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to save department');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await api.delete(`/departments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      alert('Department deleted successfully');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to delete department');
    }
  });

  const handleSave = () => {
    mutation.mutate({ name, unit_id: unitId || null, is_active: isActive });
  };

  const openModal = (dept?: any) => {
    if (dept) {
      setEditingDept(dept);
      setName(dept.name);
      setUnitId(dept.unit_id || '');
      setIsActive(dept.is_active);
    } else {
      setEditingDept(null);
      setName('');
      setUnitId('');
      setIsActive(true);
    }
    setIsModalOpen(true);
  };

  if (loading) return <div className="p-4 flex justify-center"><Loader2 className="animate-spin h-6 w-6" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Manage Departments</h3>
        <Button onClick={() => openModal()}><Plus className="h-4 w-4 mr-2" /> Add Department</Button>
      </div>
      
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Department Name</TableHead>
              <TableHead>Parent Unit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {departments?.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No departments found</TableCell></TableRow>
            )}
            {departments?.map((d: any) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell>{d.units?.name || '-'}</TableCell>
                <TableCell>
                  <Badge variant={d.is_active ? 'default' : 'secondary'}>{d.is_active ? 'Active' : 'Inactive'}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openModal(d)}>
                      <Edit className="h-4 w-4 mr-2" /> Edit
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => {
                      if (window.confirm('Are you sure you want to delete this department?')) {
                        deleteMutation.mutate(d.id);
                      }
                    }}>
                      <Trash2 className="h-4 w-4 mr-2" /> Remove
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDept ? 'Edit Department' : 'Create Department'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Department Name *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. IT Support" />
            </div>
            <div className="space-y-2">
              <Label>Parent Unit</Label>
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger><SelectValue placeholder="Select Unit (Optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {units?.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editingDept && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={isActive ? 'active' : 'inactive'} onValueChange={v => setIsActive(v === 'active')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" /> Deactivating prevents new assignments but preserves history.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!name || mutation.isPending}>
              {mutation.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
