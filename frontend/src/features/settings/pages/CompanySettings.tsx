import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Upload, Image as ImageIcon } from 'lucide-react';

export function CompanySettings() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    company_name: '',
    registered_name: '',
    address: '',
    city: '',
    state: '',
    country: '',
    pin_code: '',
    phone: '',
    email: '',
    website: '',
    support_email: '',
    support_phone: '',
    logo_url: '',
    favicon_url: ''
  });

  const [uploadingLogo, setUploadingLogo] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'company_config'],
    queryFn: async () => {
      const res = await api.get('/settings/company_config');
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
      const res = await api.put('/settings/company_config', { value: payload });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      alert('Company settings updated successfully.');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to update settings');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'favicon') => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        alert('Invalid file type. Please upload PNG, JPG, SVG, or WebP.');
        return;
      }
      
      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        alert('File size must be less than 2MB.');
        return;
      }

      setUploadingLogo(true);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${type}_${Date.now()}.${fileExt}`;
      const filePath = `company/branding/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('public_assets')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('public_assets')
        .getPublicUrl(filePath);

      setFormData(prev => ({
        ...prev,
        [type === 'logo' ? 'logo_url' : 'favicon_url']: publicUrl
      }));
      
      // Automatically save after upload
      updateMutation.mutate({
        ...formData,
        [type === 'logo' ? 'logo_url' : 'favicon_url']: publicUrl
      });

    } catch (error: any) {
      alert(`Error uploading file: ${error.message}`);
    } finally {
      setUploadingLogo(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Company Settings</CardTitle>
          <CardDescription>
            Manage company information and branding used across the application and reports.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Branding Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Branding</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4 p-4 border rounded-lg bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Company Logo</Label>
                      <p className="text-xs text-muted-foreground mt-1">PNG, JPG, SVG up to 2MB. Recommended height 40px.</p>
                    </div>
                    {formData.logo_url ? (
                      <div className="h-12 w-auto bg-white border p-1 rounded">
                        <img src={formData.logo_url} alt="Logo" className="h-full w-auto object-contain" />
                      </div>
                    ) : (
                      <div className="h-12 w-12 bg-muted rounded flex items-center justify-center">
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="file" 
                      accept=".png,.jpg,.jpeg,.svg,.webp" 
                      className="hidden" 
                      id="logo-upload" 
                      onChange={(e) => handleFileUpload(e, 'logo')}
                      disabled={uploadingLogo}
                    />
                    <Label htmlFor="logo-upload" className="cursor-pointer">
                      <div className="flex items-center gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-md text-sm font-medium">
                        {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        Upload Logo
                      </div>
                    </Label>
                    {formData.logo_url && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setFormData({...formData, logo_url: ''})} className="text-destructive">
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Organization Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Company Name (Display Name)</Label>
                  <Input value={formData.company_name} onChange={e => setFormData({...formData, company_name: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>Registered Legal Name</Label>
                  <Input value={formData.registered_name} onChange={e => setFormData({...formData, registered_name: e.target.value})} />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Corporate Email</Label>
                  <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Corporate Phone</Label>
                  <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Support Email</Label>
                  <Input type="email" value={formData.support_email} onChange={e => setFormData({...formData, support_email: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Support Phone</Label>
                  <Input value={formData.support_phone} onChange={e => setFormData({...formData, support_phone: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Website</Label>
                  <Input type="url" value={formData.website} onChange={e => setFormData({...formData, website: e.target.value})} />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Address</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-2">
                  <Label>Street Address</Label>
                  <Input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>State / Province</Label>
                  <Input value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input value={formData.country} onChange={e => setFormData({...formData, country: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>PIN / Zip Code</Label>
                  <Input value={formData.pin_code} onChange={e => setFormData({...formData, pin_code: e.target.value})} />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button type="submit" disabled={updateMutation.isPending || uploadingLogo}>
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
