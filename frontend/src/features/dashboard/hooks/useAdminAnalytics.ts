import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';

export function useAdminAnalytics(isAdmin: boolean) {
  return useQuery({
    queryKey: ['admin-analytics', isAdmin],
    queryFn: async () => {
      const requests = [
        api.get('/analytics/summary'),
        api.get('/analytics/ticket-trends', { params: { period: 'month' } }),
        api.get('/analytics/ticket-distribution', { params: { groupBy: 'status' } }),
        api.get('/analytics/asset-distribution', { params: { groupBy: 'status' } })
      ];

      if (isAdmin) {
        requests.push(api.get('/analytics/technician-performance'));
      }

      const results = await Promise.allSettled(requests);

      return {
        summary: results[0].status === 'fulfilled' ? results[0].value.data.data : null,
        ticketTrends: results[1].status === 'fulfilled' ? results[1].value.data.data : [],
        ticketDistribution: results[2].status === 'fulfilled' ? results[2].value.data.data : [],
        assetDistribution: results[3].status === 'fulfilled' ? results[3].value.data.data : [],
        technicianPerformance: isAdmin && results[4] && results[4].status === 'fulfilled' ? results[4].value.data.data : []
      };
    },
    staleTime: 5 * 60_000, // 5 minutes caching to prevent hammering the analytics DB
  });
}
