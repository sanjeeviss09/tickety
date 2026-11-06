import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';
import { useAuthStore } from '../../../store/authStore';
import { supabase } from '../../../lib/supabase';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export interface TicketFilters {
  status?: string;
  priority?: string;
  sla?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export function useTickets(filters: TicketFilters = {}) {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();

  const queryKey = ['tickets', filters];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.priority) params.append('priority', filters.priority);
      if (filters.sla) params.append('sla', filters.sla);
      if (filters.search) params.append('search', filters.search);
      params.append('page', (filters.page || 0).toString());
      params.append('limit', (filters.limit || 20).toString());

      const res = await api.get(`/tickets?${params.toString()}`);
      if (res.data.status !== 'success') throw new Error(res.data.message);
      return res.data;
    },
    staleTime: 60_000,
    enabled: !!profile, // Only run if authenticated
  });

  // Setup optimized realtime subscription
  useEffect(() => {
    if (!profile) return;

    // We only subscribe to changes we care about. 
    // To keep it simple but optimized, we listen to all ticket updates and invalidate the query cache
    // instead of refetching everything blindly in the background.
    const channel = supabase
      .channel('tickets-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, (payload) => {
        // Invalidate the cache to trigger a refetch ONLY when the user views the page
        // or trigger an immediate refetch if the component is mounted
        queryClient.invalidateQueries({ queryKey: ['tickets'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, queryClient]);

  return query;
}
