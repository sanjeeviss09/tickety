import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { Loader2, Search, Edit, ShieldAlert, Trash2, KeyRound, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { format } from 'date-fns';

export function UsersAccessSettings() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordStatusMsg, setPasswordStatusMsg] = useState<string | null>(null);
  const [passwordErrorMsg, setPasswordErrorMsg] = useState<string | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*, unit:units(id, name), department:departments(id, name), role:roles(id, name)')
          .order('full_name', { ascending: true });

        if (!error && data) return data;
      } catch (e) {
        console.warn('Direct fetch fallback to API:', e);
      }

      const res = await api.get('/employees');
      return res.data.data || [];
    },
    staleTime: 30000,
  });

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('roles')
          .select('*')
          .order('name', { ascending: true });

        if (!error && data) return data.filter((r: any) => r.name !== 'Assigner');
      } catch (e) {
        console.warn('Direct fetch fallback to API:', e);
      }

      const res = await api.get('/employees/roles');
      return (res.data.data || []).filter((r: any) => r.name !== 'Assigner');
    },
    staleTime: 60000,
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.put(`/employees/${selectedUser.id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setIsEditModalOpen(false);
      alert('User access updated successfully.');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to update user access');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await api.delete(`/employees/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      alert('User deleted successfully.');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to delete user');
    }
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ user, customPassword }: { user: any; customPassword?: string }) => {
      setPasswordStatusMsg(null);
      setPasswordErrorMsg(null);
      const trimmedPassword = customPassword?.trim();

      try {
        const res = await api.post(`/employees/${user.id}/reset-password`, {
          new_password: trimmedPassword || undefined,
        });
        return res.data;
      } catch (err: any) {
        // Fallback if backend route is still deploying: use /auth/first-login + clear last_login
        if (user.employee_id) {
          const tempOrCustom = trimmedPassword || `Reset_${Date.now()}_${Math.random().toString(36).slice(2)}Aa1!`;
          await api.post('/auth/first-login', {
            employee_id: user.employee_id,
            password: tempOrCustom,
          });
          if (!trimmedPassword) {
            await supabase.from('profiles').update({ last_login: null }).eq('id', user.id);
          }
          return {
            status: 'success',
            message: trimmedPassword
              ? `New password set for ${user.full_name} (${user.employee_id}).`
              : `Password reset for ${user.full_name} (${user.employee_id}). The user will be prompted to set a new password on their next login.`,
          };
        }
        throw err;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setNewPasswordInput('');
      setPasswordStatusMsg(
        data?.message || 'Password reset successfully. The user will be prompted to set a new password on next login.'
      );
    },
    onError: (err: any) => {
      setPasswordErrorMsg(err.response?.data?.message || err.message || 'Failed to reset password');
    },
  });

  const handleEditClick = (user: any) => {
    setSelectedUser({
      ...user,
      // role_id may come from direct column OR from the nested role.id
      role_id: user.role_id || user.role?.id || '',
      employment_status: user.employment_status || 'Active'
    });
    setNewPasswordInput('');
    setShowNewPassword(false);
    setPasswordStatusMsg(null);
    setPasswordErrorMsg(null);
    setIsEditModalOpen(true);
  };

  const handleSaveUser = () => {
    updateMutation.mutate({
      role_id: selectedUser.role_id,
      employment_status: selectedUser.employment_status
    });
  };

  // Filter users
  const filteredUsers = users?.filter((u: any) => {
    const name = u.full_name || '';
    const email = u.email_address || '';
    const empId = u.employee_id || '';

    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          empId.toLowerCase().includes(searchTerm.toLowerCase());
                          
    // API/Supabase returns role as nested object (role.name), or fallback to 'Employee'
    const roleName = u.role?.name || u.roles?.name || 'Employee';
    const matchesRole = roleFilter === 'all' || roleName === roleFilter;
    const matchesStatus = statusFilter === 'all' || u.employment_status === statusFilter;
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Users & Access Management</CardTitle>
          <CardDescription>
            Administer user accounts, assign system roles (Admin, Technician, Employee), and manage access status.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users by name, email, or ID..."
                className="pl-8"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-[180px]">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger><SelectValue placeholder="All Roles" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Technician">Technician</SelectItem>
                  <SelectItem value="Employee">Employee</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-[180px]">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder="All Statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="Suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="animate-spin h-6 w-6 mx-auto" /></TableCell></TableRow>
                ) : filteredUsers?.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No users found</TableCell></TableRow>
                ) : (
                  filteredUsers?.map((u: any) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="font-medium">{u.full_name}</div>
                        <div className="text-xs text-muted-foreground">{u.email_address} • {u.employee_id}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.role?.name === 'Admin' ? 'default' : u.role?.name === 'Technician' ? 'secondary' : 'outline'}>
                          {u.role?.name || u.roles?.name || 'Employee'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.employment_status === 'Active' ? 'success' : 'destructive' as any} className={u.employment_status === 'Active' ? 'bg-green-500' : ''}>
                          {u.employment_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.last_login ? format(new Date(u.last_login), 'PPp') : 'Never'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEditClick(u)}>
                            <Edit className="h-4 w-4 mr-2" /> Manage Access
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => {
                            if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
                              deleteMutation.mutate(u.id);
                            }
                          }}>
                            <Trash2 className="h-4 w-4 mr-2" /> Remove
                          </Button>
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

      {/* Edit Access Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Access: {selectedUser?.full_name}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-slate-50 p-3 rounded text-sm border space-y-1">
              <p><strong>Email:</strong> {selectedUser?.email_address}</p>
              <p><strong>Employee ID:</strong> {selectedUser?.employee_id}</p>
            </div>

            <div className="space-y-2">
              <Label>System Role</Label>
              <Select 
                value={selectedUser?.role_id || ''} 
                onValueChange={v => setSelectedUser({...selectedUser, role_id: v})}
              >
                <SelectTrigger><SelectValue placeholder="Select Role" /></SelectTrigger>
                <SelectContent>
                  {roles?.map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Admins have full access. Technicians can manage tickets and assets. Employees can only access Help Center.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Account Status</Label>
              <Select 
                value={selectedUser?.employment_status || 'Active'} 
                onValueChange={v => setSelectedUser({...selectedUser, employment_status: v})}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="Suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedUser?.employment_status !== 'Active' && (
              <div className="p-3 bg-destructive/10 text-destructive text-sm rounded flex items-start gap-2 mt-4">
                <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                <p>This user will be unable to log into DeskPulse while their status is {selectedUser?.employment_status}. Active sessions will not be immediately terminated unless forced.</p>
              </div>
            )}

            {/* Password Reset Section */}
            <div className="border-t pt-4 mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="flex items-center gap-1.5 text-sm font-semibold">
                    <KeyRound className="h-4 w-4 text-primary" /> Password Reset
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Reset this user's password so they are prompted to create a new password on their next login, or set one directly below.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full justify-center gap-2 border-amber-300 bg-amber-50/60 hover:bg-amber-100/70 text-amber-900 font-medium"
                disabled={resetPasswordMutation.isPending}
                onClick={() => {
                  if (!selectedUser) return;
                  resetPasswordMutation.mutate({ user: selectedUser });
                }}
              >
                {resetPasswordMutation.isPending && !newPasswordInput.trim() ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="h-4 w-4 text-amber-700" />
                )}
                Reset Password (User Sets New Password on Login)
              </Button>

              <div className="space-y-1.5 pt-1">
                <Label className="text-xs text-muted-foreground">Or set a new password directly (min 5 characters)</Label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="Enter new password for user..."
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      className="pr-9 h-9 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-9 shrink-0"
                    disabled={resetPasswordMutation.isPending || newPasswordInput.trim().length < 5}
                    onClick={() => {
                      if (!selectedUser || newPasswordInput.trim().length < 5) return;
                      resetPasswordMutation.mutate({
                        user: selectedUser,
                        customPassword: newPasswordInput.trim(),
                      });
                    }}
                  >
                    {resetPasswordMutation.isPending && newPasswordInput.trim().length >= 5 ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Set Password'
                    )}
                  </Button>
                </div>
              </div>

              {passwordStatusMsg && (
                <div className="p-2.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{passwordStatusMsg}</span>
                </div>
              )}

              {passwordErrorMsg && (
                <div className="p-2.5 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs">
                  {passwordErrorMsg}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveUser} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : 'Save Access Settings'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
