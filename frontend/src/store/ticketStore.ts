import { create } from 'zustand';
import api from '../lib/api';
import { supabase } from '../lib/supabase';

interface TicketState {
  tickets: any[];
  categories: any[];
  loading: boolean;
  error: string | null;
  filters: any;
  fetchTickets: (filters?: any) => Promise<void>;
  fetchCategories: () => Promise<void>;
  subscribeToTickets: (_userId: string, _role: string) => void;
  unsubscribeFromTickets: () => void;
  deleteTicket: (id: string) => Promise<void>;
}

let subscription: any = null;

export const useTicketStore = create<TicketState>((set, get) => ({
  tickets: [],
  categories: [],
  loading: false,
  error: null,
  filters: {},
  
  fetchTickets: async (filters = {}) => {
    set({ loading: true, error: null, filters });
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.priority) params.append('priority', filters.priority);
      
      const response = await api.get(`/tickets?${params.toString()}`);
      if (response.data.status === 'success') {
        set({ tickets: response.data.data });
      }
    } catch (error: any) {
      console.error('Error fetching tickets:', error);
      set({ error: error.response?.data?.message || error.message || 'Failed to fetch tickets' });
    } finally {
      set({ loading: false });
    }
  },

  deleteTicket: async (id: string) => {
    try {
      const response = await api.delete(`/tickets/${id}`);
      if (response.data.status === 'success') {
        set(state => ({ tickets: state.tickets.filter(t => t.id !== id) }));
      }
    } catch (error) {
      console.error('Error deleting ticket:', error);
      throw error;
    }
  },

  fetchCategories: async () => {
    try {
      const response = await api.get('/categories');
      if (response.data.status === 'success') {
        set({ categories: response.data.data });
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  },

  subscribeToTickets: (_userId: string, _role: string) => {
    if (subscription) {
      supabase.removeChannel(subscription);
    }

    // A real implementation might use more complex filters based on role
    // For now, we listen to all ticket changes and refetch to get joined data
    subscription = supabase
      .channel('public:tickets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, (_payload) => {
        // Just refetch the list to ensure all joins (assignee names, etc) are up to date
        // In a highly optimized app, you'd patch the specific ticket in state.
        get().fetchTickets(get().filters);
      })
      .subscribe();
  },

  unsubscribeFromTickets: () => {
    if (subscription) {
      supabase.removeChannel(subscription);
      subscription = null;
    }
  }
}));
