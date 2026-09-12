import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import api from '@/lib/api';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2 } from 'lucide-react';

const employeeSchema = z.object({
  employee_id: z.string().min(1, 'Employee ID is required'),
  full_name: z.string().min(1, 'Full Name is required'),
  email_address: z.string().email('Invalid email address'),
  mobile_number: z.string().optional(),
  designation: z.string().optional(),
  unit_id: z.string().uuid('Please select a unit').optional().or(z.literal('')),
  department_id: z.string().uuid('Please select a department').optional().or(z.literal('')),
  location: z.string().optional(),
  joining_date: z.string().optional(),
  employment_status: z.enum(['Active', 'Inactive', 'Suspended']).default('Active'),
  reporting_manager_id: z.string().uuid('Invalid Manager ID').optional().or(z.literal('')),
  role_id: z.string().uuid('Please select a role').optional().or(z.literal('')),
});

type EmployeeFormValues = z.infer<typeof employeeSchema>;

export function AddEmployeeForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: units = [] } = useQuery({
    queryKey: ['units'],
    queryFn: async () => {
      const { data } = await supabase.from('units').select('*').order('name');
      return data || [];
    }
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data } = await supabase.from('departments').select('*').order('name');
      return data || [];
    }
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const { data } = await supabase.from('roles').select('*').order('name');
      return data || [];
    }
  });

  const { data: managers = [] } = useQuery({
    queryKey: ['managers'],
    queryFn: async () => {
      const res = await api.get('/employees');
      return res.data.data;
    }
  });

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema) as any,
    defaultValues: {
      employee_id: '',
      full_name: '',
      email_address: '',
      mobile_number: '',
      designation: '',
      unit_id: '',
      department_id: '',
      location: '',
      joining_date: '',
      employment_status: 'Active',
      reporting_manager_id: '',
      role_id: ''
    },
  });

  const createEmployeeMutation = useMutation({
    mutationFn: async (data: EmployeeFormValues) => {
      const payload = {
        ...data,
        unit_id: data.unit_id || null,
        department_id: data.department_id || null,
        reporting_manager_id: data.reporting_manager_id || null,
        role_id: data.role_id || null
      };
      await api.post('/employees', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      navigate('/directory');
    },
    onError: (error) => {
      console.error('Failed to create employee:', error);
    }
  });

  const onSubmit = (data: EmployeeFormValues) => {
    createEmployeeMutation.mutate(data);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" onClick={() => navigate('/directory')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Directory
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Add Employee</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Employee Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <FormField control={form.control as any} name="employee_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee ID *</FormLabel>
                    <FormControl><Input placeholder="EMP-001" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control as any} name="full_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name *</FormLabel>
                    <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control as any} name="email_address" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address *</FormLabel>
                    <FormControl><Input type="email" placeholder="john@example.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control as any} name="mobile_number" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mobile Number</FormLabel>
                    <FormControl><Input placeholder="+1 234 567 8900" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control as any} name="designation" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Designation</FormLabel>
                    <FormControl><Input placeholder="Software Engineer" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control as any} name="location" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl><Input placeholder="New York" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control as any} name="unit_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select Unit" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {units.length === 0 ? <SelectItem value="none" disabled>No units found</SelectItem> : units.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control as any} name="department_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select Department" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {departments.length === 0 ? <SelectItem value="none" disabled>No departments found</SelectItem> : departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control as any} name="employment_status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select Status" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                        <SelectItem value="Suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control as any} name="joining_date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Joining Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control as any} name="reporting_manager_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reporting Manager</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select Manager" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {managers.length === 0 ? <SelectItem value="none" disabled>No managers found</SelectItem> : managers.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.full_name} ({m.employee_id})</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control as any} name="role_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role (Employee / Technician / Admin)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select System Role" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {roles.length === 0 ? <SelectItem value="none" disabled>No roles found</SelectItem> : roles.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name} - {r.description}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

              </div>

              <div className="flex justify-end space-x-4 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => navigate('/directory')}>Cancel</Button>
                <Button type="submit" disabled={createEmployeeMutation.isPending || form.formState.isSubmitting}>
                  {createEmployeeMutation.isPending || form.formState.isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Create Employee'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
