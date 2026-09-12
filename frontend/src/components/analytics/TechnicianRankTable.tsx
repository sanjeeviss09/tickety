import { Badge } from '@/components/ui/badge';
import { Trophy, Clock } from 'lucide-react';

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
  }[];
  loading?: boolean;
}

const getRankIcon = (index: number) => {
  if (index === 0) return <span className="text-yellow-500">🥇</span>;
  if (index === 1) return <span className="text-gray-400">🥈</span>;
  if (index === 2) return <span className="text-amber-600">🥉</span>;
  return <span className="text-muted-foreground font-bold text-sm">#{index + 1}</span>;
};

export function TechnicianRankTable({ data, loading }: TechnicianRankTableProps) {
  return (
    <div className="bg-card rounded-xl border shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="h-5 w-5 text-yellow-500" />
        <h3 className="font-semibold text-base">Technician Rankings</h3>
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
                <th className="text-right pb-3">SLA</th>
              </tr>
            </thead>
            <tbody>
              {data.map((tech, index) => (
                <tr key={tech.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="py-3 pr-4">{getRankIcon(index)}</td>
                  <td className="py-3 pr-4">
                    <div>
                      <p className="font-medium">{tech.name}</p>
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
                  <td className="py-3 text-right">
                    <Badge variant={tech.slaCompliance >= 90 ? 'default' : tech.slaCompliance >= 75 ? 'secondary' : 'destructive'} className="text-xs">
                      {tech.slaCompliance}%
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
