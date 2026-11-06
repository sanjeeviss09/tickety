/**
 * useTechnicianDashboard.ts
 * All TanStack Query hooks for the Technician Dashboard.
 * All Supabase queries are scoped to the authenticated technician.
 * Realtime subscriptions update relevant queries when data changes.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import api from '../../../lib/api';
import { useAuthStore } from '../../../store/authStore';

// ─── Types ──────────────────────────────────────────────────────────────────
export interface TechWorkloadSummary {
  totalAssigned: number;
  unaccepted: number;
  inProgress: number;
  waitingForUser: number;
  reopened?: number;
  resolvedToday: number;
  closedToday: number;
  overdue: number;
  critical: number;
}

export interface TechPerformance {
  totalAssigned: number;
  totalResolved: number;
  avgResolutionHours: number;
  slaCompliance: number;
  reopened: number;
  closed: number;
  pendingActive: number;
  avgRating?: number | null;
  totalRatings?: number;
}

export interface TechTrendPoint {
  period: string;
  assigned: number;
  resolved: number;
  pending: number;
}

// ─── Ticket query columns used in all list views ────────────────────────────
const TICKET_SELECT = `
  id, ticket_number, subject, priority, status, due_date,
  created_at, updated_at, assigned_at, resolution_date, reopened_at, reopen_count,
  creator:profiles!tickets_created_by_fkey(id, full_name, employee_id, profile_picture_url),
  ticket_categories(name),
  departments(name),
  units(name),
  confirmations:ticket_resolution_confirmations(status, rejection_reason, responded_at),
  ratings:ticket_ratings(rating, feedback_comment, submitted_at)
`;

// ─── Helper ──────────────────────────────────────────────────────────────────
function getTechId() {
  const { profile } = useAuthStore.getState();
  return profile?.id ?? null;
}

// ─── 1. Dashboard summary + performance + trend (single API call) ────────────
export function useTechnicianDashboardData() {
  return useQuery({
    queryKey: ['tech-dashboard-data'],
    queryFn: async () => {
      const techId = getTechId();
      const [res, ratingsRes] = await Promise.all([
        api.get('/analytics/technician-dashboard'),
        techId
          ? supabase
              .from('ticket_ratings')
              .select('ticket_id, rating, submitted_at')
              .eq('technician_id', techId)
              .order('submitted_at', { ascending: true })
          : Promise.resolve({ data: [] as any[] }),
      ]);
      if (res.data.status !== 'success') throw new Error(res.data.message);
      const payload = res.data.data as {
        summary: TechWorkloadSummary;
        performance: TechPerformance;
        trend: TechTrendPoint[];
      };

      const ticketMap = new Map<string, number>();
      (ratingsRes.data ?? []).forEach((r: any) => {
        const val = Number(r.rating);
        if (r.ticket_id && !isNaN(val) && val >= 1 && val <= 5) {
          ticketMap.set(r.ticket_id, val);
        }
      });
      const vals = Array.from(ticketMap.values());
      const avgRating = vals.length > 0
        ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10
        : null;

      return {
        ...payload,
        performance: payload.performance
          ? {
              ...payload.performance,
              avgRating: payload.performance.avgRating ?? avgRating,
              totalRatings: payload.performance.totalRatings ?? vals.length,
            }
          : payload.performance,
      };
    },
    staleTime: 30_000,
    retry: 2,
  });
}

// ─── 2. Active assigned tickets (paginated + filterable) ─────────────────────
export interface ActiveTicketFilters {
  status?: string;
  priority?: string;
  search?: string;
}
const PAGE_SIZE = 15;

export function useTechnicianActiveTickets(filters: ActiveTicketFilters = {}, page = 0) {
  const techId = getTechId();

  return useQuery({
    queryKey: ['tech-active-tickets', techId, filters, page],
    queryFn: async () => {
      if (!techId) return { data: [], count: 0 };

      let query = supabase
        .from('tickets')
        .select(TICKET_SELECT, { count: 'exact' })
        .eq('assigned_to', techId)
        .not('status', 'in', '("Closed","Cancelled")')
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('priority', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (filters.status && filters.status !== 'All') {
        query = query.eq('status', filters.status);
      }
      if (filters.priority) {
        query = query.eq('priority', filters.priority);
      }
      if (filters.search) {
        query = query.or(
          `subject.ilike.%${filters.search}%,ticket_number.ilike.%${filters.search}%`
        );
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data ?? [], count: count ?? 0 };
    },
    enabled: !!techId,
    staleTime: 20_000,
  });
}

// ─── 3. Today's Work ─────────────────────────────────────────────────────────
export function useTodaysWork() {
  const techId = getTechId();
  const now = new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

  return useQuery({
    queryKey: ['tech-todays-work', techId],
    queryFn: async () => {
      if (!techId) return [];
      const activeStatuses = ['Open', 'Assigned', 'In Progress', 'Waiting for User', 'Reopened'];

      const { data, error } = await supabase
        .from('tickets')
        .select(TICKET_SELECT)
        .eq('assigned_to', techId)
        .in('status', activeStatuses)
        .or(`due_date.lte.${todayEnd},priority.eq.Critical,status.eq.Reopened,status.eq.In Progress,status.eq.Assigned`)
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(20);

      if (error) throw error;
      const list = data ?? [];
      // Sort Reopened and Critical tickets to the top
      return list.sort((a: any, b: any) => {
        if (a.status === 'Reopened' && b.status !== 'Reopened') return -1;
        if (b.status === 'Reopened' && a.status !== 'Reopened') return 1;
        if (a.priority === 'Critical' && b.priority !== 'Critical') return -1;
        if (b.priority === 'Critical' && a.priority !== 'Critical') return 1;
        return 0;
      });
    },
    enabled: !!techId,
    staleTime: 20_000,
  });
}

// ─── 3b. Reopened / Rejected Tickets ─────────────────────────────────────────
export function useReopenedTickets() {
  const techId = getTechId();

  return useQuery({
    queryKey: ['tech-reopened-tickets', techId],
    queryFn: async () => {
      if (!techId) return [];

      const { data, error } = await supabase
        .from('tickets')
        .select(TICKET_SELECT)
        .eq('assigned_to', techId)
        .eq('status', 'Reopened')
        .order('reopened_at', { ascending: false, nullsFirst: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!techId,
    staleTime: 10_000,
  });
}

// ─── 4. SLA Risk tickets ──────────────────────────────────────────────────────
export function useSlaRiskTickets() {
  const techId = getTechId();

  return useQuery({
    queryKey: ['tech-sla-risk', techId],
    queryFn: async () => {
      if (!techId) return { breached: [], approaching: [], onTrack: [] };

      const activeStatuses = ['Open', 'Assigned', 'In Progress', 'Waiting for User', 'Reopened'];

      const { data, error } = await supabase
        .from('tickets')
        .select(TICKET_SELECT)
        .eq('assigned_to', techId)
        .in('status', activeStatuses)
        .not('due_date', 'is', null)
        .order('due_date', { ascending: true });

      if (error) throw error;

      const now = Date.now();
      const breached: any[] = [];
      const approaching: any[] = [];
      const onTrack: any[] = [];

      (data ?? []).forEach(t => {
        if (!t.due_date) return;
        const diffH = (new Date(t.due_date).getTime() - now) / 3_600_000;
        if (diffH < 0) breached.push(t);
        else if (diffH < 4) approaching.push(t);
        else onTrack.push(t);
      });

      return { breached, approaching, onTrack };
    },
    enabled: !!techId,
    staleTime: 20_000,
  });
}

// ─── 5. Critical tickets ──────────────────────────────────────────────────────
export function useCriticalTickets() {
  const techId = getTechId();

  return useQuery({
    queryKey: ['tech-critical', techId],
    queryFn: async () => {
      if (!techId) return [];
      const activeStatuses = ['Open', 'Assigned', 'In Progress', 'Waiting for User', 'Reopened'];

      const { data, error } = await supabase
        .from('tickets')
        .select(TICKET_SELECT)
        .eq('assigned_to', techId)
        .eq('priority', 'Critical')
        .in('status', activeStatuses)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!techId,
    staleTime: 20_000,
  });
}

// ─── 6. Recent Assignments ────────────────────────────────────────────────────
export function useRecentAssignments() {
  const techId = getTechId();
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 3_600_000).toISOString();

  return useQuery({
    queryKey: ['tech-recent-assignments', techId],
    queryFn: async () => {
      if (!techId) return [];

      const { data, error } = await supabase
        .from('tickets')
        .select(TICKET_SELECT)
        .eq('assigned_to', techId)
        .gte('assigned_at', threeDaysAgo)
        .order('assigned_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!techId,
    staleTime: 20_000,
  });
}

// ─── 7. Waiting for User ─────────────────────────────────────────────────────
export function useWaitingForUserTickets() {
  const techId = getTechId();

  return useQuery({
    queryKey: ['tech-waiting-for-user', techId],
    queryFn: async () => {
      if (!techId) return [];

      const { data, error } = await supabase
        .from('tickets')
        .select(TICKET_SELECT)
        .eq('assigned_to', techId)
        .eq('status', 'Waiting for User')
        .order('updated_at', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!techId,
    staleTime: 20_000,
  });
}

// ─── 8. Recently Resolved ─────────────────────────────────────────────────────
export function useRecentlyResolvedTickets() {
  const techId = getTechId();
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 3_600_000).toISOString();

  return useQuery({
    queryKey: ['tech-recently-resolved', techId],
    queryFn: async () => {
      if (!techId) return [];

      const { data, error } = await supabase
        .from('tickets')
        .select(TICKET_SELECT)
        .eq('assigned_to', techId)
        .in('status', ['Resolved', 'Closed'])
        .gte('resolution_date', twoDaysAgo)
        .order('resolution_date', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!techId,
    staleTime: 30_000,
  });
}

// ─── 9. Notifications ────────────────────────────────────────────────────────
export function useTechnicianNotifications() {
  const { profile } = useAuthStore();
  const userId = profile?.id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['tech-notifications', userId],
    queryFn: async () => {
      if (!userId) return [];
      try {
        const res = await api.get('/notifications');
        if (res.data?.data) return (res.data.data as any[]).slice(0, 15);
      } catch {
        // fallback to direct supabase query
      }
      const { data, error } = await supabase
        .from('notifications')
        .select('id, title, message, is_read, link, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(15);

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`tech-notifications-${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['tech-notifications', userId] });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, queryClient]);

  return query;
}

// ─── 10. Support Assets ───────────────────────────────────────────────────────
export function useTechnicianSupportAssets() {
  const techId = getTechId();

  return useQuery({
    queryKey: ['tech-support-assets', techId],
    queryFn: async () => {
      if (!techId) return [];

      // Assets linked to open tickets assigned to this technician
      const { data: assignments, error: assErr } = await supabase
        .from('asset_ticket_mapping')
        .select(`
          asset_id,
          ticket:tickets!asset_ticket_mapping_ticket_id_fkey(
            id, ticket_number, status, assigned_to
          )
        `)
        .not('ticket', 'is', null);

      if (assErr) throw assErr;

      // Filter to this technician's active tickets
      const relevant = (assignments ?? []).filter(a => {
        const t = a.ticket as any;
        return t?.assigned_to === techId &&
          !['Closed', 'Cancelled', 'Resolved'].includes(t?.status ?? '');
      });

      if (relevant.length === 0) return [];

      const assetIds = [...new Set(relevant.map(a => a.asset_id))];
      const { data: assets, error: assetErr } = await supabase
        .from('assets')
        .select(`
          id, asset_code, name, brand, model, status, condition, location,
          asset_categories(name),
          asset_warranty(warranty_end_date, amc_end_date)
        `)
        .in('id', assetIds)
        .limit(10);

      if (assetErr) throw assetErr;

      // Attach ticket info to each asset
      return (assets ?? []).map(asset => ({
        ...asset,
        linkedTicket: relevant.find(a => a.asset_id === asset.id)?.ticket ?? null,
      }));
    },
    enabled: !!techId,
    staleTime: 60_000,
  });
}

// ─── 11. Knowledge Base articles ─────────────────────────────────────────────
export function useTechnicianKbArticles(search = '') {
  return useQuery({
    queryKey: ['tech-kb-articles', search],
    queryFn: async () => {
      let query = supabase
        .from('knowledge_articles')
        .select('id, title, slug, views_count, helpful_count, knowledge_categories(name)')
        .eq('status', 'Published');

      if (search) {
        query = query.ilike('title', `%${search}%`);
      } else {
        query = query.order('views_count', { ascending: false });
      }

      const { data, error } = await query.limit(6);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });
}

// ─── 12. Realtime: tickets ────────────────────────────────────────────────────
export function useTechnicianTicketsRealtime() {
  const { profile } = useAuthStore();
  const techId = profile?.id;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!techId) return;

    const channel = supabase
      .channel(`tech-tickets-${techId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tickets',
        filter: `assigned_to=eq.${techId}`,
      }, () => {
        // Invalidate all technician ticket queries
        queryClient.invalidateQueries({ queryKey: ['tech-dashboard-data'] });
        queryClient.invalidateQueries({ queryKey: ['tech-active-tickets', techId] });
        queryClient.invalidateQueries({ queryKey: ['tech-todays-work', techId] });
        queryClient.invalidateQueries({ queryKey: ['tech-reopened-tickets', techId] });
        queryClient.invalidateQueries({ queryKey: ['tech-sla-risk', techId] });
        queryClient.invalidateQueries({ queryKey: ['tech-critical', techId] });
        queryClient.invalidateQueries({ queryKey: ['tech-recent-assignments', techId] });
        queryClient.invalidateQueries({ queryKey: ['tech-waiting-for-user', techId] });
        queryClient.invalidateQueries({ queryKey: ['tech-recently-resolved', techId] });
        queryClient.invalidateQueries({ queryKey: ['tech-awaiting-confirmation', techId] });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['tech-notifications', techId] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [techId, queryClient]);
}

// ─── 13. Accept ticket mutation ───────────────────────────────────────────────
export function useAcceptTicket() {
  const queryClient = useQueryClient();
  const techId = getTechId();

  return useMutation({
    mutationFn: async (ticketId: string) => {
      const res = await api.patch(`/tickets/${ticketId}/status`, { status: 'Accepted' });
      if (res.data.status !== 'success') throw new Error(res.data.message);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tech-dashboard-data'] });
      queryClient.invalidateQueries({ queryKey: ['tech-active-tickets', techId] });
      queryClient.invalidateQueries({ queryKey: ['tech-recent-assignments', techId] });
    },
  });
}

// ─── 14. Update ticket status mutation ───────────────────────────────────────
export function useUpdateTicketStatus() {
  const queryClient = useQueryClient();
  const techId = getTechId();

  return useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: string; status: string }) => {
      const res = await api.patch(`/tickets/${ticketId}/status`, { status });
      if (res.data.status !== 'success') throw new Error(res.data.message);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tech-dashboard-data'] });
      queryClient.invalidateQueries({ queryKey: ['tech-active-tickets', techId] });
      queryClient.invalidateQueries({ queryKey: ['tech-todays-work', techId] });
      queryClient.invalidateQueries({ queryKey: ['tech-sla-risk', techId] });
      queryClient.invalidateQueries({ queryKey: ['tech-waiting-for-user', techId] });
      queryClient.invalidateQueries({ queryKey: ['tech-recently-resolved', techId] });
    },
  });
}

// ─── 15. Mark notification read ───────────────────────────────────────────────
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const techId = getTechId();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const res = await api.patch(`/notifications/${notificationId}/read`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tech-notifications', techId] });
    },
  });
}

// ─── 16. Ticket status overview (pie chart data) ──────────────────────────────
export function useTechnicianStatusOverview() {
  const techId = getTechId();

  return useQuery({
    queryKey: ['tech-status-overview', techId],
    queryFn: async () => {
      if (!techId) return [];

      const { data, error } = await supabase
        .from('tickets')
        .select('status')
        .eq('assigned_to', techId);

      if (error) throw error;

      const counts: Record<string, number> = {};
      (data ?? []).forEach(t => {
        counts[t.status] = (counts[t.status] ?? 0) + 1;
      });

      return Object.entries(counts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    },
    enabled: !!techId,
    staleTime: 30_000,
  });
}

// ─── 17. Priority overview ────────────────────────────────────────────────────
export function useTechnicianPriorityOverview() {
  const techId = getTechId();

  return useQuery({
    queryKey: ['tech-priority-overview', techId],
    queryFn: async () => {
      if (!techId) return [];

      const activeStatuses = ['Open', 'Assigned', 'In Progress', 'Waiting for User', 'Awaiting Employee Confirmation', 'Reopened'];

      const { data, error } = await supabase
        .from('tickets')
        .select('priority')
        .eq('assigned_to', techId)
        .in('status', activeStatuses);

      if (error) throw error;

      const counts: Record<string, number> = { Low: 0, Medium: 0, High: 0, Critical: 0 };
      (data ?? []).forEach(t => {
        if (t.priority in counts) counts[t.priority]++;
      });

      return Object.entries(counts)
        .filter(([, v]) => v > 0)
        .map(([name, value]) => ({ name, value }));
    },
    enabled: !!techId,
    staleTime: 30_000,
  });
}

// ─── 18. Awaiting Employee Confirmation tickets ───────────────────────────────
export function useAwaitingConfirmationTickets() {
  const techId = getTechId();

  return useQuery({
    queryKey: ['tech-awaiting-confirmation', techId],
    queryFn: async () => {
      if (!techId) return [];

      const { data, error } = await supabase
        .from('tickets')
        .select(TICKET_SELECT)
        .eq('assigned_to', techId)
        .eq('status', 'Awaiting Employee Confirmation')
        .order('technician_completed_at', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!techId,
    staleTime: 20_000,
  });
}
