import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { ArrowLeft, Plus, Trash2, AlertTriangle } from 'lucide-react';
import api from '@/lib/api';

const ruleSchema = z.object({
  threshold_percent: z.coerce.number().min(1).max(200),
  recipient_type: z.enum(['Role', 'User', 'Manager']),
  recipient_id: z.string().optional(),
  action: z.string().default('Notify')
});

const slaPolicySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  unit_id: z.string().optional().nullable(),
  category_id: z.string().optional().nullable(),
  priority: z.string().optional().nullable(),
  first_response_hours: z.coerce.number().min(0.1),
  resolution_hours: z.coerce.number().min(0.1),
  warning_threshold_percent: z.coerce.number().min(1).max(100),
  critical_threshold_percent: z.coerce.number().min(1).max(100),
  business_hours_id: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
  escalation_rules: z.array(ruleSchema)
});

type SlaPolicyFormProps = {
  policy?: any;
  onBack: () => void;
};

export function SlaPolicyForm({ policy, onBack }: SlaPolicyFormProps) {
  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: unitsRes } = useQuery({ queryKey: ['units'], queryFn: () => api.get('/units') });
  const { data: categoriesRes } = useQuery({ queryKey: ['categories'], queryFn: () => api.get('/categories') });
  const { data: bhRes } = useQuery({ queryKey: ['business-hours'], queryFn: () => api.get('/sla/business-hours') });
  const { data: rolesRes } = useQuery({ queryKey: ['roles'], queryFn: () => api.get('/users/roles') });

  const units = unitsRes?.data?.data || [];
  const categories = categoriesRes?.data?.data || [];
  const businessHours = bhRes?.data?.data || [];
  const roles = rolesRes?.data?.data || [];

  const form = useForm<z.infer<typeof slaPolicySchema>>({
    resolver: zodResolver(slaPolicySchema) as any,
    defaultValues: {
      name: policy?.name || '',
      description: policy?.description || '',
      unit_id: policy?.unit_id || '',
      category_id: policy?.category_id || '',
      priority: policy?.priority || '',
      first_response_hours: policy?.first_response_hours || 4,
      resolution_hours: policy?.resolution_hours || 24,
      warning_threshold_percent: policy?.warning_threshold_percent || 75,
      critical_threshold_percent: policy?.critical_threshold_percent || 90,
      business_hours_id: policy?.business_hours_id || '',
      is_active: policy?.is_active ?? true,
      escalation_rules: policy?.sla_escalation_rules || []
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "escalation_rules"
  });

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof slaPolicySchema>) => {
      const payload = {
        ...values,
        unit_id: values.unit_id === 'all' || !values.unit_id ? null : values.unit_id,
        category_id: values.category_id === 'all' || !values.category_id ? null : values.category_id,
        priority: values.priority === 'all' || !values.priority ? null : values.priority,
        business_hours_id: values.business_hours_id === 'all' || !values.business_hours_id ? null : values.business_hours_id,
      };

      if (policy?.id) {
        return api.put(`/sla/policies/${policy.id}`, payload);
      } else {
        return api.post('/sla/policies', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sla_policies'] });
      onBack();
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.message || 'Failed to save SLA policy');
    }
  });

  const onSubmit = (values: z.infer<typeof slaPolicySchema>) => {
    setErrorMsg(null);
    mutation.mutate(values);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center space-x-4 mb-4">
        <Button variant="ghost" onClick={onBack} size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <h2 className="text-2xl font-bold tracking-tight">
          {policy ? 'Edit SLA Policy' : 'Create SLA Policy'}
        </h2>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />{errorMsg}
          <button type="button" className="ml-auto text-xs underline" onClick={() => setErrorMsg(null)}>Dismiss</button>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>General Configuration</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Policy Name</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              
              <FormField control={form.control} name="is_active" render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 border rounded-md h-[72px]">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Active Policy</FormLabel>
                    <FormDescription>Enable or disable this SLA policy.</FormDescription>
                  </div>
                </FormItem>
              )} />

              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Matching Scope</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField control={form.control} name="unit_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Unit</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value || 'all'}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="All Units" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="all">All Units</SelectItem>
                      {units.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="category_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value || 'all'}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="All Categories" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="priority" render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value || 'all'}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="All Priorities" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="all">All Priorities</SelectItem>
                      <SelectItem value="Low">Low</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Targets & Thresholds</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="first_response_hours" render={({ field }) => (
                <FormItem>
                  <FormLabel>First Response SLA (Hours)</FormLabel>
                  <FormControl><Input type="number" step="0.1" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              
              <FormField control={form.control} name="resolution_hours" render={({ field }) => (
                <FormItem>
                  <FormLabel>Resolution SLA (Hours)</FormLabel>
                  <FormControl><Input type="number" step="0.1" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="business_hours_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Hours Profile</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value || 'all'}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="24/7 (No profile)" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="all">24/7 (Always Active)</SelectItem>
                      {businessHours.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="warning_threshold_percent" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Warning Threshold (%)</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="critical_threshold_percent" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Critical Threshold (%)</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Escalation Rules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-end space-x-4 p-4 border rounded-md">
                  <FormField control={form.control} name={`escalation_rules.${index}.threshold_percent`} render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Threshold (%)</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name={`escalation_rules.${index}.recipient_type`} render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Recipient Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="Role">Role</SelectItem>
                          <SelectItem value="User">Specific User</SelectItem>
                          <SelectItem value="Manager">Manager</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  {form.watch(`escalation_rules.${index}.recipient_type`) === 'Role' && (
                    <FormField control={form.control} name={`escalation_rules.${index}.recipient_id`} render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Role</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {roles.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                  <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={() => append({ threshold_percent: 100, recipient_type: 'Role', recipient_id: '', action: 'Notify' })}>
                <Plus className="h-4 w-4 mr-2" /> Add Escalation Rule
              </Button>
            </CardContent>
          </Card>

          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving...' : 'Save SLA Policy'}
          </Button>
        </form>
      </Form>
    </div>
  );
}
