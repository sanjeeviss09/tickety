import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';
import { useState } from 'react';

export function useAnalyticsPage() {
  const [ticketPeriod, setTicketPeriod] = useState('month');
  const [ticketGroupBy, setTicketGroupBy] = useState('status');
  const [assetGroupBy, setAssetGroupBy] = useState('status');

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['analytics-kpis'],
    queryFn: async () => (await api.get('/analytics/kpis')).data.data,
    staleTime: 5 * 60_000,
  });

  const { data: ticketTrends = [], isLoading: trendsLoading } = useQuery({
    queryKey: ['analytics-ticket-trends', ticketPeriod],
    queryFn: async () => (await api.get('/analytics/ticket-trends', { params: { period: ticketPeriod } })).data.data,
    staleTime: 5 * 60_000,
  });

  const { data: ticketDistribution = [], isLoading: ticketDistLoading } = useQuery({
    queryKey: ['analytics-ticket-distribution', ticketGroupBy],
    queryFn: async () => (await api.get('/analytics/ticket-distribution', { params: { groupBy: ticketGroupBy } })).data.data,
    staleTime: 5 * 60_000,
  });

  const { data: assetDistribution = [], isLoading: assetDistLoading } = useQuery({
    queryKey: ['analytics-asset-distribution', assetGroupBy],
    queryFn: async () => (await api.get('/analytics/asset-distribution', { params: { groupBy: assetGroupBy } })).data.data,
    staleTime: 5 * 60_000,
  });

  const { data: technicianPerformance = [], isLoading: techLoading } = useQuery({
    queryKey: ['analytics-technician-performance'],
    queryFn: async () => (await api.get('/analytics/technician-performance')).data.data,
    staleTime: 5 * 60_000,
  });

  const { data: departmentStats = [], isLoading: deptLoading } = useQuery({
    queryKey: ['analytics-department-stats'],
    queryFn: async () => (await api.get('/analytics/department-stats')).data.data,
    staleTime: 5 * 60_000,
  });

  const loading = kpisLoading || trendsLoading || ticketDistLoading || assetDistLoading || techLoading || deptLoading;

  return {
    kpis,
    ticketTrends,
    ticketDistribution,
    assetDistribution,
    technicianPerformance,
    departmentStats,
    loading,
    ticketPeriod, setTicketPeriod,
    ticketGroupBy, setTicketGroupBy,
    assetGroupBy, setAssetGroupBy
  };
}
