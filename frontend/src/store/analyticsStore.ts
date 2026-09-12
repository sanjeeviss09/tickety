import { create } from 'zustand';
import api from '../lib/api';

interface AnalyticsSummary {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  closedTickets: number;
  criticalTickets: number;
  overdueTickets: number;
  slaCompliance: number;
  slaBreaches: number;
  avgResolutionHours: number;
  activeAssets: number;
  totalAssets: number;
  assetsUnderMaintenance: number;
  activeEmployees: number;
  warrantyExpiringSoon: number;
  amcExpiringSoon: number;
}

interface KpiData {
  mttr: number;
  mttResolve: number;
  closureRate: number;
  overdueCount: number;
  assetUtilization: number;
  totalTickets: number;
  resolvedTickets: number;
  openTickets: number;
}

interface AnalyticsState {
  summary: AnalyticsSummary | null;
  kpis: KpiData | null;
  ticketTrends: any[];
  ticketDistribution: any[];
  assetDistribution: any[];
  technicianPerformance: any[];
  departmentStats: any[];
  loading: boolean;
  error: string | null;
  fetchSummary: () => Promise<void>;
  fetchKpis: () => Promise<void>;
  fetchTicketTrends: (period?: string) => Promise<void>;
  fetchTicketDistribution: (groupBy?: string) => Promise<void>;
  fetchAssetDistribution: (groupBy?: string) => Promise<void>;
  fetchTechnicianPerformance: () => Promise<void>;
  fetchDepartmentStats: () => Promise<void>;
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  summary: null,
  kpis: null,
  ticketTrends: [],
  ticketDistribution: [],
  assetDistribution: [],
  technicianPerformance: [],
  departmentStats: [],
  loading: false,
  error: null,

  fetchSummary: async () => {
    set({ loading: true, error: null });
    try {
      const res = await api.get('/analytics/summary');
      if (res.data.status === 'success') set({ summary: res.data.data });
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      set({ loading: false });
    }
  },

  fetchKpis: async () => {
    try {
      const res = await api.get('/analytics/kpis');
      if (res.data.status === 'success') set({ kpis: res.data.data });
    } catch (e: any) { console.error(e); }
  },

  fetchTicketTrends: async (period = 'month') => {
    try {
      const res = await api.get('/analytics/ticket-trends', { params: { period } });
      if (res.data.status === 'success') set({ ticketTrends: res.data.data });
    } catch (e: any) { console.error(e); }
  },

  fetchTicketDistribution: async (groupBy = 'status') => {
    try {
      const res = await api.get('/analytics/ticket-distribution', { params: { groupBy } });
      if (res.data.status === 'success') set({ ticketDistribution: res.data.data });
    } catch (e: any) { console.error(e); }
  },

  fetchAssetDistribution: async (groupBy = 'status') => {
    try {
      const res = await api.get('/analytics/asset-distribution', { params: { groupBy } });
      if (res.data.status === 'success') set({ assetDistribution: res.data.data });
    } catch (e: any) { console.error(e); }
  },

  fetchTechnicianPerformance: async () => {
    try {
      const res = await api.get('/analytics/technician-performance');
      if (res.data.status === 'success') set({ technicianPerformance: res.data.data });
    } catch (e: any) { console.error(e); }
  },

  fetchDepartmentStats: async () => {
    try {
      const res = await api.get('/analytics/department-stats');
      if (res.data.status === 'success') set({ departmentStats: res.data.data });
    } catch (e: any) { console.error(e); }
  },
}));
