import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Plus, Clock, Users, Trash2, Loader2, Calendar, Edit2, UserPlus, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ShiftProfile {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  working_days: string[];
  timezone: string;
  grace_period_mins: number;
  late_threshold_mins: number;
  is_overnight: boolean;
  is_active: boolean;
  created_at: string;
}

interface ShiftAssignment {
  id: string;
  technician_id: string;
  shift_profile_id: string;
  effective_start: string;
  effective_end: string | null;
  technician: { id: string; full_name: string; employee_id: string } | null;
  shift: { id: string; name: string; start_time: string; end_time: string } | null;
}

interface TechCapacity {
  id: string;
  technician_id: string;
  capacity_limit: number | null;
  technician: { id: string; full_name: string; employee_id: string } | null;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatTime(t: string) {
  if (!t) return '—';
  const [h, m] = t.split(':');
  const d = new Date();
  d.setHours(parseInt(h), parseInt(m));
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ShiftManagement() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<ShiftProfile | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [capDialogOpen, setCapDialogOpen] = useState(false);

  // Shift form state
  const [shiftName, setShiftName] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [workingDays, setWorkingDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [gracePeriod, setGracePeriod] = useState(15);
  const [lateThreshold, setLateThreshold] = useState(30);
  const [isOvernight, setIsOvernight] = useState(false);

  // Assignment form state
  const [assignTechId, setAssignTechId] = useState('');
  const [assignShiftId, setAssignShiftId] = useState('');
  const [assignStart, setAssignStart] = useState(new Date().toISOString().split('T')[0]);
  const [assignEnd, setAssignEnd] = useState('');

  // Capacity form state
  const [capTechId, setCapTechId] = useState('');
  const [capLimit, setCapLimit] = useState<string>('10');

  // Queries
  const { data: shifts = [], isLoading: shiftsLoading } = useQuery<ShiftProfile[]>({
    queryKey: ['workforce-shifts'],
    queryFn: async () => {
      const res = await api.get('/workforce/shifts');
      return res.data?.data || [];
    },
  });

  const { data: assignments = [] } = useQuery<ShiftAssignment[]>({
    queryKey: ['workforce-shift-assignments'],
    queryFn: async () => {
      const res = await api.get('/workforce/shift-assignments');
      return res.data?.data || [];
    },
  });

  const { data: capacities = [] } = useQuery<TechCapacity[]>({
    queryKey: ['workforce-capacities'],
    queryFn: async () => {
      const res = await api.get('/workforce/capacities');
      return res.data?.data || [];
    },
  });

  const { data: technicians = [] } = useQuery<any[]>({
    queryKey: ['all-technicians-for-shifts'],
    queryFn: async () => {
      const res = await api.get('/users?role=Technician');
      return res.data?.data || res.data || [];
    },
  });

  // Mutations
  const createShiftMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingShift) {
        return api.put(`/workforce/shifts/${editingShift.id}`, payload);
      }
      return api.post('/workforce/shifts', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workforce-shifts'] });
      setShiftDialogOpen(false);
      resetShiftForm();
    },
  });

  const deleteShiftMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/workforce/shifts/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workforce-shifts'] }),
  });

  const createAssignMutation = useMutation({
    mutationFn: async (payload: any) => api.post('/workforce/shift-assignments', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workforce-shift-assignments'] });
      setAssignDialogOpen(false);
    },
  });

  const deleteAssignMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/workforce/shift-assignments/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workforce-shift-assignments'] }),
  });

  const saveCapMutation = useMutation({
    mutationFn: async (payload: { techId: string; limit: number | null }) =>
      api.put(`/workforce/capacities/${payload.techId}`, { capacity_limit: payload.limit }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workforce-capacities'] });
      setCapDialogOpen(false);
    },
  });

  const resetShiftForm = () => {
    setEditingShift(null);
    setShiftName('');
    setStartTime('09:00');
    setEndTime('18:00');
    setWorkingDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    setGracePeriod(15);
    setLateThreshold(30);
    setIsOvernight(false);
  };

  const openEditShift = (shift: ShiftProfile) => {
    setEditingShift(shift);
    setShiftName(shift.name);
    setStartTime(shift.start_time.slice(0, 5));
    setEndTime(shift.end_time.slice(0, 5));
    setWorkingDays(shift.working_days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    setGracePeriod(shift.grace_period_mins);
    setLateThreshold(shift.late_threshold_mins);
    setIsOvernight(shift.is_overnight);
    setShiftDialogOpen(true);
  };

  const toggleDay = (day: string) => {
    setWorkingDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const activeShifts = shifts.filter(s => s.is_active);

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/workforce/attendance')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Manage Shifts & Capacity</h1>
          <p className="text-sm text-muted-foreground mt-1">Define shift schedules, assign technicians, and set individual capacity overrides</p>
        </div>
      </div>

      <Tabs defaultValue="shifts" className="flex-1">
        <TabsList>
          <TabsTrigger value="shifts"><Clock className="mr-2 h-4 w-4" />Shift Profiles</TabsTrigger>
          <TabsTrigger value="assignments"><Users className="mr-2 h-4 w-4" />Technician Assignments</TabsTrigger>
          <TabsTrigger value="capacity"><ShieldAlert className="mr-2 h-4 w-4" />Capacity Overrides</TabsTrigger>
        </TabsList>

        {/* ── SHIFT PROFILES TAB ── */}
        <TabsContent value="shifts" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { resetShiftForm(); setShiftDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />Create Shift
            </Button>
          </div>

          {shiftsLoading ? (
            <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : activeShifts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                <Clock className="h-10 w-10 mb-3 opacity-50" />
                <p className="text-sm">No shift profiles defined yet</p>
                <p className="text-xs mt-1">Create a shift to define working hours for technicians.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeShifts.map(shift => (
                <Card key={shift.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{shift.name}</CardTitle>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditShift(shift)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                          onClick={() => deleteShiftMutation.mutate(shift.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Hours</span>
                      <span className="font-medium">{formatTime(shift.start_time)} – {formatTime(shift.end_time)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Days</span>
                      <div className="flex gap-1">
                        {DAYS.map(d => (
                          <Badge key={d} variant={shift.working_days?.includes(d) ? 'default' : 'outline'} className="text-[10px] px-1.5 py-0">
                            {d}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Grace / Late</span>
                      <span>{shift.grace_period_mins}m / {shift.late_threshold_mins}m</span>
                    </div>
                    {shift.is_overnight && <Badge variant="secondary" className="text-xs">Overnight</Badge>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── ASSIGNMENTS TAB ── */}
        <TabsContent value="assignments" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setAssignDialogOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />Assign Technician to Shift
            </Button>
          </div>

          {assignments.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                <Users className="h-10 w-10 mb-3 opacity-50" />
                <p className="text-sm">No shift assignments yet</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Technician</th>
                      <th className="px-4 py-3 text-left font-medium">Shift</th>
                      <th className="px-4 py-3 text-left font-medium">Effective From</th>
                      <th className="px-4 py-3 text-left font-medium">Until</th>
                      <th className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map(a => (
                      <tr key={a.id} className="border-b hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{a.technician?.full_name || '—'}</td>
                        <td className="px-4 py-3">{a.shift?.name || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{a.effective_start}</td>
                        <td className="px-4 py-3 text-muted-foreground">{a.effective_end || 'Ongoing'}</td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => deleteAssignMutation.mutate(a.id)}>
                            <Trash2 className="h-3 w-3 mr-1" />Remove
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── CAPACITY TAB ── */}
        <TabsContent value="capacity" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Override the default capacity limit for individual technicians. Technicians not listed use the global default.
            </p>
            <Button onClick={() => { setCapTechId(''); setCapLimit('10'); setCapDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />Add Override
            </Button>
          </div>

          {capacities.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                <ShieldAlert className="h-10 w-10 mb-3 opacity-50" />
                <p className="text-sm">No individual capacity overrides</p>
                <p className="text-xs mt-1">All technicians use the global default capacity.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Technician</th>
                      <th className="px-4 py-3 text-left font-medium">Capacity Limit</th>
                      <th className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {capacities.map(cap => (
                      <tr key={cap.id} className="border-b hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{cap.technician?.full_name || cap.technician_id}</td>
                        <td className="px-4 py-3">
                          {cap.capacity_limit != null ? (
                            <Badge variant="secondary">{cap.capacity_limit} tickets</Badge>
                          ) : (
                            <Badge variant="outline">Unlimited</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                            setCapTechId(cap.technician_id);
                            setCapLimit(cap.capacity_limit?.toString() || '');
                            setCapDialogOpen(true);
                          }}>
                            <Edit2 className="h-3 w-3 mr-1" />Edit
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ── CREATE/EDIT SHIFT DIALOG ── */}
      <Dialog open={shiftDialogOpen} onOpenChange={setShiftDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingShift ? 'Edit Shift Profile' : 'Create Shift Profile'}</DialogTitle>
            <DialogDescription>Define the working hours and schedule parameters.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Shift Name</Label>
              <Input value={shiftName} onChange={e => setShiftName(e.target.value)} placeholder="e.g. Morning Shift" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Working Days</Label>
              <div className="flex gap-2 flex-wrap">
                {DAYS.map(d => (
                  <label key={d} className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox checked={workingDays.includes(d)} onCheckedChange={() => toggleDay(d)} />
                    <span className="text-sm">{d}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Grace Period (mins)</Label>
                <Input type="number" min={0} value={gracePeriod} onChange={e => setGracePeriod(parseInt(e.target.value) || 0)} />
              </div>
              <div className="space-y-2">
                <Label>Late Threshold (mins)</Label>
                <Input type="number" min={0} value={lateThreshold} onChange={e => setLateThreshold(parseInt(e.target.value) || 0)} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Overnight Shift</Label>
              <Switch checked={isOvernight} onCheckedChange={setIsOvernight} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShiftDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={!shiftName || createShiftMutation.isPending}
              onClick={() => createShiftMutation.mutate({
                name: shiftName,
                start_time: startTime,
                end_time: endTime,
                working_days: workingDays,
                grace_period_mins: gracePeriod,
                late_threshold_mins: lateThreshold,
                is_overnight: isOvernight,
              })}
            >
              {createShiftMutation.isPending ? 'Saving...' : editingShift ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── ASSIGN TECHNICIAN DIALOG ── */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Technician to Shift</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Technician</Label>
              <Select value={assignTechId} onValueChange={setAssignTechId}>
                <SelectTrigger><SelectValue placeholder="Select technician" /></SelectTrigger>
                <SelectContent>
                  {technicians.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.full_name} ({t.employee_id || t.email_address})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Shift Profile</Label>
              <Select value={assignShiftId} onValueChange={setAssignShiftId}>
                <SelectTrigger><SelectValue placeholder="Select shift" /></SelectTrigger>
                <SelectContent>
                  {activeShifts.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name} ({formatTime(s.start_time)} – {formatTime(s.end_time)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Effective Start</Label>
                <Input type="date" value={assignStart} onChange={e => setAssignStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Effective End (Optional)</Label>
                <Input type="date" value={assignEnd} onChange={e => setAssignEnd(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={!assignTechId || !assignShiftId || createAssignMutation.isPending}
              onClick={() => createAssignMutation.mutate({
                technician_id: assignTechId,
                shift_profile_id: assignShiftId,
                effective_start: assignStart,
                effective_end: assignEnd || null,
              })}
            >
              {createAssignMutation.isPending ? 'Assigning...' : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CAPACITY OVERRIDE DIALOG ── */}
      <Dialog open={capDialogOpen} onOpenChange={setCapDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Capacity Override</DialogTitle>
            <DialogDescription>Set a custom ticket capacity for a specific technician. Leave blank for unlimited.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Technician</Label>
              <Select value={capTechId} onValueChange={setCapTechId}>
                <SelectTrigger><SelectValue placeholder="Select technician" /></SelectTrigger>
                <SelectContent>
                  {technicians.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Capacity Limit</Label>
              <Input
                type="number"
                min={0}
                value={capLimit}
                onChange={e => setCapLimit(e.target.value)}
                placeholder="Leave empty for unlimited"
              />
              <p className="text-xs text-muted-foreground">Set to 0 or leave empty for unlimited capacity.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCapDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={!capTechId || saveCapMutation.isPending}
              onClick={() => {
                const limit = capLimit ? parseInt(capLimit) : null;
                saveCapMutation.mutate({ techId: capTechId, limit: limit === 0 ? null : limit });
              }}
            >
              {saveCapMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
