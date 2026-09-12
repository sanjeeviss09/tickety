import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, User, Mail, Phone, MapPin, Briefcase, Calendar, ShieldAlert, Edit, Trash2, MoreHorizontal } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuthStore } from '../../store/authStore';
import { useState } from 'react';
import { AddEmployeeModal } from './AddEmployeeModal';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export function EmployeeProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { profile } = useAuthStore();
  
  const userRole = profile?.roles?.name || profile?.roles?.[0]?.name || profile?.role?.name || profile?.role;
  const isStaffAdmin = userRole === 'Admin' || userRole === 'Super Admin';

  const { data: employee, isLoading, error } = useQuery({
    queryKey: ['employee', id],
    queryFn: async () => {
      if (!id) return null;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*, unit:units(id, name), department:departments(id, name), role:roles(id, name), manager:profiles!reporting_manager_id(id, full_name)')
          .or(`id.eq.${id},auth_user_id.eq.${id},employee_id.eq.${id}`)
          .maybeSingle();

        if (!error && data) return data;
      } catch (e) {
        console.warn('Direct fetch error, falling back to API:', e);
      }

      const res = await api.get(`/employees/${id}`);
      return res.data.data;
    },
    enabled: !!id,
    staleTime: 30000,
  });

  const { data: assignedAssets = [] } = useQuery({
    queryKey: ['employee-assets', id],
    queryFn: async () => {
      if (!id) return [];
      try {
        const { data: assignments } = await supabase
          .from('asset_assignments')
          .select('asset_id')
          .or(`assigned_to.eq.${id}`)
          .eq('status', 'Active');

        if (assignments && assignments.length > 0) {
          const assetIds = assignments.map(a => a.asset_id);
          const { data: assets } = await supabase
            .from('assets')
            .select('*, category:asset_categories(name)')
            .in('id', assetIds);
          if (assets) return assets;
        }
      } catch (e) {}

      const res = await api.get(`/assets?assigned_to=${id}`);
      return res.data.data || [];
    },
    enabled: !!id,
    staleTime: 30000,
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ['employee-tickets', id],
    queryFn: async () => {
      if (!id) return [];
      try {
        const { data } = await supabase
          .from('tickets')
          .select('*')
          .or(`created_by.eq.${id}`)
          .order('created_at', { ascending: false });
        if (data) return data;
      } catch (e) {}

      const res = await api.get(`/tickets?created_by=${id}`);
      return res.data.data || [];
    },
    enabled: !!id,
    staleTime: 30000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (empId: string) => {
      await api.delete(`/employees/${empId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      navigate('/directory');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to delete employee');
    }
  });

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this employee?')) {
      if (employee) deleteMutation.mutate(employee.id);
    }
  };

  if (isLoading) return <div>Loading Profile...</div>;
  if (error || !employee) return <div className="text-destructive">Failed to load profile.</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" asChild>
            <Link to="/directory">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Directory
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Employee Profile</h1>
        </div>
        {isStaffAdmin && (
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={() => setIsModalOpen(true)}>
              <Edit className="mr-2 h-4 w-4" /> Edit
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Basic Info */}
        <Card className="md:col-span-1">
          <CardContent className="pt-6 text-center">
            <Avatar className="h-32 w-32 mx-auto mb-4 border">
              <AvatarImage src={employee.profile_picture_url} alt={employee.full_name} />
              <AvatarFallback className="text-4xl bg-primary/10 text-primary">
                {employee.full_name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <h2 className="text-2xl font-bold">{employee.full_name}</h2>
            <p className="text-muted-foreground font-medium mb-2">{employee.designation || 'No Designation'}</p>
            <Badge 
              variant={
                employee.employment_status === 'Active' ? 'default' : 
                employee.employment_status === 'Inactive' ? 'secondary' : 'destructive'
              }
              className="mb-4"
            >
              {employee.employment_status}
            </Badge>

            <div className="space-y-4 text-sm text-left mt-6 border-t pt-6">
              <div className="flex items-center text-muted-foreground">
                <User className="mr-2 h-4 w-4" />
                <span className="font-medium text-foreground mr-2">ID:</span> {employee.employee_id}
              </div>
              <div className="flex items-center text-muted-foreground">
                <Mail className="mr-2 h-4 w-4" />
                <a href={`mailto:${employee.email_address}`} className="hover:underline">{employee.email_address}</a>
              </div>
              <div className="flex items-center text-muted-foreground">
                <Phone className="mr-2 h-4 w-4" />
                {employee.mobile_number || 'N/A'}
              </div>
              <div className="flex items-center text-muted-foreground">
                <MapPin className="mr-2 h-4 w-4" />
                {employee.location || 'N/A'}
              </div>
              <div className="flex items-center text-muted-foreground">
                <Briefcase className="mr-2 h-4 w-4" />
                <span className="font-medium text-foreground mr-2">Dept:</span> {employee.department?.name || 'N/A'}
              </div>
              <div className="flex items-center text-muted-foreground">
                <Calendar className="mr-2 h-4 w-4" />
                <span className="font-medium text-foreground mr-2">Joined:</span> {employee.joining_date ? new Date(employee.joining_date).toLocaleDateString() : 'N/A'}
              </div>
              {employee.manager && (
                <div className="flex items-center text-muted-foreground mt-4 pt-4 border-t">
                  <ShieldAlert className="mr-2 h-4 w-4" />
                  <span className="font-medium text-foreground mr-2">Manager:</span>
                  <Link to={`/directory/${employee.manager.id}`} className="text-primary hover:underline">
                    {employee.manager.full_name}
                  </Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Tabs */}
        <div className="md:col-span-2">
          <Tabs defaultValue="assets" className="w-full">
            <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent mb-6">
              <TabsTrigger value="assets" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
                Assigned Assets ({assignedAssets.length})
              </TabsTrigger>
              <TabsTrigger value="tickets" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
                Ticket History ({tickets.length})
              </TabsTrigger>
              <TabsTrigger value="history" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
                Activity History
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="assets">
              <Card>
                <CardHeader>
                  <CardTitle>Assigned Assets</CardTitle>
                </CardHeader>
                <CardContent>
                  {assignedAssets.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No assets currently assigned.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Asset Name</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {assignedAssets.map((asset: any) => (
                          <TableRow key={asset.id}>
                            <TableCell className="font-medium">
                              <Link to={`/assets/${asset.id}`} className="text-primary hover:underline">
                                {asset.asset_code}
                              </Link>
                            </TableCell>
                            <TableCell>{asset.name}</TableCell>
                            <TableCell>{asset.category?.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{asset.status}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tickets">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Tickets</CardTitle>
                </CardHeader>
                <CardContent>
                  {tickets.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No tickets created by this employee.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ticket ID</TableHead>
                          <TableHead>Subject</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tickets.slice(0, 10).map((ticket: any) => (
                          <TableRow key={ticket.id}>
                            <TableCell className="font-medium">
                              <Link to={`/tickets/${ticket.id}`} className="text-primary hover:underline">
                                TKT-{ticket.ticket_number}
                              </Link>
                            </TableCell>
                            <TableCell className="truncate max-w-[200px]">{ticket.title}</TableCell>
                            <TableCell>
                              <Badge variant={ticket.status === 'Resolved' || ticket.status === 'Closed' ? 'secondary' : 'default'}>
                                {ticket.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{new Date(ticket.created_at).toLocaleDateString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle>Activity History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    Audit log history for this employee will be displayed here.
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      
      {employee && (
        <AddEmployeeModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          defaultRoleName={employee.role?.name || 'Employee'}
          employeeToEdit={employee}
        />
      )}
    </div>
  );
}
