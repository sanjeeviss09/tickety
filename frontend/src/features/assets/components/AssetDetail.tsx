import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAssetStore } from '../../../store/assetStore';
import { useAuthStore } from '../../../store/authStore';
import api from '../../../lib/api';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ArrowLeft, Edit, ShieldAlert, Paperclip, FileText, ShieldCheck, Loader2 } from 'lucide-react';
import { AssignAssetDialog } from './AssignAssetDialog';

export function AssetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentAsset, loading, fetchAssetById } = useAssetStore();
  const { profile } = useAuthStore();

  const [warrantyModalOpen, setWarrantyModalOpen] = useState(false);
  const [savingWarranty, setSavingWarranty] = useState(false);
  const [warrantyForm, setWarrantyForm] = useState({
    warranty_start_date: '',
    warranty_end_date: '',
    amc_start_date: '',
    amc_end_date: '',
    provider: '',
    contact_info: ''
  });

  useEffect(() => {
    if (id) {
      fetchAssetById(id);
    }
  }, [id]);

  useEffect(() => {
    if (currentAsset?.warranty) {
      setWarrantyForm({
        warranty_start_date: currentAsset.warranty.warranty_start_date || currentAsset.purchase_date || '',
        warranty_end_date: currentAsset.warranty.warranty_end_date || '',
        amc_start_date: currentAsset.warranty.amc_start_date || '',
        amc_end_date: currentAsset.warranty.amc_end_date || '',
        provider: currentAsset.warranty.provider || currentAsset.vendor || '',
        contact_info: currentAsset.warranty.contact_info || ''
      });
    } else if (currentAsset) {
      setWarrantyForm({
        warranty_start_date: currentAsset.purchase_date || '',
        warranty_end_date: '',
        amc_start_date: '',
        amc_end_date: '',
        provider: currentAsset.vendor || '',
        contact_info: ''
      });
    }
  }, [currentAsset]);

  const handleQuickDuration = (years: number) => {
    const startStr = warrantyForm.warranty_start_date || currentAsset?.purchase_date || new Date().toISOString().split('T')[0];
    const startDate = new Date(startStr);
    if (!isNaN(startDate.getTime())) {
      const endDate = new Date(startDate);
      endDate.setFullYear(endDate.getFullYear() + years);
      setWarrantyForm(prev => ({
        ...prev,
        warranty_start_date: startStr,
        warranty_end_date: endDate.toISOString().split('T')[0]
      }));
    }
  };

  const handleSaveWarranty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSavingWarranty(true);
    try {
      await api.put(`/assets/${id}/warranty`, warrantyForm);
      await fetchAssetById(id);
      setWarrantyModalOpen(false);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save warranty details');
    } finally {
      setSavingWarranty(false);
    }
  };

  if (loading || !currentAsset) {
    return <div className="p-8 text-center text-muted-foreground">Loading asset details...</div>;
  }

  const asset = currentAsset;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => navigate('/assets')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Assets
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Asset: {asset.asset_code}</h1>
        </div>
        {profile?.roles?.name !== 'Employee' && (
          <div className="flex space-x-2">
            <AssignAssetDialog asset={asset} />
            <Button>
              <Edit className="mr-2 h-4 w-4" /> Edit
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Info Card */}
        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <div className="flex justify-between">
              <div>
                <CardTitle className="text-2xl">{asset.name}</CardTitle>
                <CardDescription>{asset.category?.name}</CardDescription>
              </div>
              <Badge variant="outline" className="text-lg py-1">{asset.status}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Brand & Model</p>
                <p className="font-medium">{asset.brand} {asset.model}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Serial Number</p>
                <p className="font-medium">{asset.serial_number || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Condition</p>
                <p className="font-medium">{asset.condition}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Location</p>
                <p className="font-medium">{asset.unit} - {asset.department}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Purchase Date</p>
                <p className="font-medium">{asset.purchase_date ? new Date(asset.purchase_date).toLocaleDateString() : 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vendor</p>
                <p className="font-medium">{asset.vendor || 'N/A'}</p>
              </div>
            </div>

            {asset.notes && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Additional Notes</p>
                <div className="p-4 bg-muted/50 rounded-md text-sm whitespace-pre-wrap">
                  {asset.notes}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Current Assignment Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <ShieldAlert className="mr-2 h-5 w-5 text-blue-500" /> Current Assignment
            </CardTitle>
          </CardHeader>
          <CardContent>
            {asset.assignments && asset.assignments.filter(a => a.status === 'Active').length > 0 ? (
              <div className="space-y-4">
                {asset.assignments.filter(a => a.status === 'Active').map(assignment => (
                  <div key={assignment.id} className="p-4 border rounded-lg bg-card">
                    <p className="font-medium">{assignment.assigned_user?.full_name}</p>
                    <p className="text-xs text-muted-foreground mt-1">Assigned on: {new Date(assignment.assigned_at).toLocaleDateString()}</p>
                    {assignment.remarks && <p className="text-sm mt-2">{assignment.remarks}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Not currently assigned to anyone.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Details */}
      <Tabs defaultValue="history" className="w-full">
        <TabsList className="grid w-full grid-cols-4 md:w-[600px]">
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="warranty">Warranty & AMC</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>
        
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Asset Audit Trail</CardTitle>
            </CardHeader>
            <CardContent>
              {asset.history && asset.history.length > 0 ? (
                <div className="space-y-4">
                  {asset.history.map((log: any) => (
                    <div key={log.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border-b last:border-0">
                      <div>
                        <p className="font-medium">{log.action}</p>
                        <p className="text-sm text-muted-foreground">
                          {log.remarks}
                        </p>
                      </div>
                      <div className="text-right mt-2 sm:mt-0">
                        <p className="text-sm font-medium">{log.user?.full_name}</p>
                        <p className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No history records found.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="warranty" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle>Warranty & AMC Information</CardTitle>
                <CardDescription>Track equipment warranty duration, AMC dates, and service contact details</CardDescription>
              </div>
              {profile?.roles?.name !== 'Employee' && (
                <Button size="sm" onClick={() => setWarrantyModalOpen(true)}>
                  <ShieldCheck className="mr-1.5 h-4 w-4" />
                  {asset.warranty ? 'Edit Warranty Details' : 'Add Warranty Details'}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {asset.warranty ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg bg-card">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-sm">Warranty Period</h3>
                      {(() => {
                        if (!asset.warranty.warranty_end_date) return null;
                        const end = new Date(asset.warranty.warranty_end_date);
                        const isExpired = end < new Date();
                        const daysLeft = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        return (
                          <Badge variant={isExpired ? 'destructive' : daysLeft <= 30 ? 'outline' : 'default'} className="text-xs">
                            {isExpired ? 'Expired' : daysLeft <= 30 ? `Expiring in ${daysLeft} days` : 'Active'}
                          </Badge>
                        );
                      })()}
                    </div>
                    <div className="space-y-1.5 text-sm">
                      <p><span className="text-muted-foreground">Start:</span> {asset.warranty.warranty_start_date ? new Date(asset.warranty.warranty_start_date).toLocaleDateString() : 'N/A'}</p>
                      <p><span className="text-muted-foreground">End:</span> {asset.warranty.warranty_end_date ? new Date(asset.warranty.warranty_end_date).toLocaleDateString() : 'N/A'}</p>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg bg-card">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-sm">AMC (Annual Maintenance Contract)</h3>
                      {(() => {
                        if (!asset.warranty.amc_end_date) return null;
                        const end = new Date(asset.warranty.amc_end_date);
                        const isExpired = end < new Date();
                        return (
                          <Badge variant={isExpired ? 'destructive' : 'secondary'} className="text-xs">
                            {isExpired ? 'AMC Expired' : 'AMC Active'}
                          </Badge>
                        );
                      })()}
                    </div>
                    {asset.warranty.amc_start_date || asset.warranty.amc_end_date ? (
                      <div className="space-y-1.5 text-sm">
                        <p><span className="text-muted-foreground">Start:</span> {asset.warranty.amc_start_date ? new Date(asset.warranty.amc_start_date).toLocaleDateString() : 'N/A'}</p>
                        <p><span className="text-muted-foreground">End:</span> {asset.warranty.amc_end_date ? new Date(asset.warranty.amc_end_date).toLocaleDateString() : 'N/A'}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No AMC recorded for this asset.</p>
                    )}
                  </div>

                  <div className="col-span-1 md:col-span-2 p-4 border rounded-lg bg-card">
                    <h3 className="font-semibold text-sm mb-2">Provider & Support Contact</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <p><span className="text-muted-foreground">Provider:</span> {asset.warranty.provider || 'N/A'}</p>
                      <p><span className="text-muted-foreground">Contact:</span> {asset.warranty.contact_info || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No warranty information recorded for this asset.</p>
                  {profile?.roles?.name !== 'Employee' && (
                    <Button variant="outline" onClick={() => setWarrantyModalOpen(true)}>
                      <ShieldCheck className="mr-2 h-4 w-4" /> Add Warranty Details
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Maintenance Logs</CardTitle>
            </CardHeader>
            <CardContent>
              {asset.maintenance && asset.maintenance.length > 0 ? (
                <div className="space-y-4">
                  {asset.maintenance.map((maint: any) => (
                    <div key={maint.id} className="p-4 border rounded-lg flex flex-col md:flex-row justify-between">
                      <div>
                        <Badge className="mb-2">{maint.status}</Badge>
                        <p className="text-sm font-medium">{maint.remarks || 'Routine Maintenance'}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Scheduled: {new Date(maint.scheduled_date).toLocaleDateString()}
                          {maint.completed_date && ` • Completed: ${new Date(maint.completed_date).toLocaleDateString()}`}
                        </p>
                      </div>
                      {profile?.roles?.name !== 'Employee' && maint.status !== 'Completed' && (
                        <Button size="sm" variant="outline" className="mt-4 md:mt-0 self-start md:self-center">
                          Update Status
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No maintenance records found.</p>
                  {profile?.roles?.name !== 'Employee' && (
                    <Button variant="outline">Schedule Maintenance</Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Asset Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {profile?.roles?.name !== 'Employee' && (
                <div className="mb-6 flex items-center justify-end">
                  <Button variant="outline">
                    <Paperclip className="mr-2 h-4 w-4" /> Upload Document
                  </Button>
                </div>
              )}
              
              {asset.documents && asset.documents.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {asset.documents.map((doc: any) => (
                    <div key={doc.id} className="flex items-center p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <FileText className="h-8 w-8 text-blue-500 mr-3" />
                      <div className="overflow-hidden">
                        <p className="font-medium text-sm truncate">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">{(doc.file_size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No documents uploaded.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Warranty & AMC Edit Dialog */}
      <Dialog open={warrantyModalOpen} onOpenChange={setWarrantyModalOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <form onSubmit={handleSaveWarranty}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                {asset.warranty ? 'Edit Warranty & AMC Details' : 'Add Warranty & AMC Details'}
              </DialogTitle>
              <DialogDescription>
                Track warranty periods, AMC dates, and provider contacts for {asset.name} ({asset.asset_code}).
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="w_start">Warranty Start Date</Label>
                  <Input
                    id="w_start"
                    type="date"
                    value={warrantyForm.warranty_start_date}
                    onChange={(e) => setWarrantyForm(f => ({ ...f, warranty_start_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="w_end">Warranty End Date</Label>
                  <Input
                    id="w_end"
                    type="date"
                    value={warrantyForm.warranty_end_date}
                    onChange={(e) => setWarrantyForm(f => ({ ...f, warranty_end_date: e.target.value }))}
                  />
                </div>
              </div>

              {/* Quick duration presets */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Quick Duration:</span>
                {[1, 2, 3, 5].map(yrs => (
                  <Button
                    key={yrs}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    onClick={() => handleQuickDuration(yrs)}
                  >
                    +{yrs} {yrs === 1 ? 'Year' : 'Years'}
                  </Button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                <div className="space-y-1.5">
                  <Label htmlFor="amc_start">AMC Start Date</Label>
                  <Input
                    id="amc_start"
                    type="date"
                    value={warrantyForm.amc_start_date}
                    onChange={(e) => setWarrantyForm(f => ({ ...f, amc_start_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="amc_end">AMC End Date</Label>
                  <Input
                    id="amc_end"
                    type="date"
                    value={warrantyForm.amc_end_date}
                    onChange={(e) => setWarrantyForm(f => ({ ...f, amc_end_date: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t">
                <div className="space-y-1.5">
                  <Label htmlFor="provider">Provider / Vendor</Label>
                  <Input
                    id="provider"
                    placeholder="e.g. ASUS Support, Dell Inc."
                    value={warrantyForm.provider}
                    onChange={(e) => setWarrantyForm(f => ({ ...f, provider: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact">Support Contact</Label>
                  <Input
                    id="contact"
                    placeholder="e.g. support@asus.com, 1800-XXX-XXXX"
                    value={warrantyForm.contact_info}
                    onChange={(e) => setWarrantyForm(f => ({ ...f, contact_info: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setWarrantyModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingWarranty}>
                {savingWarranty ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  'Save Warranty Details'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
