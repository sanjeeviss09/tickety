import { create } from 'zustand';
import api from '../lib/api';

export interface AssetCategory {
  id: string;
  name: string;
}

export interface Asset {
  id: string;
  asset_code: string;
  name: string;
  category_id?: string;
  category?: AssetCategory;
  brand?: string;
  model?: string;
  serial_number?: string;
  purchase_date?: string;
  purchase_cost?: number;
  vendor?: string;
  status: string;
  condition: string;
  unit?: string;
  department?: string;
  location?: string;
  notes?: string;
  created_at: string;
  assignments?: any[];
  warranty?: any;
  maintenance?: any[];
  documents?: any[];
  history?: any[];
}

interface AssetState {
  assets: Asset[];
  categories: AssetCategory[];
  currentAsset: Asset | null;
  loading: boolean;
  filters: any;
  fetchAssets: (filters?: any) => Promise<void>;
  fetchAssetById: (id: string) => Promise<void>;
  createAsset: (data: any) => Promise<void>;
  updateAsset: (id: string, data: any) => Promise<void>;
  fetchCategories: () => Promise<void>;
}

export const useAssetStore = create<AssetState>((set, get) => ({
  assets: [],
  categories: [],
  currentAsset: null,
  loading: false,
  filters: {},

  fetchAssets: async (filters = {}) => {
    set({ loading: true, filters });
    try {
      const response = await api.get('/assets', { params: filters });
      if (response.data.status === 'success') {
        set({ assets: response.data.data });
      }
    } catch (error) {
      console.error('Error fetching assets:', error);
    } finally {
      set({ loading: false });
    }
  },

  fetchAssetById: async (id) => {
    set({ loading: true });
    try {
      const response = await api.get(`/assets/${id}`);
      if (response.data.status === 'success') {
        set({ currentAsset: response.data.data });
      }
    } catch (error) {
      console.error('Error fetching asset details:', error);
    } finally {
      set({ loading: false });
    }
  },

  createAsset: async (data) => {
    set({ loading: true });
    try {
      const response = await api.post('/assets', data);
      if (response.data.status === 'success') {
        await get().fetchAssets(get().filters);
      }
    } catch (error) {
      console.error('Error creating asset:', error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  updateAsset: async (id, data) => {
    set({ loading: true });
    try {
      const response = await api.patch(`/assets/${id}`, data);
      if (response.data.status === 'success') {
        await get().fetchAssetById(id);
        await get().fetchAssets(get().filters);
      }
    } catch (error) {
      console.error('Error updating asset:', error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  fetchCategories: async () => {
    try {
      // In a real app we'd fetch from an endpoint, but for now we'll fetch from supabase directly or a specific endpoint
      // We can also fetch from /categories if they are the same, but the DB has asset_categories.
      // We should probably create a quick endpoint in backend or fetch directly if RLS allows.
      const { data } = await api.get('/assets/categories'); // Let's pretend we have this endpoint or add it later
      if (data?.status === 'success') {
        set({ categories: data.data });
      }
    } catch (error) {
      console.error('Error fetching asset categories:', error);
    }
  }
}));
