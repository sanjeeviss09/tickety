import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAssetStore } from '../../../store/assetStore';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2 } from 'lucide-react';

import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';

const assetSchema = z.object({
  asset_code: z.string().min(1, 'Asset Code is required'),
  name: z.string().min(1, 'Name is required'),
  category_id: z.string().uuid('Please select a category'),
  brand: z.string().optional(),
  model: z.string().optional(),
  serial_number: z.string().optional(),
  purchase_date: z.string().optional(),
  purchase_cost: z.coerce.number().optional(),
  vendor: z.string().optional(),
  status: z.enum(['Available', 'Assigned', 'In Repair', 'Under Maintenance', 'Retired', 'Lost', 'Damaged', 'Disposed', 'Reserved']).default('Available'),
  condition: z.enum(['Excellent', 'Good', 'Fair', 'Poor', 'Critical']).default('Good'),
  unit: z.string().optional(),
  department: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  assigned_to: z.string().optional(),
  warranty: z.string().optional(),
  port_number: z.string().optional(),
});

type AssetFormValues = z.infer<typeof assetSchema>;

export function AssetForm() {
  const navigate = useNavigate();
  const { createAsset, loading, categories, fetchCategories } = useAssetStore();

  const { data: units = [] } = useQuery({
    queryKey: ['units'],
    queryFn: async () => {
      const res = await api.get('/units');
      return res.data.data;
    }
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const res = await api.get('/departments');
      return res.data.data;
    }
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const res = await api.get('/employees');
      return res.data.data;
    }
  });

  const form = useForm<AssetFormValues>({
    resolver: zodResolver(assetSchema) as any,
    defaultValues: {
      asset_code: '',
      name: '',
      brand: '',
      model: '',
      serial_number: '',
      purchase_date: '',
      vendor: '',
      status: 'Available',
      condition: 'Good',
      unit: '',
      department: '',
      location: '',
      notes: '',
      assigned_to: '',
      warranty: '',
      port_number: ''
    },
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const onSubmit = async (data: AssetFormValues) => {
    try {
      const payload = { ...data };
      if (payload.assigned_to === 'unassigned' || payload.assigned_to === '') {
        delete payload.assigned_to;
      }
      await createAsset(payload);
      navigate('/assets');
    } catch (error) {
      console.error('Failed to create asset:', error);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4">
      {/* Top action header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/assets')}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Assets
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Create Asset</h1>
            <p className="text-xs text-muted-foreground">Register a new IT hardware or software asset into the inventory</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button type="button" variant="outline" size="sm" onClick={() => navigate('/assets')}>
            Cancel
          </Button>
          <Button 
            type="button" 
            size="sm" 
            onClick={form.handleSubmit(onSubmit as any)}
            disabled={loading || form.formState.isSubmitting}
          >
            {loading || form.formState.isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Create Asset'}
          </Button>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-5">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Row 1 */}
                <FormField
                  control={form.control as any}
                  name="asset_code"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-xs font-semibold">Asset Code *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. AST-2024-001" className="h-9 text-sm" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-xs font-semibold">Asset Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Dell XPS 15" className="h-9 text-sm" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name="category_id"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-xs font-semibold">Category *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name="status"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-xs font-semibold">Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Available">Available</SelectItem>
                          <SelectItem value="Assigned">Assigned</SelectItem>
                          <SelectItem value="In Repair">In Repair</SelectItem>
                          <SelectItem value="Under Maintenance">Under Maintenance</SelectItem>
                          <SelectItem value="Reserved">Reserved</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Row 2 */}
                <FormField
                  control={form.control as any}
                  name="brand"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-xs font-semibold">Brand</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Dell" className="h-9 text-sm" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name="model"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-xs font-semibold">Model</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. XPS 15 9500" className="h-9 text-sm" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name="serial_number"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-xs font-semibold">Serial Number</FormLabel>
                      <FormControl>
                        <Input placeholder="SN-..." className="h-9 text-sm" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name="condition"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-xs font-semibold">Condition</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Select condition" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Excellent">Excellent</SelectItem>
                          <SelectItem value="Good">Good</SelectItem>
                          <SelectItem value="Fair">Fair</SelectItem>
                          <SelectItem value="Poor">Poor</SelectItem>
                          <SelectItem value="Critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Row 3 */}
                <FormField
                  control={form.control as any}
                  name="assigned_to"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-xs font-semibold">Assigned Employee</FormLabel>
                      <Select 
                        onValueChange={(val) => {
                          field.onChange(val);
                          if (val && val !== 'unassigned') {
                            const selectedEmp = employees.find((e: any) => e.id === val);
                            if (selectedEmp) {
                              // Auto-fill Business Unit
                              const matchedUnit = units.find(
                                (u: any) => u.id === selectedEmp.unit_id || 
                                            (u.name && selectedEmp.unit?.name && u.name.toLowerCase() === selectedEmp.unit.name.toLowerCase())
                              );
                              const unitName = matchedUnit?.name || selectedEmp.unit?.name;
                              if (unitName) {
                                form.setValue('unit', unitName, { shouldValidate: true, shouldDirty: true });
                              }

                              // Auto-fill Department
                              const matchedDept = departments.find(
                                (d: any) => d.id === selectedEmp.department_id || 
                                            (d.name && selectedEmp.department?.name && d.name.toLowerCase() === selectedEmp.department.name.toLowerCase())
                              );
                              const deptName = matchedDept?.name || selectedEmp.department?.name;
                              if (deptName) {
                                form.setValue('department', deptName, { shouldValidate: true, shouldDirty: true });
                              }

                              // Auto-switch status to 'Assigned' if it is currently 'Available'
                              if (form.getValues('status') === 'Available') {
                                form.setValue('status', 'Assigned', { shouldValidate: true, shouldDirty: true });
                              }
                            }
                          }
                        }} 
                        value={field.value || ''}
                      >
                        <FormControl>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Select employee (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="unassigned">None (Unassigned)</SelectItem>
                          {employees.map((emp: any) => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.employee_id ? `${emp.employee_id} - ${emp.full_name}` : emp.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name="unit"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-xs font-semibold">Business Unit</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Select Unit" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {units.map((u: any) => (
                            <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name="department"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-xs font-semibold">Department</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Select Department" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {departments.map((d: any) => (
                            <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name="purchase_date"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-xs font-semibold">Purchase Date</FormLabel>
                      <FormControl>
                        <Input type="date" className="h-9 text-sm" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Row 4: Purchase cost, Warranty, Port Number */}
                <FormField
                  control={form.control as any}
                  name="purchase_cost"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-xs font-semibold">Purchase Cost ($)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" className="h-9 text-sm" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name="warranty"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-xs font-semibold">Warranty</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 3 Years or 12/31/2026" className="h-9 text-sm" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name="port_number"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-xs font-semibold">Port Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Port-A1" className="h-9 text-sm" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="col-span-1 sm:col-span-2 lg:col-span-1"></div>

                <div className="col-span-1 sm:col-span-2 lg:col-span-4">
                  <FormField
                    control={form.control as any}
                    name="notes"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-xs font-semibold">Notes / Specs</FormLabel>
                        <FormControl>
                          <Input placeholder="Additional information, configuration, accessories..." className="h-9 text-sm" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t">
                <Button type="button" variant="outline" size="sm" onClick={() => navigate('/assets')}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={loading || form.formState.isSubmitting}>
                  {loading || form.formState.isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Create Asset'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
