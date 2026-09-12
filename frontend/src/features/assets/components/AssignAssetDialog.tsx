import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2 } from 'lucide-react';

const assignmentSchema = z.object({
  assigned_to: z.string().uuid('Please select an employee'),
  remarks: z.string().optional()
});

type AssignmentFormValues = z.infer<typeof assignmentSchema>;

export function AssignAssetDialog({ asset, onAssignmentComplete }: { asset: any, onAssignmentComplete?: () => void }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const res = await api.get('/employees');
      return res.data.data;
    },
    enabled: open
  });

  const form = useForm<AssignmentFormValues>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      assigned_to: '',
      remarks: ''
    }
  });

  const assignMutation = useMutation({
    mutationFn: async (data: AssignmentFormValues) => {
      const payload = {
        asset_id: asset.id,
        assigned_to: data.assigned_to,
        remarks: data.remarks
      };
      // Assume a backend endpoint for assigning asset
      await api.post(`/assets/${asset.id}/assign`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset', asset.id] });
      setOpen(false);
      form.reset();
      if (onAssignmentComplete) onAssignmentComplete();
    },
    onError: (err: any) => {
      alert('Assignment failed: ' + (err.response?.data?.message || err.message));
    }
  });

  const onSubmit = (data: AssignmentFormValues) => {
    assignMutation.mutate(data);
  };

  const isAssigned = asset.status === 'Assigned';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={isAssigned ? "outline" : "default"}>
          <Send className="mr-2 h-4 w-4" /> {isAssigned ? 'Transfer Asset' : 'Assign Asset'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isAssigned ? 'Transfer Asset' : 'Assign Asset'}</DialogTitle>
          <DialogDescription>
            {isAssigned 
              ? `Transfer ${asset.name} from its current assignment to a new employee.` 
              : `Assign ${asset.name} to an employee.`}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control as any} name="assigned_to" render={({ field }) => (
              <FormItem>
                <FormLabel>Assign To (Employee) *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select Employee" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {employees.filter((e: any) => e.employment_status === 'Active').map((emp: any) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.employee_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control as any} name="remarks" render={({ field }) => (
              <FormItem>
                <FormLabel>Remarks</FormLabel>
                <FormControl>
                  <Textarea placeholder="Any condition notes or accessories included..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={assignMutation.isPending || form.formState.isSubmitting}>
                {assignMutation.isPending || form.formState.isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Confirm'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
