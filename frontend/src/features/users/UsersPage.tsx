import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function UsersPage() {
  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/users');
      return response.data.data;
    },
  });

  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    employee_id: '',
    full_name: '',
    mobile_number: '',
    role_id: 'a947c0b6-1234-4567-8901-d7f8e9a0b1c2', // Dummy UUID for now
    unit_id: 'a947c0b6-1234-4567-8901-d7f8e9a0b1c2',
    department_id: 'a947c0b6-1234-4567-8901-d7f8e9a0b1c2',
    employment_status: 'Active'
  });

  if (isLoading) return <div>Loading users...</div>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/users', formData);
      setIsOpen(false);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Users</h1>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <Input placeholder="Employee ID" value={formData.employee_id} onChange={(e) => setFormData({...formData, employee_id: e.target.value})} required />
              <Input placeholder="Full Name" value={formData.full_name} onChange={(e) => setFormData({...formData, full_name: e.target.value})} required />
              <Input placeholder="Mobile Number" value={formData.mobile_number} onChange={(e) => setFormData({...formData, mobile_number: e.target.value})} />
              <Button type="submit" className="w-full">Create User</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Directory</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((user: any) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.full_name}</TableCell>
                  <TableCell>{user.email_address}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{user.roles?.name || 'N/A'}</Badge>
                  </TableCell>
                  <TableCell>{user.units?.name || 'N/A'}</TableCell>
                  <TableCell>{user.departments?.name || 'N/A'}</TableCell>
                  <TableCell>
                    <Badge variant={user.employment_status === 'Active' ? 'default' : 'secondary'}>
                      {user.employment_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="icon">
                      <Edit className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
