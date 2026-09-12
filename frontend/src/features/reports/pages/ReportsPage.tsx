import { useEffect, useRef, useState } from 'react';
import { useReportsStore } from '../../../store/reportsStore';
import { ReportFilterPanel, ReportFilters } from '../../../components/reports/ReportFilterPanel';
import { ExportToolbar } from '../../../components/reports/ExportToolbar';
import { FileText, ShieldCheck, Database, FileWarning, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ── Ticket Summary Report ────────────────────────────────────
function TicketSummaryReport() {
  const { ticketSummary, loading, fetchTicketSummary } = useReportsStore();
  const [filters, setFilters] = useState<ReportFilters>({});
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchTicketSummary(); }, []);

  const COLS = [
    { key: 'ticket_number', label: 'Ticket #' },
    { key: 'subject', label: 'Subject' },
    { key: 'status', label: 'Status' },
    { key: 'priority', label: 'Priority' },
    { key: 'created_at', label: 'Created' },
  ];

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'Critical': return 'destructive';
      case 'High': return 'default';
      case 'Medium': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-4">
      <ReportFilterPanel filters={filters} onChange={setFilters} onApply={() => fetchTicketSummary(filters)} showFields={['date', 'status', 'priority', 'unit']} />
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{ticketSummary.length} records</p>
        <ExportToolbar data={ticketSummary} columns={COLS} filename="ticket-summary" reportTitle="Ticket Summary Report" printRef={printRef} />
      </div>
      <div ref={printRef} className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Ticket #</th>
                <th className="text-left px-4 py-3">Subject</th>
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Priority</th>
                <th className="text-left px-4 py-3">Assignee</th>
                <th className="text-left px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading && ticketSummary.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : ticketSummary.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No records found.</td></tr>
              ) : ticketSummary.map((t: any) => (
                <tr key={t.id} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-primary">{t.ticket_number}</td>
                  <td className="px-4 py-3 max-w-56 truncate">{t.subject}</td>
                  <td className="px-4 py-3">{t.ticket_categories?.name || '—'}</td>
                  <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{t.status}</Badge></td>
                  <td className="px-4 py-3"><Badge variant={getPriorityColor(t.priority) as any} className="text-xs">{t.priority}</Badge></td>
                  <td className="px-4 py-3">{t.assignee?.full_name || 'Unassigned'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Technician Performance Report ──────────────────────────
function TechnicianPerformanceReport() {
  const { technicianReport, loading, fetchTechnicianReport } = useReportsStore();
  const [filters, setFilters] = useState<ReportFilters>({});
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchTechnicianReport(); }, []);

  const COLS = [
    { key: 'name', label: 'Technician' },
    { key: 'assigned', label: 'Assigned' },
    { key: 'resolved', label: 'Resolved' },
    { key: 'pending', label: 'Pending' },
    { key: 'avgResolutionHours', label: 'Avg Resolution (h)' },
    { key: 'slaCompliance', label: 'SLA %' },
  ];

  return (
    <div className="space-y-4">
      <ReportFilterPanel filters={filters} onChange={setFilters} onApply={() => fetchTechnicianReport(filters)} showFields={['date']} />
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{technicianReport.length} technicians</p>
        <ExportToolbar data={technicianReport} columns={COLS} filename="technician-performance" reportTitle="Technician Performance Report" printRef={printRef} />
      </div>
      <div ref={printRef} className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Technician</th>
              <th className="text-right px-4 py-3">Assigned</th>
              <th className="text-right px-4 py-3">Resolved</th>
              <th className="text-right px-4 py-3">Pending</th>
              <th className="text-right px-4 py-3">Avg Time</th>
              <th className="text-right px-4 py-3">SLA %</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
            ) : technicianReport.map((t: any) => (
              <tr key={t.id} className="border-t hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium">{t.name}</td>
                <td className="px-4 py-3 text-right">{t.assigned}</td>
                <td className="px-4 py-3 text-right text-green-600 font-semibold">{t.resolved}</td>
                <td className="px-4 py-3 text-right text-yellow-600">{t.pending}</td>
                <td className="px-4 py-3 text-right">{t.avgResolutionHours}h</td>
                <td className="px-4 py-3 text-right">
                  <Badge variant={t.slaCompliance >= 90 ? 'default' : t.slaCompliance >= 75 ? 'secondary' : 'destructive'} className="text-xs">
                    {t.slaCompliance}%
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── SLA Compliance Report ─────────────────────────────────
function SlaComplianceReport() {
  const { slaReport, loading, fetchSlaReport } = useReportsStore();
  const [filters, setFilters] = useState<ReportFilters>({});
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchSlaReport(); }, []);

  const slaStatusColor = (s: string) => {
    switch (s) {
      case 'Compliant': return 'bg-green-100 text-green-800';
      case 'Breached': return 'bg-red-100 text-red-800';
      case 'Overdue': return 'bg-orange-100 text-orange-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  return (
    <div className="space-y-4">
      <ReportFilterPanel filters={filters} onChange={setFilters} onApply={() => fetchSlaReport(filters)} showFields={['date', 'priority', 'unit']} />
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{slaReport.length} records</p>
        <ExportToolbar data={slaReport} columns={[
          { key: 'ticket_number', label: 'Ticket #' }, { key: 'priority', label: 'Priority' },
          { key: 'slaMaxHours', label: 'SLA (h)' }, { key: 'resolutionHours', label: 'Actual (h)' }, { key: 'slaStatus', label: 'Status' }
        ]} filename="sla-compliance" reportTitle="SLA Compliance Report" printRef={printRef} />
      </div>
      <div ref={printRef} className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Ticket #</th>
              <th className="text-left px-4 py-3">Subject</th>
              <th className="text-left px-4 py-3">Priority</th>
              <th className="text-right px-4 py-3">SLA Limit</th>
              <th className="text-right px-4 py-3">Actual</th>
              <th className="text-left px-4 py-3">SLA Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
            ) : slaReport.map((t: any) => (
              <tr key={t.id} className="border-t hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium text-primary">{t.ticket_number}</td>
                <td className="px-4 py-3 max-w-52 truncate">{t.subject}</td>
                <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{t.priority}</Badge></td>
                <td className="px-4 py-3 text-right">{t.slaMaxHours}h</td>
                <td className="px-4 py-3 text-right">{t.resolutionHours !== null ? `${Math.round(t.resolutionHours * 10) / 10}h` : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${slaStatusColor(t.slaStatus)}`}>{t.slaStatus}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Asset Inventory Report ───────────────────────────────────
function AssetInventoryReport() {
  const { assetInventory, loading, fetchAssetInventory } = useReportsStore();
  const [filters, setFilters] = useState<ReportFilters>({});
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchAssetInventory(); }, []);

  return (
    <div className="space-y-4">
      <ReportFilterPanel filters={filters} onChange={setFilters} onApply={() => fetchAssetInventory(filters)} showFields={['unit']} />
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{assetInventory.length} assets</p>
        <ExportToolbar data={assetInventory} columns={[
          { key: 'asset_code', label: 'Asset Code' }, { key: 'name', label: 'Name' },
          { key: 'status', label: 'Status' }, { key: 'condition', label: 'Condition' },
          { key: 'unit', label: 'Unit' }, { key: 'department', label: 'Dept' }
        ]} filename="asset-inventory" reportTitle="Asset Inventory Report" printRef={printRef} />
      </div>
      <div ref={printRef} className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Asset Code</th>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Category</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Condition</th>
              <th className="text-left px-4 py-3">Unit / Dept</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
            ) : assetInventory.map((a: any) => (
              <tr key={a.id} className="border-t hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium text-primary">{a.asset_code}</td>
                <td className="px-4 py-3">{a.name}</td>
                <td className="px-4 py-3">{a.category?.name || '—'}</td>
                <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{a.status}</Badge></td>
                <td className="px-4 py-3">{a.condition}</td>
                <td className="px-4 py-3">{[a.unit, a.department].filter(Boolean).join(' / ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Warranty Report ────────────────────────────────────────
function WarrantyReport() {
  const { warrantyReport, loading, fetchWarrantyReport } = useReportsStore();
  const [filters, setFilters] = useState<ReportFilters>({});
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchWarrantyReport(); }, []);

  const statusColor = (s: string) => {
    switch (s) {
      case 'Valid': return 'bg-green-100 text-green-800';
      case 'Expiring Soon': return 'bg-yellow-100 text-yellow-800';
      case 'Expired': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="space-y-4">
      <ReportFilterPanel filters={filters} onChange={setFilters} onApply={() => fetchWarrantyReport(filters)} showFields={['unit']} />
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{warrantyReport.length} records</p>
        <ExportToolbar data={warrantyReport} columns={[
          { key: 'asset_code', label: 'Asset Code' }, { key: 'warranty_end_date', label: 'Warranty End' },
          { key: 'warrantyStatus', label: 'Warranty Status' }, { key: 'amcStatus', label: 'AMC Status' }
        ]} filename="warranty-report" reportTitle="Warranty & AMC Report" printRef={printRef} />
      </div>
      <div ref={printRef} className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Asset</th>
              <th className="text-left px-4 py-3">Warranty End</th>
              <th className="text-left px-4 py-3">Warranty Status</th>
              <th className="text-left px-4 py-3">AMC End</th>
              <th className="text-left px-4 py-3">AMC Status</th>
              <th className="text-left px-4 py-3">Provider</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
            ) : warrantyReport.map((w: any) => (
              <tr key={w.id} className="border-t hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium">{w.asset?.asset_code}</p>
                  <p className="text-xs text-muted-foreground">{w.asset?.name}</p>
                </td>
                <td className="px-4 py-3">{w.warranty_end_date ? new Date(w.warranty_end_date).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColor(w.warrantyStatus)}`}>{w.warrantyStatus}</span></td>
                <td className="px-4 py-3">{w.amc_end_date ? new Date(w.amc_end_date).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColor(w.amcStatus)}`}>{w.amcStatus}</span></td>
                <td className="px-4 py-3">{w.provider || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Reports Page Shell ────────────────────────────────────────
export function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground mt-1">Generate, filter, and export enterprise reports.</p>
      </div>

      <Tabs defaultValue="ticket-summary" className="space-y-4">
        <div className="overflow-x-auto">
          <TabsList className="h-10 w-full sm:w-auto">
            <TabsTrigger value="ticket-summary" className="gap-1.5 text-xs sm:text-sm"><FileText className="h-4 w-4" />Ticket Summary</TabsTrigger>
            <TabsTrigger value="technician" className="gap-1.5 text-xs sm:text-sm"><Users className="h-4 w-4" />Technician</TabsTrigger>
            <TabsTrigger value="sla" className="gap-1.5 text-xs sm:text-sm"><ShieldCheck className="h-4 w-4" />SLA</TabsTrigger>
            <TabsTrigger value="assets" className="gap-1.5 text-xs sm:text-sm"><Database className="h-4 w-4" />Assets</TabsTrigger>
            <TabsTrigger value="warranty" className="gap-1.5 text-xs sm:text-sm"><FileWarning className="h-4 w-4" />Warranty</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="ticket-summary"><TicketSummaryReport /></TabsContent>
        <TabsContent value="technician"><TechnicianPerformanceReport /></TabsContent>
        <TabsContent value="sla"><SlaComplianceReport /></TabsContent>
        <TabsContent value="assets"><AssetInventoryReport /></TabsContent>
        <TabsContent value="warranty"><WarrantyReport /></TabsContent>
      </Tabs>
    </div>
  );
}
