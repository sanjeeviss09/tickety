import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import { useAuthStore } from '../../../store/authStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, Clock, AlertTriangle, ShieldCheck, LogIn, LogOut, UserX, RefreshCw, Settings, Calendar, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';

interface SummaryData {
  available: number;
  notCheckedIn: number;
  atCapacity: number;
  totalTechs: number;
  rule: {
    require_attendance: boolean;
    default_capacity_limit: number | null;
    critical_tickets_bypass_capacity: boolean;
  } | null;
}

interface TechRow {
  technician_id: string;
  full_name: string;
  employee_id: string;
  email: string;
  shift: { id: string; name: string; start_time: string; end_time: string } | null;
  attendance_status: string;
  check_in_time: string | null;
  check_out_time: string | null;
  active_load: number;
  capacity: number | null;
  routing_status: string;
}

const statusColors: Record<string, string> = {
  'Present': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'Late': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'Scheduled': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'Not Checked In': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'Checked Out': 'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400',
  'Leave': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  'Absent': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'Unavailable': 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400',
  'No Record': 'bg-gray-50 text-gray-500 dark:bg-gray-800/30 dark:text-gray-500',
  'Off Day': 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
};

const routingColors: Record<string, string> = {
  'Receiving Tickets': 'text-emerald-600 dark:text-emerald-400 font-semibold',
  'At Capacity': 'text-destructive font-semibold',
  'On Leave': 'text-purple-600 dark:text-purple-400',
  'Checked Out': 'text-slate-500 dark:text-slate-400',
  'Unavailable': 'text-gray-500 dark:text-gray-500',
};

function formatTime(timeStr: string | null): string {
  if (!timeStr) return '—';
  // Handle HH:MM:SS format (shift times)
  if (timeStr.match(/^\d{2}:\d{2}/)) {
    const [h, m] = timeStr.split(':');
    const d = new Date();
    d.setHours(parseInt(h), parseInt(m));
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  // Handle ISO datetime
  return new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function AttendanceDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuthStore();
  const isAdmin = profile?.roles?.name === 'Admin';

  const [markDialogOpen, setMarkDialogOpen] = useState(false);
  const [selectedTech, setSelectedTech] = useState<TechRow | null>(null);
  const [markStatus, setMarkStatus] = useState('Present');

  // KPI Summary
  const { data: summary, isLoading: summaryLoading } = useQuery<SummaryData>({
    queryKey: ['workforce-summary'],
    queryFn: async () => {
      const res = await api.get('/workforce/summary');
      return res.data?.data;
    },
    refetchInterval: 30000, // refresh every 30s
  });

  // Technician table
  const { data: techRows = [], isLoading: tableLoading } = useQuery<TechRow[]>({
    queryKey: ['workforce-attendance-today'],
    queryFn: async () => {
      const res = await api.get('/workforce/attendance/today');
      return res.data?.data || [];
    },
    refetchInterval: 30000,
  });

  // Check-in mutation
  const checkInMutation = useMutation({
    mutationFn: async (technicianId: string) => {
      return api.post('/workforce/attendance/check-in', { technician_id: technicianId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workforce-summary'] });
      queryClient.invalidateQueries({ queryKey: ['workforce-attendance-today'] });
    },
  });

  // Check-out mutation
  const checkOutMutation = useMutation({
    mutationFn: async (technicianId: string) => {
      return api.post('/workforce/attendance/check-out', { technician_id: technicianId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workforce-summary'] });
      queryClient.invalidateQueries({ queryKey: ['workforce-attendance-today'] });
    },
  });

  // Admin mark attendance mutation
  const markMutation = useMutation({
    mutationFn: async ({ technicianId, status }: { technicianId: string; status: string }) => {
      return api.post('/workforce/attendance/mark', { technician_id: technicianId, status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workforce-summary'] });
      queryClient.invalidateQueries({ queryKey: ['workforce-attendance-today'] });
      setMarkDialogOpen(false);
      setSelectedTech(null);
    },
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['workforce-summary'] });
    queryClient.invalidateQueries({ queryKey: ['workforce-attendance-today'] });
  };

  const getRuleSummary = () => {
    if (!summary?.rule) return { label: 'No Rules Set', detail: '' };
    const r = summary.rule;
    const label = r.require_attendance ? 'Attendance Required' : 'No Attendance Check';
    const capStr = r.default_capacity_limit != null ? `Cap: ${r.default_capacity_limit}` : 'Unlimited';
    const bypassStr = r.critical_tickets_bypass_capacity ? 'Critical Bypass: ON' : 'Critical Bypass: OFF';
    return { label, detail: `${capStr} · ${bypassStr}` };
  };

  const ruleSummary = getRuleSummary();

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attendance & Availability</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time view of technician availability and assignment capacities
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={handleRefresh} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          {isAdmin && (
            <>
              <Button variant="outline" onClick={() => navigate('/settings/workforce/rules')}>
                <Settings className="mr-2 h-4 w-4" />Global Rules
              </Button>
              <Button onClick={() => navigate('/settings/workforce/shifts')}>
                <Calendar className="mr-2 h-4 w-4" />Manage Shifts
              </Button>
            </>
          )}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-medium flex items-center text-muted-foreground">
              <Users className="mr-2 h-4 w-4 text-emerald-500" /> Available Techs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {summaryLoading ? <span className="animate-pulse text-muted-foreground">—</span> : summary?.available ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Checked in &amp; ready</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-medium flex items-center text-muted-foreground">
              <Clock className="mr-2 h-4 w-4 text-amber-500" /> On Shift, Not Checked In
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">
              {summaryLoading ? <span className="animate-pulse text-muted-foreground">—</span> : summary?.notCheckedIn ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Grace period pending</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-medium flex items-center text-muted-foreground">
              <AlertTriangle className="mr-2 h-4 w-4 text-red-500" /> At Capacity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">
              {summaryLoading ? <span className="animate-pulse text-muted-foreground">—</span> : summary?.atCapacity ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Max tickets reached</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-medium flex items-center text-muted-foreground">
              <ShieldCheck className="mr-2 h-4 w-4 text-blue-500" /> Active Rule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">
              {summaryLoading ? <span className="animate-pulse text-muted-foreground">—</span> : ruleSummary.label}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summaryLoading ? '' : ruleSummary.detail}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Technician Status Table */}
      <Card className="flex-1 min-h-0 flex flex-col">
        <CardHeader className="py-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Technician Status (Today)</CardTitle>
              <CardDescription>Live tracking of who is available for ticket routing</CardDescription>
            </div>
            <Badge variant="secondary" className="text-xs">
              {techRows.length} technician{techRows.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-auto flex-1">
          {tableLoading ? (
            <div className="flex items-center justify-center p-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : techRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
              <UserX className="h-10 w-10 mb-3 opacity-50" />
              <p className="text-sm">No technicians found</p>
              <p className="text-xs mt-1">Add technicians and assign shifts to see their availability here.</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-muted/50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 font-medium">Technician</th>
                  <th className="px-4 py-3 font-medium">Shift</th>
                  <th className="px-4 py-3 font-medium">Attendance</th>
                  <th className="px-4 py-3 font-medium">Check In</th>
                  <th className="px-4 py-3 font-medium">Active Load</th>
                  <th className="px-4 py-3 font-medium">Routing Status</th>
                  {isAdmin && <th className="px-4 py-3 font-medium text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {techRows.map((tech) => (
                  <tr key={tech.technician_id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium">{tech.full_name}</div>
                      <div className="text-xs text-muted-foreground">{tech.employee_id || tech.email}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {tech.shift ? (
                        <span>{tech.shift.name} ({formatTime(tech.shift.start_time)} - {formatTime(tech.shift.end_time)})</span>
                      ) : (
                        <span className="text-xs italic">No shift assigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusColors[tech.attendance_status] || statusColors['No Record']}`}>
                        {tech.attendance_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {tech.check_in_time ? formatTime(tech.check_in_time) : '—'}
                      {tech.check_out_time && (
                        <span className="ml-1">→ {formatTime(tech.check_out_time)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={tech.capacity !== null && tech.active_load >= tech.capacity ? 'text-destructive font-bold' : ''}>
                        {tech.active_load} / {tech.capacity ?? '∞'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={routingColors[tech.routing_status] || 'text-muted-foreground'}>
                        {tech.routing_status}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-1 justify-end">
                          {(tech.attendance_status === 'Scheduled' || tech.attendance_status === 'Not Checked In' || tech.attendance_status === 'No Record') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              disabled={checkInMutation.isPending}
                              onClick={() => checkInMutation.mutate(tech.technician_id)}
                            >
                              <LogIn className="h-3 w-3 mr-1" />In
                            </Button>
                          )}
                          {(tech.attendance_status === 'Present' || tech.attendance_status === 'Late') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              disabled={checkOutMutation.isPending}
                              onClick={() => checkOutMutation.mutate(tech.technician_id)}
                            >
                              <LogOut className="h-3 w-3 mr-1" />Out
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => { setSelectedTech(tech); setMarkDialogOpen(true); }}
                          >
                            <ChevronRight className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Admin Mark Attendance Dialog */}
      <Dialog open={markDialogOpen} onOpenChange={setMarkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Attendance — {selectedTech?.full_name}</DialogTitle>
            <DialogDescription>
              Override the attendance status for this technician.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={markStatus} onValueChange={setMarkStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Present">Present</SelectItem>
                  <SelectItem value="Late">Late</SelectItem>
                  <SelectItem value="Absent">Absent</SelectItem>
                  <SelectItem value="Leave">Leave</SelectItem>
                  <SelectItem value="Unavailable">Unavailable</SelectItem>
                  <SelectItem value="Off Day">Off Day</SelectItem>
                  <SelectItem value="Exception">Exception</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (selectedTech) {
                  markMutation.mutate({ technicianId: selectedTech.technician_id, status: markStatus });
                }
              }}
              disabled={markMutation.isPending}
            >
              {markMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
