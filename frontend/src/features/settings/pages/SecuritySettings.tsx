import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save, ShieldAlert } from 'lucide-react';

export function SecuritySettings() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    session_timeout_minutes: 120,
    max_failed_attempts: 5,
    lockout_duration_minutes: 30,
    min_password_length: 8,
    require_complexity: true
  });

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'security_config'],
    queryFn: async () => {
      const res = await api.get('/settings/security_config');
      return res.data.data;
    }
  });

  useEffect(() => {
    if (data) {
      setFormData(prev => ({ ...prev, ...data }));
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.put('/settings/security_config', { value: payload });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      alert('Security settings updated successfully.');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to update settings');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      ...formData,
      session_timeout_minutes: Number(formData.session_timeout_minutes),
      max_failed_attempts: Number(formData.max_failed_attempts),
      lockout_duration_minutes: Number(formData.lockout_duration_minutes),
      min_password_length: Number(formData.min_password_length)
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Security & Authentication</CardTitle>
          <CardDescription>
            Manage global security policies and session management rules.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            
            <div className="p-4 bg-amber-50 text-amber-800 border-amber-200 border rounded-md flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 mt-0.5" />
              <div className="text-sm">
                <strong>Warning:</strong> Adjusting session timeouts and password policies affects all users immediately. Currently active sessions exceeding the new timeout limit will be invalidated.
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="space-y-2">
                <Label>Session Timeout (Minutes)</Label>
                <Input 
                  type="number" 
                  value={formData.session_timeout_minutes} 
                  onChange={e => setFormData({...formData, session_timeout_minutes: e.target.value as any})} 
                  required 
                />
              </div>

              <div className="space-y-2">
                <Label>Max Failed Login Attempts</Label>
                <Input 
                  type="number" 
                  value={formData.max_failed_attempts} 
                  onChange={e => setFormData({...formData, max_failed_attempts: e.target.value as any})} 
                  required 
                />
              </div>

              <div className="space-y-2">
                <Label>Account Lockout Duration (Minutes)</Label>
                <Input 
                  type="number" 
                  value={formData.lockout_duration_minutes} 
                  onChange={e => setFormData({...formData, lockout_duration_minutes: e.target.value as any})} 
                  required 
                />
              </div>

              <div className="space-y-2">
                <Label>Minimum Password Length</Label>
                <Input 
                  type="number" 
                  value={formData.min_password_length} 
                  onChange={e => setFormData({...formData, min_password_length: e.target.value as any})} 
                  required 
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50/50 md:col-span-2">
                <div className="space-y-0.5">
                  <Label className="text-base">Require Password Complexity</Label>
                  <p className="text-sm text-muted-foreground">Require at least one uppercase, one number, and one special character.</p>
                </div>
                <Switch checked={formData.require_complexity} onCheckedChange={c => setFormData({...formData, require_complexity: c})} />
              </div>

            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Security Policies
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
