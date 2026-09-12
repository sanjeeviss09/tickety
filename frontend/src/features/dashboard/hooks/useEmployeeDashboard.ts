import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';

// ─── My Tickets Summary ────────────────────────────────────────────────────
export function useMyTicketsSummary() {
  const { profile } = useAuthStore();
  const userId = profile?.id;

  return useQuery({
    queryKey: ['my-tickets-summary', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('tickets')
        .select('id, status, due_date, created_at')
        .eq('created_by', userId);

      if (error) throw error;

      const { count: solvedCount, error: sessionErr } = await supabase
        .from('self_service_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('employee_id', userId)
        .eq('status', 'Solved');
      
      if (sessionErr) console.error(sessionErr);

      const now = new Date();
      const activeStatuses = ['Open', 'Assigned', 'In Progress', 'Waiting for User', 'Awaiting Employee Confirmation', 'Reopened'];

      const summary = {
        total: data.length,
        open: data.filter(t => t.status === 'Open').length,
        assigned: data.filter(t => t.status === 'Assigned').length,
        inProgress: data.filter(t => t.status === 'In Progress').length,
        awaitingConfirmation: data.filter(t => t.status === 'Awaiting Employee Confirmation').length,
        waitingForUser: data.filter(t => t.status === 'Waiting for User').length,
        resolved: data.filter(t => t.status === 'Resolved').length,
        closed: data.filter(t => t.status === 'Closed').length,
        cancelled: data.filter(t => t.status === 'Cancelled').length,
        reopened: data.filter(t => t.status === 'Reopened').length,
        overdue: data.filter(t =>
          activeStatuses.includes(t.status) &&
          t.due_date &&
          new Date(t.due_date) < now
        ).length,
        selfServiceSolved: solvedCount || 0,
      };
      return summary;
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

// ─── My Recent Tickets ─────────────────────────────────────────────────────
export function useMyRecentTickets(limit = 8) {
  const { profile } = useAuthStore();
  const userId = profile?.id;

  return useQuery({
    queryKey: ['my-recent-tickets', userId, limit],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          id, ticket_number, subject, priority, status, due_date,
          created_at, updated_at,
          assignee:profiles!assigned_to(full_name)
        `)
        .eq('created_by', userId)
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

// ─── My Pending Actions ────────────────────────────────────────────────────
export function useMyPendingActions() {
  const { profile } = useAuthStore();
  const userId = profile?.id;

  return useQuery({
    queryKey: ['my-pending-actions', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('tickets')
        .select('id, ticket_number, subject, status, updated_at')
        .eq('created_by', userId)
        .in('status', ['Waiting for User', 'Reopened', 'Resolved'])
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

// ─── My Assets ────────────────────────────────────────────────────────────
export function useMyAssets() {
  const { profile } = useAuthStore();
  const userId = profile?.id;

  return useQuery({
    queryKey: ['my-assets', userId],
    queryFn: async () => {
      if (!userId) return [];
      // Find active assignments for this user
      const { data: assignments, error: aErr } = await supabase
        .from('asset_assignments')
        .select('asset_id, assigned_at')
        .eq('assigned_to', userId)
        .eq('status', 'Active');

      if (aErr) throw aErr;
      if (!assignments || assignments.length === 0) return [];

      const assetIds = assignments.map(a => a.asset_id);

      const { data: assets, error: assetErr } = await supabase
        .from('assets')
        .select(`
          id, asset_code, name, brand, model, status, condition, location,
          category:asset_categories(name),
          warranty:asset_warranty(warranty_end_date, amc_end_date)
        `)
        .in('id', assetIds);

      if (assetErr) throw assetErr;
      return assets ?? [];
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

// ─── My Notifications ─────────────────────────────────────────────────────
export function useMyNotifications() {
  const { profile } = useAuthStore();
  const userId = profile?.id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['my-notifications', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('notifications')
        .select('id, title, message, is_read, type, related_id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
    staleTime: 10_000,
  });

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['my-notifications', userId] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, queryClient]);

  return query;
}

// ─── My Service Requests ──────────────────────────────────────────────────
export function useMyServiceRequests() {
  const { profile } = useAuthStore();
  const userId = profile?.id;

  return useQuery({
    queryKey: ['my-service-requests', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('service_requests')
        .select(`
          id, request_number, status, created_at, updated_at,
          service:service_catalog(name)
        `)
        .eq('requester_id', userId)
        .order('updated_at', { ascending: false })
        .limit(5);

      if (error) {
        // Table may not exist yet
        if ((error as any).code === 'PGRST116' || error.message?.includes('does not exist')) return [];
        throw error;
      }
      return data ?? [];
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

// ─── Popular KB Articles ──────────────────────────────────────────────────
export function usePopularArticles(limit = 4) {
  return useQuery({
    queryKey: ['popular-kb-articles', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('knowledge_articles')
        .select('id, title, slug, views_count, helpful_count, knowledge_categories(name)')
        .eq('status', 'Published')
        .order('views_count', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });
}

// ─── Realtime ticket updates ───────────────────────────────────────────────
export function useMyTicketsRealtime() {
  const { profile } = useAuthStore();
  const userId = profile?.id;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`tickets-${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tickets',
        filter: `created_by=eq.${userId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['my-tickets-summary', userId] });
        queryClient.invalidateQueries({ queryKey: ['my-recent-tickets', userId] });
        queryClient.invalidateQueries({ queryKey: ['my-pending-actions', userId] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, queryClient]);
}

// ─── Realtime asset updates ────────────────────────────────────────────────
export function useMyAssetsRealtime() {
  const { profile } = useAuthStore();
  const userId = profile?.id;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`asset-assignments-${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'asset_assignments',
        filter: `assigned_to=eq.${userId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['my-assets', userId] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, queryClient]);
}

// ─── My tickets awaiting confirmation ─────────────────────────────────────────
export function useMyAwaitingConfirmations() {
  const { profile } = useAuthStore();
  const userId = profile?.id;

  return useQuery({
    queryKey: ['my-awaiting-confirmations', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('tickets')
        .select('id, ticket_number, subject, status, priority, due_date, technician_completed_at, assignee:profiles!tickets_assigned_to_fkey(full_name, profile_picture_url)')
        .eq('created_by', userId)
        .eq('status', 'Awaiting Employee Confirmation')
        .order('technician_completed_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
    staleTime: 15_000,
  });
}
