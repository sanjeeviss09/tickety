import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Trophy, Clock, ChevronRight, User, Star } from 'lucide-react';
import { IndividualPerformanceModal } from '@/features/analytics/components/IndividualPerformanceModal';

interface TechnicianRankTableProps {
  data: {
    id: string;
    name: string;
    email?: string;
    assigned: number;
    resolved: number;
    pending: number;
    avgResolutionHours: number;
    slaCompliance: number;
    avgRating?: number | null;
    totalRatings?: number;
  }[];
  loading?: boolean;
  onSelectTechnician?: (technicianId: string) => void;
}

const getRankIcon = (index: number) => {
  if (index === 0) return <span className="text-yellow-500">🥇</span>;
  if (index === 1) return <span className="text-gray-400">🥈</span>;
  if (index === 2) return <span className="text-amber-600">🥉</span>;
  return <span className="text-muted-foreground font-bold text-sm">#{index + 1}</span>;
};

export function TechnicianRankTable({ data, loading, onSelectTechnician }: TechnicianRankTableProps) {
  const [selectedTechId, setSelectedTechId] = useState<string | null>(null);

  const { data: ratingsData = [] } = useQuery({
    queryKey: ['all-technician-ratings'],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from('ticket_ratings')
        .select('ticket_id, technician_id, rating, submitted_at')
        .order('submitted_at', { ascending: true });
      return rows ?? [];
    },
    staleTime: 30_000,
  });

  const enrichedData = useMemo(() => {
    const byTechTicket = new Map<string, Map<string, number>>();
    ratingsData.forEach((r: any) => {
      if (!r.technician_id || !r.ticket_id) return;
      const val = Number(r.rating);
      if (isNaN(val) || val < 1 || val > 5) return;
      if (!byTechTicket.has(r.technician_id)) {
        byTechTicket.set(r.technician_id, new Map());
      }
      byTechTicket.get(r.technician_id)!.set(r.ticket_id, val);
    });

    return data.map((tech) => {
      if (tech.avgRating !== undefined && tech.avgRating !== null) return tech;
      const ticketMap = byTechTicket.get(tech.id);
      if (!ticketMap || ticketMap.size === 0) return tech;
      const vals = Array.from(ticketMap.values());
      const avg = Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10;
      return {
        ...tech,
        avgRating: avg,
        totalRatings: vals.length,
      };
    });
  }, [data, ratingsData]);

  const handleRowClick = (techId: string) => {
    setSelectedTechId(techId);
    onSelectTechnician?.(techId);
  };

  return (
    <div className="bg-card rounded-xl border shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <div>
            <h3 className="font-semibold text-base">Technician Rankings</h3>
            <p className="text-xs text-muted-foreground">
              Click any technician to view their individual performance scorecard
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-muted-foreground">Loading...</div>
      ) : data.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">No technician data available</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b">
                <th className="text-left pb-3 pr-4">Rank</th>
                <th className="text-left pb-3 pr-4">Technician</th>
                <th className="text-right pb-3 pr-4">Assigned</th>
                <th className="text-right pb-3 pr-4">Resolved</th>
                <th className="text-right pb-3 pr-4">Pending</th>
                <th className="text-right pb-3 pr-4">Avg Time</th>
                <th className="text-right pb-3 pr-4">Rating</th>
                <th className="text-right pb-3 pr-3">SLA</th>
                <th className="text-right pb-3 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {enrichedData.map((tech, index) => (
                <tr
                  key={tech.id}
                  onClick={() => handleRowClick(tech.id)}
                  className="border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors group"
                  title="Click to view detailed individual performance"
                >
                  <td className="py-3 pr-4">{getRankIcon(index)}</td>
                  <td className="py-3 pr-4">
                    <div>
                      <p className="font-medium group-hover:text-primary transition-colors flex items-center gap-1.5">
                        {tech.name}
                      </p>
                      {tech.email && <p className="text-xs text-muted-foreground">{tech.email}</p>}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-right font-medium">{tech.assigned}</td>
                  <td className="py-3 pr-4 text-right font-medium text-green-600">{tech.resolved}</td>
                  <td className="py-3 pr-4 text-right font-medium text-yellow-600">{tech.pending}</td>
                  <td className="py-3 pr-4 text-right">
                    <span className="flex items-center justify-end gap-1 text-xs">
                      <Clock className="h-3 w-3" />{tech.avgResolutionHours}h
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right">
                    {tech.avgRating !== null && tech.avgRating !== undefined ? (
                      <span className="inline-flex items-center justify-end gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                        {tech.avgRating}
                        <span className="text-[10px] font-normal text-amber-600">({tech.totalRatings || 0})</span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-3 text-right">
                    <Badge variant={tech.slaCompliance >= 90 ? 'default' : tech.slaCompliance >= 75 ? 'secondary' : 'destructive'} className="text-xs">
                      {tech.slaCompliance}%
                    </Badge>
                  </td>
                  <td className="py-3 text-right">
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-30 group-hover:opacity-100 group-hover:text-primary transition-all ml-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Individual Performance Scorecard Modal */}
      <IndividualPerformanceModal
        technicianId={selectedTechId}
        open={!!selectedTechId}
        onOpenChange={(open) => {
          if (!open) setSelectedTechId(null);
        }}
      />
    </div>
  );
}
