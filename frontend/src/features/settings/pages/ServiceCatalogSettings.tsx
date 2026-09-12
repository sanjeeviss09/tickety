import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save } from 'lucide-react';

export function ServiceCatalogSettings() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    require_approval: false,
    default_sla_hours: 48
  });

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'service_catalog_config'],
    queryFn: async () => {
      const res = await api.get('/settings/service_catalog_config');
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
      const res = await api.put('/settings/service_catalog_config', { value: payload });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      alert('Service Catalog settings updated successfully.');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to update settings');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      ...formData,
      default_sla_hours: Number(formData.default_sla_hours)
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Service Catalog Configuration</CardTitle>
          <CardDescription>
            Manage default rules and SLA for employee service requests.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              
              <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50/50">
                <div className="space-y-0.5">
                  <Label className="text-base">Require Approval Globally</Label>
                  <p className="text-sm text-muted-foreground">Require manager/admin approval for all service requests by default before fulfillment.</p>
                </div>
                <Switch checked={formData.require_approval} onCheckedChange={c => setFormData({...formData, require_approval: c})} />
              </div>

              <div className="space-y-2 p-4 border rounded-lg">
                <Label>Default Fulfillment SLA (Hours)</Label>
                <Input 
                  type="number" 
                  value={formData.default_sla_hours} 
                  onChange={e => setFormData({...formData, default_sla_hours: e.target.value as any})} 
                  className="max-w-xs"
                />
                <p className="text-xs text-muted-foreground mt-1">If a specific service item does not define an SLA, this default will be used.</p>
              </div>

            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
