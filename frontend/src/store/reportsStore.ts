import { create } from 'zustand';
import api from '../lib/api';

interface ReportsState {
  ticketSummary: any[];
  technicianReport: any[];
  assetInventory: any[];
  slaReport: any[];
  warrantyReport: any[];
  templates: any[];
  scheduledReports: any[];
  loading: boolean;
  filters: any;
  fetchTicketSummary: (filters?: any) => Promise<void>;
  fetchTechnicianReport: (filters?: any) => Promise<void>;
  fetchAssetInventory: (filters?: any) => Promise<void>;
  fetchSlaReport: (filters?: any) => Promise<void>;
  fetchWarrantyReport: (filters?: any) => Promise<void>;
  fetchTemplates: () => Promise<void>;
  saveTemplate: (data: any) => Promise<void>;
  fetchScheduledReports: () => Promise<void>;
  createScheduledReport: (data: any) => Promise<void>;
  updateScheduledReport: (id: string, data: any) => Promise<void>;
  deleteScheduledReport: (id: string) => Promise<void>;
}

export const useReportsStore = create<ReportsState>((set, get) => ({
  ticketSummary: [],
  technicianReport: [],
  assetInventory: [],
  slaReport: [],
  warrantyReport: [],
  templates: [],
  scheduledReports: [],
  loading: false,
  filters: {},

  fetchTicketSummary: async (filters = {}) => {
    set({ loading: true, filters });
    try {
      const res = await api.get('/reports/ticket-summary', { params: filters });
      if (res.data.status === 'success') set({ ticketSummary: res.data.data });
    } catch (e) { console.error(e); }
    finally { set({ loading: false }); }
  },

  fetchTechnicianReport: async (filters = {}) => {
    set({ loading: true });
    try {
      const res = await api.get('/reports/technician-performance', { params: filters });
      if (res.data.status === 'success') set({ technicianReport: res.data.data });
    } catch (e) { console.error(e); }
    finally { set({ loading: false }); }
  },

  fetchAssetInventory: async (filters = {}) => {
    set({ loading: true });
    try {
      const res = await api.get('/reports/asset-inventory', { params: filters });
      if (res.data.status === 'success') set({ assetInventory: res.data.data });
    } catch (e) { console.error(e); }
    finally { set({ loading: false }); }
  },

  fetchSlaReport: async (filters = {}) => {
    set({ loading: true });
    try {
      const res = await api.get('/reports/sla-compliance', { params: filters });
      if (res.data.status === 'success') set({ slaReport: res.data.data });
    } catch (e) { console.error(e); }
    finally { set({ loading: false }); }
  },

  fetchWarrantyReport: async (filters = {}) => {
    set({ loading: true });
    try {
      const res = await api.get('/reports/warranty', { params: filters });
      if (res.data.status === 'success') set({ warrantyReport: res.data.data });
    } catch (e) { console.error(e); }
    finally { set({ loading: false }); }
  },

  fetchTemplates: async () => {
    try {
      const res = await api.get('/reports/templates');
      if (res.data.status === 'success') set({ templates: res.data.data });
    } catch (e) { console.error(e); }
  },

  saveTemplate: async (data) => {
    try {
      await api.post('/reports/templates', data);
      await get().fetchTemplates();
    } catch (e) { console.error(e); throw e; }
  },

  fetchScheduledReports: async () => {
    try {
      const res = await api.get('/reports/scheduled');
      if (res.data.status === 'success') set({ scheduledReports: res.data.data });
    } catch (e) { console.error(e); }
  },

  createScheduledReport: async (data) => {
    try {
      await api.post('/reports/scheduled', data);
      await get().fetchScheduledReports();
    } catch (e) { console.error(e); throw e; }
  },

  updateScheduledReport: async (id, data) => {
    try {
      await api.put(`/reports/scheduled/${id}`, data);
      await get().fetchScheduledReports();
    } catch (e) { console.error(e); throw e; }
  },

  deleteScheduledReport: async (id) => {
    try {
      await api.delete(`/reports/scheduled/${id}`);
      await get().fetchScheduledReports();
    } catch (e) { console.error(e); throw e; }
  },
}));
