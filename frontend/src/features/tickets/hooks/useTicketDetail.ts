import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';

export function useTicketDetail(id: string | undefined, role: string | undefined) {
  return useQuery({
    queryKey: ['ticket-full', id],
    queryFn: async () => {
      if (!id) return null;
      
      const promises: Promise<any>[] = [
        api.get(`/tickets/${id}`),
        api.get(`/tickets/${id}/comments`),
        api.get(`/tickets/${id}/timeline`),
        api.get(`/tickets/${id}/work-summary`),
        api.get(`/tickets/${id}/resolution`)
      ];

      if (role === 'Admin' || role === 'Technician') {
        promises.push(api.get(`/tickets/${id}/eligible-technicians`));
      }

      const results = await Promise.allSettled(promises);

      const ticketRes = results[0];
      const commentsRes = results[1];
      const timelineRes = results[2];
      const workSummaryRes = results[3];
      const resolutionRes = results[4];

      const ticket = ticketRes.status === 'fulfilled' ? ticketRes.value.data.data : null;
      if (!ticket) throw new Error('Failed to load ticket details');

      const comments = commentsRes.status === 'fulfilled' ? commentsRes.value.data.data : [];
      const timeline = timelineRes.status === 'fulfilled' ? timelineRes.value.data.data : [];
      const workSummary = workSummaryRes.status === 'fulfilled' ? workSummaryRes.value.data.data : null;
      const resolution = resolutionRes.status === 'fulfilled' ? resolutionRes.value.data.data : { resolutions: [], confirmations: [] };

      let unitTechnicians = [];
      if (role === 'Admin' || role === 'Technician') {
        const techsRes = results[5];
        if (techsRes && techsRes.status === 'fulfilled') {
          unitTechnicians = techsRes.value.data.data || [];
        }
      }

      return {
        ticket,
        comments,
        timeline,
        workSummary,
        resolution,
        unitTechnicians
      };
    },
    enabled: !!id,
    staleTime: 10_000,
  });
}
