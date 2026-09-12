import { create } from 'zustand';
import api from '../lib/api';

interface DynamicField {
  id: string;
  field_name: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
  options?: string[];
  order_index: number;
}

export interface ServiceCatalogItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  approval_type: string;
  sla_hours?: number;
  dynamic_form_fields: DynamicField[];
}

interface ServiceCatalogState {
  services: ServiceCatalogItem[];
  loading: boolean;
  error: string | null;
  fetchServices: () => Promise<void>;
  submitRequest: (serviceId: string, formData: any) => Promise<void>;
}

export const useServiceCatalogStore = create<ServiceCatalogState>((set) => ({
  services: [],
  loading: false,
  error: null,

  fetchServices: async () => {
    set({ loading: true, error: null });
    try {
      const response = await api.get('/services');
      set({ services: response.data.data });
    } catch (error: any) {
      set({ error: error.response?.data?.message || 'Failed to fetch services' });
    } finally {
      set({ loading: false });
    }
  },

  submitRequest: async (serviceId, formData) => {
    set({ loading: true, error: null });
    try {
      await api.post('/services/requests', {
        service_id: serviceId,
        form_data: formData
      });
    } catch (error: any) {
      set({ error: error.response?.data?.message || 'Failed to submit service request' });
      throw error;
    } finally {
      set({ loading: false });
    }
  }
}));
