import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save } from 'lucide-react';

export function KnowledgeSettings() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    is_enabled: true,
    require_approval: true,
    allow_ratings: true,
    allow_comments: true,
    require_versioning: true,
    max_upload_size_mb: 10,
    allowed_file_types: ['.pdf', '.doc', '.docx', '.png', '.jpg']
  });

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'kb_config'],
    queryFn: async () => {
      const res = await api.get('/settings/kb_config');
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
      const res = await api.put('/settings/kb_config', { value: payload });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      alert('Knowledge Base settings updated successfully.');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to update settings');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      ...formData,
      max_upload_size_mb: Number(formData.max_upload_size_mb),
      allowed_file_types: typeof formData.allowed_file_types === 'string' 
        ? (formData.allowed_file_types as string).split(',').map(s => s.trim())
        : formData.allowed_file_types
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Help Center & Knowledge Base</CardTitle>
          <CardDescription>
            Configure knowledge article publishing, versioning, and end-user interactions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50/50">
                <div className="space-y-0.5">
                  <Label className="text-base">Enable Knowledge Base</Label>
                  <p className="text-sm text-muted-foreground">Make the help center available to employees.</p>
                </div>
                <Switch checked={formData.is_enabled} onCheckedChange={c => setFormData({...formData, is_enabled: c})} />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50/50">
                <div className="space-y-0.5">
                  <Label className="text-base">Require Approval</Label>
                  <p className="text-sm text-muted-foreground">Articles must be approved by an Admin before publishing.</p>
                </div>
                <Switch checked={formData.require_approval} onCheckedChange={c => setFormData({...formData, require_approval: c})} />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50/50">
                <div className="space-y-0.5">
                  <Label className="text-base">Allow Article Ratings</Label>
                  <p className="text-sm text-muted-foreground">Allow employees to rate articles as helpful or not.</p>
                </div>
                <Switch checked={formData.allow_ratings} onCheckedChange={c => setFormData({...formData, allow_ratings: c})} />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50/50">
                <div className="space-y-0.5">
                  <Label className="text-base">Strict Versioning</Label>
                  <p className="text-sm text-muted-foreground">Force a new major/minor version on every edit.</p>
                </div>
                <Switch checked={formData.require_versioning} onCheckedChange={c => setFormData({...formData, require_versioning: c})} />
              </div>

              <div className="space-y-2 md:col-span-2 mt-4">
                <Label>Max Attachment Upload Size (MB)</Label>
                <Input 
                  type="number" 
                  value={formData.max_upload_size_mb} 
                  onChange={e => setFormData({...formData, max_upload_size_mb: e.target.value as any})} 
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Allowed Attachment File Types</Label>
                <Input 
                  value={Array.isArray(formData.allowed_file_types) ? formData.allowed_file_types.join(', ') : formData.allowed_file_types} 
                  onChange={e => setFormData({...formData, allowed_file_types: e.target.value as any})} 
                  placeholder=".pdf, .doc, .png"
                />
                <p className="text-xs text-muted-foreground">Comma separated list of extensions (e.g. .pdf, .docx, .png)</p>
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
