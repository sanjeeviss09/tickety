import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save } from 'lucide-react';

export function AssetSettings() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    prefix: 'AST',
    warranty_warning_days: 60,
    amc_warning_days: 30
  });

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'asset_config'],
    queryFn: async () => {
      const res = await api.get('/settings/asset_config');
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
      const res = await api.put('/settings/asset_config', { value: payload });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      alert('Asset settings updated successfully.');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to update settings');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      ...formData,
      warranty_warning_days: Number(formData.warranty_warning_days),
      amc_warning_days: Number(formData.amc_warning_days)
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Asset Configuration</CardTitle>
          <CardDescription>
            Manage asset numbering and lifecycle notification thresholds.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Asset Tag Prefix</Label>
                <Input 
                  value={formData.prefix} 
                  onChange={e => setFormData({...formData, prefix: e.target.value})} 
                  required 
                />
              </div>

              <div className="space-y-2">
                <Label>Warranty Warning (Days before expiry)</Label>
                <Input 
                  type="number" 
                  value={formData.warranty_warning_days} 
                  onChange={e => setFormData({...formData, warranty_warning_days: e.target.value as any})} 
                  required 
                />
              </div>

              <div className="space-y-2">
                <Label>AMC Warning (Days before expiry)</Label>
                <Input 
                  type="number" 
                  value={formData.amc_warning_days} 
                  onChange={e => setFormData({...formData, amc_warning_days: e.target.value as any})} 
                  required 
                />
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
