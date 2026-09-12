import { useState, useEffect } from 'react';
import { useAssetStore } from '../../../store/assetStore';
import { useAuthStore } from '../../../store/authStore';
import { Link, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Download } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function AssetList() {
  const { assets, loading, fetchAssets } = useAssetStore();
  const { profile } = useAuthStore();
  
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get('status') || 'All';
  const initialWarranty = searchParams.get('warranty') || 'All';

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [conditionFilter, setConditionFilter] = useState('All');
  const [warrantyFilter, setWarrantyFilter] = useState(initialWarranty);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Available': return 'bg-green-100 text-green-800';
      case 'Assigned': return 'bg-blue-100 text-blue-800';
      case 'In Repair': return 'bg-orange-100 text-orange-800';
      case 'Under Maintenance': return 'bg-yellow-100 text-yellow-800';
      case 'Retired': 
      case 'Disposed': return 'bg-gray-100 text-gray-800';
      case 'Lost': 
      case 'Damaged': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'Excellent': return 'default';
      case 'Good': return 'secondary';
      case 'Fair': return 'outline';
      case 'Poor': return 'destructive';
      case 'Critical': return 'destructive';
      default: return 'outline';
    }
  };

  const filteredAssets = assets.filter((asset: any) => {
    const matchesSearch = 
      asset.asset_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.serial_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.brand?.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesStatus = statusFilter === 'All' || asset.status === statusFilter;
    const matchesCondition = conditionFilter === 'All' || asset.condition === conditionFilter;
    
    let matchesWarranty = true;
    if (warrantyFilter === 'expiring') {
      // In the table it uses warranty_expiry_date directly sometimes, let's handle both
      const end_date = asset.warranty_expiry_date || asset.warranty?.[0]?.warranty_end_date || asset.warranty?.warranty_end_date;
      if (!end_date) matchesWarranty = false;
      else {
        const end = new Date(end_date);
        const daysLeft = Math.ceil((end.getTime() - Date.now()) / 86_400_000);
        matchesWarranty = daysLeft >= 0 && daysLeft <= 30;
      }
    }

    return matchesSearch && matchesStatus && matchesCondition && matchesWarranty;
  });

  const handleExport = () => {
    const exportData = filteredAssets.map((a: any) => ({
      'Asset Code': a.asset_code,
      'Name': a.name,
      'Category': a.category?.name,
      'Brand': a.brand,
      'Model': a.model,
      'Serial Number': a.serial_number,
      'Status': a.status,
      'Condition': a.condition,
      'Assigned To': a.assigned_employee?.full_name || 'Unassigned',
      'Department': a.department?.name || '',
      'Unit': a.unit?.name || '',
      'Location': a.location || '',
      'Purchase Date': a.purchase_date,
      'Purchase Cost': a.purchase_cost,
      'Warranty Expiry': a.warranty_expiry_date
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Assets');
    XLSX.writeFile(wb, 'DeskPulse_Assets_Export.xlsx');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Assets</h1>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
          {(profile?.roles?.name === 'Admin' || profile?.roles?.name === 'Technician') && (
            <Button asChild>
              <Link to="/assets/new">
                <Plus className="mr-2 h-4 w-4" /> Add Asset
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4 border-b">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <CardTitle>Asset Inventory</CardTitle>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search assets..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Status</SelectItem>
                  <SelectItem value="Available">Available</SelectItem>
                  <SelectItem value="Assigned">Assigned</SelectItem>
                  <SelectItem value="In Repair">In Repair</SelectItem>
                  <SelectItem value="Retired">Retired</SelectItem>
                </SelectContent>
              </Select>
              <Select value={conditionFilter} onValueChange={setConditionFilter}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="Condition" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Condition</SelectItem>
                  <SelectItem value="Excellent">Excellent</SelectItem>
                  <SelectItem value="Good">Good</SelectItem>
                  <SelectItem value="Fair">Fair</SelectItem>
                  <SelectItem value="Poor">Poor</SelectItem>
                </SelectContent>
              </Select>
              <Select value={warrantyFilter} onValueChange={setWarrantyFilter}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="Warranty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Warranty</SelectItem>
                  <SelectItem value="expiring">Expiring Soon</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[120px]">Asset Code</TableHead>
                  <TableHead>Asset Info</TableHead>
                  <TableHead>Assignment</TableHead>
                  <TableHead>Location/Dept</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && assets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      Loading assets...
                    </TableCell>
                  </TableRow>
                ) : filteredAssets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No assets found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAssets.map((asset: any) => (
                    <TableRow key={asset.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        <Link to={`/assets/${asset.id}`} className="text-primary hover:underline">
                          {asset.asset_code}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{asset.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {asset.brand} {asset.model} • SN: {asset.serial_number || 'N/A'}
                        </div>
                        <div className="text-xs text-muted-foreground">{asset.category?.name || 'Uncategorized'}</div>
                      </TableCell>
                      <TableCell>
                        {asset.assigned_employee ? (
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{asset.assigned_employee.full_name}</span>
                            <span className="text-xs text-muted-foreground">{asset.assigned_employee.employee_id}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic text-sm">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{asset.department?.name || '-'}</div>
                        <div className="text-xs text-muted-foreground">{asset.unit?.name || '-'}</div>
                        <div className="text-xs text-muted-foreground">{asset.location || ''}</div>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(asset.status)}`}>
                          {asset.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getConditionColor(asset.condition) as any}>{asset.condition}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/assets/${asset.id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {filteredAssets.length > 0 && (
            <div className="p-4 border-t text-xs text-muted-foreground text-center">
              Showing {filteredAssets.length} of {assets.length} assets
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
