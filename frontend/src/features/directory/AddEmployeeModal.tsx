import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import api from '../../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AddEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRoleName?: 'Employee' | 'Technician' | 'Admin';
  employeeToEdit?: any | null;
}

export function AddEmployeeModal({ isOpen, onClose, defaultRoleName = 'Employee', employeeToEdit }: AddEmployeeModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    employee_id: '',
    full_name: '',
    email_address: '',
    mobile_number: '',
    designation: '',
    role_id: '',
    unit_id: '',
    department_id: '',
    employment_status: 'Active',
    location: ''
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const { data } = await supabase.from('roles').select('*').order('name');
      return data || [];
    }
  });

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

  useEffect(() => {
    if (isOpen) {
      if (employeeToEdit) {
        setFormData({
          employee_id: employeeToEdit.employee_id || '',
          full_name: employeeToEdit.full_name || '',
          email_address: employeeToEdit.email_address || '',
          mobile_number: employeeToEdit.mobile_number || '',
          designation: employeeToEdit.designation || '',
          role_id: employeeToEdit.role_id || '',
          unit_id: employeeToEdit.unit_id || '',
          department_id: employeeToEdit.department_id || '',
          employment_status: employeeToEdit.employment_status || 'Active',
          location: employeeToEdit.location || ''
        });
      } else {
        const prefix = defaultRoleName === 'Technician' ? 'TECH' : defaultRoleName === 'Admin' ? 'ADM' : 'EMP';
        const randomNum = Math.floor(100 + Math.random() * 900);
        const generatedId = `${prefix}-${randomNum}`;

        setFormData(prev => ({
          ...prev,
          employee_id: prev.employee_id || generatedId,
        }));

        if (roles.length > 0 && defaultRoleName) {
          const matched = roles.find((r: any) => r.name?.toLowerCase() === defaultRoleName.toLowerCase());
          if (matched) {
            setFormData(prev => ({ ...prev, role_id: matched.id }));
          }
        }
      }
    }
  }, [roles, defaultRoleName, isOpen, employeeToEdit]);

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const formatted = {
        ...payload,
        unit_id: payload.unit_id || null,
        department_id: payload.department_id || null,
        role_id: payload.role_id || null,
      };
      if (employeeToEdit?.id) {
        await api.put(`/employees/${employeeToEdit.id}`, formatted);
      } else {
        await api.post('/employees', formatted);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
      resetForm();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || '';
      if (msg.includes('profiles_employee_id_key') || msg.includes('employee_id')) {
        alert(`Employee ID "${formData.employee_id}" already exists. Please enter a unique Employee ID.`);
      } else if (msg.includes('profiles_email_address_key') || msg.includes('email_address')) {
        alert(`Email address "${formData.email_address}" is already registered. Please use a unique email address.`);
      } else {
        alert(msg || 'Failed to save employee');
      }
    }
  });

  const resetForm = () => {
    setFormData({
      employee_id: '',
      full_name: '',
      email_address: '',
      mobile_number: '',
      designation: '',
      role_id: '',
      unit_id: '',
      department_id: '',
      employment_status: 'Active',
      location: ''
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{employeeToEdit ? 'Edit' : 'Add New'} {employeeToEdit ? (employeeToEdit.role?.name || 'Employee') : defaultRoleName}</DialogTitle>
          <DialogDescription>
            {employeeToEdit ? 'Update employee profile details.' : 'Directly add a new staff member or technician without needing to upload files.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Employee ID *</Label>
              <Input
                required
                placeholder="e.g. EMP-101"
                value={formData.employee_id}
                onChange={e => setFormData({ ...formData, employee_id: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input
                required
                placeholder="e.g. Jane Doe"
                value={formData.full_name}
                onChange={e => setFormData({ ...formData, full_name: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email Address *</Label>
              <Input
                type="email"
                required
                disabled={!!employeeToEdit}
                placeholder="jane@company.com"
                value={formData.email_address}
                onChange={e => setFormData({ ...formData, email_address: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Mobile Number</Label>
              <Input
                placeholder="+1 555 0192"
                value={formData.mobile_number}
                onChange={e => setFormData({ ...formData, mobile_number: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Designation</Label>
              <Input
                placeholder="e.g. IT Specialist / Engineer"
                value={formData.designation}
                onChange={e => setFormData({ ...formData, designation: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>System Role *</Label>
              <Select value={formData.role_id || undefined} onValueChange={val => setFormData({ ...formData, role_id: val })}>
                <SelectTrigger><SelectValue placeholder="Select Role" /></SelectTrigger>
                <SelectContent>
                  {roles.length === 0 ? (
                    <SelectItem value="none" disabled>No roles found</SelectItem>
                  ) : (
                    roles.map((r: any) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select value={formData.unit_id || undefined} onValueChange={val => setFormData({ ...formData, unit_id: val })}>
                <SelectTrigger><SelectValue placeholder="Select Unit" /></SelectTrigger>
                <SelectContent>
                  {units.length === 0 ? (
                    <SelectItem value="none" disabled>No units found</SelectItem>
                  ) : (
                    units.map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={formData.department_id || undefined} onValueChange={val => setFormData({ ...formData, department_id: val })}>
                <SelectTrigger><SelectValue placeholder="Select Department" /></SelectTrigger>
                <SelectContent>
                  {departments.length === 0 ? (
                    <SelectItem value="none" disabled>No departments found</SelectItem>
                  ) : (
                    departments.map((d: any) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Employment Status</Label>
            <Select value={formData.employment_status} onValueChange={val => setFormData({ ...formData, employment_status: val })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
                <SelectItem value="Suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="pt-4 flex justify-end space-x-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : (employeeToEdit ? 'Save Changes' : `Save ${defaultRoleName}`)}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
