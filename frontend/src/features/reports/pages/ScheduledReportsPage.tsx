import { useEffect, useState } from 'react';
import { useReportsStore } from '../../../store/reportsStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from '@/components/ui/dialog';
import { Plus, Trash2, Play, Clock, Mail } from 'lucide-react';

function CreateScheduleDialog({ onCreated }: { onCreated: () => void }) {
  const { createScheduledReport } = useReportsStore();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    frequency: 'weekly' as const,
    time_of_day: '08:00',
    recipients: '',
    export_format: 'xlsx' as const,
    is_active: true,
  });

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await createScheduledReport({
        ...form,
        time_of_day: form.time_of_day + ':00',
        recipients: form.recipients.split(',').map(e => e.trim()).filter(Boolean),
      });
      setOpen(false);
      onCreated();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Schedule</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Scheduled Report</DialogTitle>
          <DialogDescription>Configure automatic report delivery by email.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Schedule Name</label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Weekly Ticket Summary" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Frequency</label>
              <Select value={form.frequency} onValueChange={v => setForm(f => ({ ...f, frequency: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Time of Day</label>
              <Input type="time" value={form.time_of_day} onChange={e => setForm(f => ({ ...f, time_of_day: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Export Format</label>
            <Select value={form.export_format} onValueChange={v => setForm(f => ({ ...f, export_format: v as any }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Recipients (comma-separated emails)</label>
            <Input value={form.recipients} onChange={e => setForm(f => ({ ...f, recipients: e.target.value }))} placeholder="admin@company.com, manager@company.com" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading || !form.name || !form.recipients}>
            {loading ? 'Creating...' : 'Create Schedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ScheduledReportsPage() {
  const { scheduledReports, fetchScheduledReports, deleteScheduledReport, updateScheduledReport } = useReportsStore();

  useEffect(() => { fetchScheduledReports(); }, []);

  const formatFrequency = (f: string, time: string) => {
    return `${f.charAt(0).toUpperCase() + f.slice(1)} at ${time.slice(0, 5)}`;
  };

  const toggleActive = async (id: string, current: boolean) => {
    await updateScheduledReport(id, { is_active: !current });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Scheduled Reports</h1>
          <p className="text-muted-foreground mt-1">Automate report delivery via email.</p>
        </div>
        <CreateScheduleDialog onCreated={fetchScheduledReports} />
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        {scheduledReports.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">No scheduled reports yet</p>
            <p className="text-sm">Create a schedule to automatically deliver reports by email.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-5 py-3">Name</th>
                <th className="text-left px-5 py-3">Frequency</th>
                <th className="text-left px-5 py-3">Format</th>
                <th className="text-left px-5 py-3">Recipients</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-right px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {scheduledReports.map((schedule: any) => (
                <tr key={schedule.id} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-medium">{schedule.name}</p>
                    {schedule.template?.name && <p className="text-xs text-muted-foreground">{schedule.template.name}</p>}
                  </td>
                  <td className="px-5 py-4">
                    <span className="flex items-center gap-1.5 text-xs">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      {formatFrequency(schedule.frequency, schedule.time_of_day)}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant="outline" className="text-xs uppercase">{schedule.export_format}</Badge>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-start gap-1 text-xs">
                      <Mail className="h-3.5 w-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground">{(schedule.recipients as string[]).join(', ')}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => toggleActive(schedule.id, schedule.is_active)}
                      className={`px-2 py-1 rounded-full text-xs font-semibold transition-colors ${schedule.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      {schedule.is_active ? 'Active' : 'Paused'}
                    </button>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteScheduledReport(schedule.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
