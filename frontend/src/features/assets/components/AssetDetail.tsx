import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAssetStore } from '../../../store/assetStore';
import { useAuthStore } from '../../../store/authStore';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Edit, ShieldAlert, Paperclip, FileText } from 'lucide-react';
import { AssignAssetDialog } from './AssignAssetDialog';

export function AssetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentAsset, loading, fetchAssetById } = useAssetStore();
  const { profile } = useAuthStore();

  useEffect(() => {
    if (id) {
      fetchAssetById(id);
    }
  }, [id]);

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
            <CardHeader>
              <CardTitle>Warranty & AMC Information</CardTitle>
            </CardHeader>
            <CardContent>
              {asset.warranty ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-semibold mb-2">Warranty</h3>
                    <p className="text-sm"><span className="text-muted-foreground">Start:</span> {new Date(asset.warranty.warranty_start_date).toLocaleDateString()}</p>
                    <p className="text-sm"><span className="text-muted-foreground">End:</span> {new Date(asset.warranty.warranty_end_date).toLocaleDateString()}</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-semibold mb-2">AMC (Annual Maintenance Contract)</h3>
                    {asset.warranty.amc_start_date ? (
                      <>
                        <p className="text-sm"><span className="text-muted-foreground">Start:</span> {new Date(asset.warranty.amc_start_date).toLocaleDateString()}</p>
                        <p className="text-sm"><span className="text-muted-foreground">End:</span> {new Date(asset.warranty.amc_end_date).toLocaleDateString()}</p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">No AMC recorded.</p>
                    )}
                  </div>
                  <div className="col-span-1 md:col-span-2 p-4 border rounded-lg">
                    <h3 className="font-semibold mb-2">Provider Details</h3>
                    <p className="text-sm"><span className="text-muted-foreground">Name:</span> {asset.warranty.provider || 'N/A'}</p>
                    <p className="text-sm"><span className="text-muted-foreground">Contact:</span> {asset.warranty.contact_info || 'N/A'}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No warranty information recorded for this asset.</p>
                  {profile?.roles?.name !== 'Employee' && (
                    <Button variant="outline">Add Warranty Details</Button>
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
    </div>
  );
}
