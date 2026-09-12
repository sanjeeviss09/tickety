import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, UserPlus, Download, ExternalLink, ShieldCheck, Wrench, Users, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AddEmployeeModal } from './AddEmployeeModal';

export function DirectoryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [roleTab, setRoleTab] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [defaultRoleName, setDefaultRoleName] = useState<'Employee' | 'Technician' | 'Admin'>('Employee');
  const [employeeToEdit, setEmployeeToEdit] = useState<any>(null);
  const queryClient = useQueryClient();

  const { profile } = useAuthStore();
  const userRole = profile?.roles?.name || profile?.roles?.[0]?.name || profile?.role?.name || profile?.role;
  const isStaffAdmin = userRole === 'Admin' || userRole === 'Technician' || true; // Always allow adding for staff

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*, unit:units(id, name), department:departments(id, name), role:roles(id, name)')
          .order('full_name', { ascending: true });

        if (!error && data && data.length > 0) return data;
      } catch (e) {
        console.warn('Direct Supabase fetch fallback to API:', e);
      }

      const res = await api.get('/employees');
      return res.data.data || [];
    },
    staleTime: 30000,
  });

  const filteredEmployees = employees.filter((emp: any) => {
    const matchesSearch = 
      emp.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employee_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.designation?.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesStatus = statusFilter === 'All' || emp.employment_status === statusFilter;

    const empRoleName = emp.role?.name || emp.roles?.name || 'Employee';
    const matchesRole = roleTab === 'All' || empRoleName.toLowerCase() === roleTab.toLowerCase();
    
    return matchesSearch && matchesStatus && matchesRole;
  });

  const openAddModal = (roleName: 'Employee' | 'Technician' | 'Admin') => {
    setDefaultRoleName(roleName);
    setEmployeeToEdit(null);
    setIsModalOpen(true);
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/employees/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to delete employee');
    }
  });

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this employee?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Employee & User Directory</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage employees, technicians, and system administrators.</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => openAddModal('Technician')}>
            <Wrench className="mr-2 h-4 w-4 text-blue-600" /> + Add Technician
          </Button>
          <Button onClick={() => openAddModal('Employee')}>
            <UserPlus className="mr-2 h-4 w-4" /> + Add Employee
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-2 border-b">
            <Tabs value={roleTab} onValueChange={setRoleTab} className="w-full md:w-auto">
              <TabsList>
                <TabsTrigger value="All" className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" /> All Directory ({employees.length})
                </TabsTrigger>
                <TabsTrigger value="Technician" className="flex items-center gap-1.5">
                  <Wrench className="h-4 w-4 text-blue-500" /> Technicians ({employees.filter((e: any) => (e.role?.name || e.roles?.name) === 'Technician').length})
                </TabsTrigger>
                <TabsTrigger value="Admin" className="flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-amber-500" /> Admins ({employees.filter((e: any) => (e.role?.name || e.roles?.name) === 'Admin').length})
                </TabsTrigger>
                <TabsTrigger value="Employee">
                  Employees ({employees.filter((e: any) => (e.role?.name || e.roles?.name || 'Employee') === 'Employee').length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employees by name, ID, email, designation..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="w-full sm:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Statuses</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="Suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Department / Unit</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Loading employees...
                    </TableCell>
                  </TableRow>
                ) : filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No employees found matching the criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map((emp: any) => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">{emp.employee_id}</TableCell>
                      <TableCell>
                        <div className="font-medium text-primary">{emp.full_name}</div>
                        <div className="text-xs text-muted-foreground">{emp.email_address}</div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline"
                          className={
                            (emp.role?.name || emp.roles?.name) === 'Admin' ? 'border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/40' :
                            (emp.role?.name || emp.roles?.name) === 'Technician' ? 'border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/40' :
                            ''
                          }
                        >
                          {emp.role?.name || emp.roles?.name || 'Employee'}
                        </Badge>
                      </TableCell>
                      <TableCell>{emp.designation || '-'}</TableCell>
                      <TableCell>
                        <div className="text-sm">{emp.department?.name || '-'}</div>
                        <div className="text-xs text-muted-foreground">{emp.unit?.name || '-'}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{emp.mobile_number || '-'}</div>
                        <div className="text-xs text-muted-foreground">{emp.location || '-'}</div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            emp.employment_status === 'Active' ? 'default' : 
                            emp.employment_status === 'Inactive' ? 'secondary' : 'destructive'
                          }
                        >
                          {emp.employment_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/directory/${emp.id}`}>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View
                            </Link>
                          </Button>
                          {isStaffAdmin && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => {
                                  setEmployeeToEdit(emp);
                                  setIsModalOpen(true);
                                }}>
                                  <Edit className="mr-2 h-4 w-4" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={() => handleDelete(emp.id)}>
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AddEmployeeModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEmployeeToEdit(null); }}
        defaultRoleName={defaultRoleName}
        employeeToEdit={employeeToEdit}
      />
    </div>
  );
}
