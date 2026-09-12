import { useEffect } from 'react';
import { useAnalyticsStore } from '../../../store/analyticsStore';
import { TicketTrendChart } from '../../../components/analytics/TicketTrendChart';
import { DistributionPieChart } from '../../../components/analytics/DistributionPieChart';
import { DistributionBarChart } from '../../../components/analytics/DistributionBarChart';
import { TechnicianRankTable } from '../../../components/analytics/TechnicianRankTable';
import { KpiCard } from '../../../components/analytics/KpiCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, BarChart2, Users, Building2 } from 'lucide-react';

export function AnalyticsPage() {
  const {
    kpis, ticketTrends, ticketDistribution, assetDistribution, technicianPerformance, departmentStats, loading,
    fetchKpis, fetchTicketTrends, fetchTicketDistribution, fetchAssetDistribution, fetchTechnicianPerformance, fetchDepartmentStats
  } = useAnalyticsStore();

  useEffect(() => {
    fetchKpis();
    fetchTicketTrends('month');
    fetchTicketDistribution('status');
    fetchAssetDistribution('status');
    fetchTechnicianPerformance();
    fetchDepartmentStats();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-1">Deep-dive analytics for tickets, assets, technicians, and departments.</p>
      </div>

      {/* KPI strip */}
      {kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard title="Mean Time to Respond" value={kpis.mttr} format="hours" colorClass="text-blue-600" bgClass="bg-blue-50" />
          <KpiCard title="Mean Time to Resolve" value={kpis.mttResolve} format="hours" colorClass="text-violet-600" bgClass="bg-violet-50" />
          <KpiCard title="Ticket Closure Rate" value={kpis.closureRate} format="percent" colorClass="text-green-600" bgClass="bg-green-50" />
          <KpiCard title="Asset Utilization" value={kpis.assetUtilization} format="percent" colorClass="text-cyan-600" bgClass="bg-cyan-50" />
        </div>
      )}

      <Tabs defaultValue="tickets">
        <TabsList className="h-10">
          <TabsTrigger value="tickets" className="gap-2"><Activity className="h-4 w-4" />Tickets</TabsTrigger>
          <TabsTrigger value="assets" className="gap-2"><BarChart2 className="h-4 w-4" />Assets</TabsTrigger>
          <TabsTrigger value="technicians" className="gap-2"><Users className="h-4 w-4" />Technicians</TabsTrigger>
          <TabsTrigger value="departments" className="gap-2"><Building2 className="h-4 w-4" />Departments</TabsTrigger>
        </TabsList>

        {/* ── Tickets Tab ── */}
        <TabsContent value="tickets" className="space-y-6 mt-6">
          <TicketTrendChart data={ticketTrends} onPeriodChange={fetchTicketTrends} loading={loading && ticketTrends.length === 0} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DistributionPieChart
              data={ticketDistribution}
              title="Ticket Distribution"
              subtitle="Switch grouping below"
              groupByOptions={[
                { label: 'Status', value: 'status' },
                { label: 'Priority', value: 'priority' },
                { label: 'Category', value: 'category' },
                { label: 'Unit', value: 'unit' },
                { label: 'Department', value: 'department' },
                { label: 'Technician', value: 'technician' },
              ]}
              onGroupByChange={fetchTicketDistribution}
            />
            <DistributionBarChart
              data={ticketDistribution}
              title="Ticket Count by Group"
              groupByOptions={[
                { label: 'Status', value: 'status' },
                { label: 'Priority', value: 'priority' },
                { label: 'Category', value: 'category' },
                { label: 'Unit', value: 'unit' },
                { label: 'Technician', value: 'technician' },
              ]}
              onGroupByChange={fetchTicketDistribution}
              horizontal
            />
          </div>
        </TabsContent>

        {/* ── Assets Tab ── */}
        <TabsContent value="assets" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DistributionPieChart
              data={assetDistribution}
              title="Asset Distribution"
              groupByOptions={[
                { label: 'Status', value: 'status' },
                { label: 'Category', value: 'category' },
                { label: 'Unit', value: 'unit' },
                { label: 'Department', value: 'department' },
              ]}
              onGroupByChange={fetchAssetDistribution}
            />
            <DistributionBarChart
              data={assetDistribution}
              title="Asset Count by Group"
              groupByOptions={[
                { label: 'Status', value: 'status' },
                { label: 'Category', value: 'category' },
                { label: 'Unit', value: 'unit' },
              ]}
              onGroupByChange={fetchAssetDistribution}
            />
          </div>
        </TabsContent>

        {/* ── Technicians Tab ── */}
        <TabsContent value="technicians" className="space-y-6 mt-6">
          <TechnicianRankTable data={technicianPerformance} loading={loading && technicianPerformance.length === 0} />
          <DistributionBarChart
            data={technicianPerformance.map(t => ({ name: t.name, value: t.resolved }))}
            title="Tickets Resolved by Technician"
            subtitle="Top performers"
            horizontal
          />
        </TabsContent>

        {/* ── Departments Tab ── */}
        <TabsContent value="departments" className="space-y-6 mt-6">
          <DistributionBarChart
            data={departmentStats.map(d => ({ name: d.name, value: d.totalTickets }))}
            title="Tickets by Department"
            horizontal
          />
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-5 py-3">Department</th>
                  <th className="text-right px-5 py-3">Total Tickets</th>
                  <th className="text-right px-5 py-3">Open</th>
                  <th className="text-right px-5 py-3">Resolved</th>
                  <th className="text-right px-5 py-3">Total Assets</th>
                </tr>
              </thead>
              <tbody>
                {departmentStats.map(d => (
                  <tr key={d.name} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-medium">{d.name}</td>
                    <td className="px-5 py-3 text-right">{d.totalTickets}</td>
                    <td className="px-5 py-3 text-right text-blue-600">{d.openTickets}</td>
                    <td className="px-5 py-3 text-right text-green-600">{d.resolvedTickets}</td>
                    <td className="px-5 py-3 text-right">{d.totalAssets}</td>
                  </tr>
                ))}
                {departmentStats.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">No department data available</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
