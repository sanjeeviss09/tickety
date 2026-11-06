import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import api from '@/lib/api';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2, UserPlus, Check } from 'lucide-react';

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
      return (data || []).filter(r => r.name !== 'Assigner');
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
    <div className="w-full max-w-6xl mx-auto space-y-3.5 animate-in fade-in duration-200">
      {/* Top action header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/directory')} className="h-8 px-2 text-xs">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Directory
          </Button>
          <div className="h-4 w-px bg-border hidden sm:block" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Add Employee</h1>
            <p className="text-xs text-muted-foreground hidden sm:block">Register a new employee, technician, or administrator</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs px-3" onClick={() => navigate('/directory')}>
            Cancel
          </Button>
          <Button 
            type="button" 
            size="sm" 
            className="h-8 text-xs px-4"
            onClick={form.handleSubmit(onSubmit)}
            disabled={createEmployeeMutation.isPending || form.formState.isSubmitting}
          >
            {createEmployeeMutation.isPending || form.formState.isSubmitting ? (
              <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving...</>
            ) : (
              <><Check className="mr-1.5 h-3.5 w-3.5" /> Create Employee</>
            )}
          </Button>
        </div>
      </div>

      <Card className="shadow-sm border-border/80">
        <CardHeader className="py-2.5 px-5 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" /> Employee Details
            </CardTitle>
            <span className="text-xs font-normal text-muted-foreground">
              Fields with <span className="text-destructive font-semibold">*</span> are required
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-3">
                
                {/* Row 1: Core Identification */}
                <FormField control={form.control as any} name="employee_id" render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs font-semibold">Employee ID *</FormLabel>
                    <FormControl><Input placeholder="e.g. EMP-001" className="h-8.5 text-xs" {...field} /></FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )} />

                <FormField control={form.control as any} name="full_name" render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs font-semibold">Full Name *</FormLabel>
                    <FormControl><Input placeholder="e.g. John Doe" className="h-8.5 text-xs" {...field} /></FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )} />

                <FormField control={form.control as any} name="email_address" render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs font-semibold">Email Address *</FormLabel>
                    <FormControl><Input type="email" placeholder="john@example.com" className="h-8.5 text-xs" {...field} /></FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )} />

                <FormField control={form.control as any} name="mobile_number" render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs font-semibold">Mobile Number</FormLabel>
                    <FormControl><Input placeholder="+1 234 567 8900" className="h-8.5 text-xs" {...field} /></FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )} />

                {/* Row 2: Role, Designation, Unit, Department */}
                <FormField control={form.control as any} name="role_id" render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs font-semibold">Role (Employee / Technician / Admin)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl><SelectTrigger className="h-8.5 text-xs"><SelectValue placeholder="Select System Role" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {roles.length === 0 ? <SelectItem value="none" disabled>No roles found</SelectItem> : roles.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name} - {r.description}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )} />

                <FormField control={form.control as any} name="designation" render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs font-semibold">Designation</FormLabel>
                    <FormControl><Input placeholder="e.g. Software Engineer" className="h-8.5 text-xs" {...field} /></FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )} />

                <FormField control={form.control as any} name="unit_id" render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs font-semibold">Unit</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl><SelectTrigger className="h-8.5 text-xs"><SelectValue placeholder="Select Unit" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {units.length === 0 ? <SelectItem value="none" disabled>No units found</SelectItem> : units.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )} />

                <FormField control={form.control as any} name="department_id" render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs font-semibold">Department</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl><SelectTrigger className="h-8.5 text-xs"><SelectValue placeholder="Select Department" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {departments.length === 0 ? <SelectItem value="none" disabled>No departments found</SelectItem> : departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )} />

                {/* Row 3: Location, Manager, Joining Date, Status */}
                <FormField control={form.control as any} name="location" render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs font-semibold">Location</FormLabel>
                    <FormControl><Input placeholder="e.g. New York / Floor 3" className="h-8.5 text-xs" {...field} /></FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )} />

                <FormField control={form.control as any} name="reporting_manager_id" render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs font-semibold">Reporting Manager</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl><SelectTrigger className="h-8.5 text-xs"><SelectValue placeholder="Select Manager" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {managers.length === 0 ? <SelectItem value="none" disabled>No managers found</SelectItem> : managers.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.full_name} ({m.employee_id})</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )} />

                <FormField control={form.control as any} name="joining_date" render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs font-semibold">Joining Date</FormLabel>
                    <FormControl><Input type="date" className="h-8.5 text-xs" {...field} /></FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )} />

                <FormField control={form.control as any} name="employment_status" render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs font-semibold">Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger className="h-8.5 text-xs"><SelectValue placeholder="Select Status" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                        <SelectItem value="Suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )} />

              </div>

              {/* Bottom action bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t">
                <p className="text-xs text-muted-foreground hidden sm:block">
                  New accounts are immediately linked to the organization directory and ticket routing.
                </p>
                <div className="flex items-center space-x-2 ml-auto">
                  <Button type="button" variant="outline" size="sm" className="h-8 text-xs px-3" onClick={() => navigate('/directory')}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    size="sm" 
                    className="h-8 text-xs px-4"
                    disabled={createEmployeeMutation.isPending || form.formState.isSubmitting}
                  >
                    {createEmployeeMutation.isPending || form.formState.isSubmitting ? (
                      <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving...</>
                    ) : (
                      <><Check className="mr-1.5 h-3.5 w-3.5" /> Create Employee</>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

