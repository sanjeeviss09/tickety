import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, ShieldCheck, Users, AlertTriangle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface RulesData {
  id?: string;
  require_attendance: boolean;
  default_capacity_limit: number | null;
  critical_tickets_bypass_capacity: boolean;
}

export function WorkforceRulesSettings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [requireAttendance, setRequireAttendance] = useState(true);
  const [capacityEnabled, setCapacityEnabled] = useState(true);
  const [capacityLimit, setCapacityLimit] = useState(10);
  const [criticalBypass, setCriticalBypass] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: rules, isLoading } = useQuery<RulesData>({
    queryKey: ['workforce-rules'],
    queryFn: async () => {
      const res = await api.get('/workforce/rules');
      return res.data?.data;
    },
  });

  // Seed form from loaded data
  useEffect(() => {
    if (rules) {
      setRequireAttendance(rules.require_attendance ?? true);
      setCapacityEnabled(rules.default_capacity_limit !== null);
      setCapacityLimit(rules.default_capacity_limit ?? 10);
      setCriticalBypass(rules.critical_tickets_bypass_capacity ?? true);
      setHasChanges(false);
    }
  }, [rules]);

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<RulesData>) => {
      return api.put('/workforce/rules', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workforce-rules'] });
      queryClient.invalidateQueries({ queryKey: ['workforce-summary'] });
      setHasChanges(false);
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      require_attendance: requireAttendance,
      default_capacity_limit: capacityEnabled ? capacityLimit : null,
      critical_tickets_bypass_capacity: criticalBypass,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/workforce/attendance')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Assignment Availability Rules</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure how the ticket assignment engine evaluates technician availability</p>
        </div>
        <Button onClick={handleSave} disabled={!hasChanges || saveMutation.isPending}>
          {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Changes
        </Button>
      </div>

      {saveMutation.isSuccess && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800 p-3 text-sm text-emerald-700 dark:text-emerald-300">
          ✓ Rules saved successfully. Changes are effective immediately for new ticket assignments.
        </div>
      )}

      {/* Attendance Rule */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-base">Attendance Requirement</CardTitle>
              <CardDescription>Should the assignment engine require technicians to be checked in?</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Require attendance check-in for assignment</p>
              <p className="text-xs text-muted-foreground mt-1">
                When enabled, only technicians with "Present" or "Late" status will receive new tickets.
              </p>
            </div>
            <Switch
              checked={requireAttendance}
              onCheckedChange={(v) => { setRequireAttendance(v); setHasChanges(true); }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Capacity Rule */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Users className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-base">Default Capacity Limit</CardTitle>
              <CardDescription>Maximum number of active tickets a technician can hold simultaneously</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Enable capacity limit</p>
              <p className="text-xs text-muted-foreground mt-1">
                When disabled, technicians can hold unlimited active tickets.
              </p>
            </div>
            <Switch
              checked={capacityEnabled}
              onCheckedChange={(v) => { setCapacityEnabled(v); setHasChanges(true); }}
            />
          </div>

          {capacityEnabled && (
            <div className="flex items-center gap-4 pt-2 border-t">
              <Label htmlFor="cap-limit" className="whitespace-nowrap text-sm">Max active tickets per technician</Label>
              <Input
                id="cap-limit"
                type="number"
                min={1}
                max={999}
                value={capacityLimit}
                onChange={(e) => { setCapacityLimit(parseInt(e.target.value) || 1); setHasChanges(true); }}
                className="w-24"
              />
              <Badge variant="secondary" className="text-xs whitespace-nowrap">Default for all</Badge>
            </div>
          )}

          <p className="text-xs text-muted-foreground border-t pt-3">
            💡 Individual technician capacity overrides can be set in the Manage Shifts page.
          </p>
        </CardContent>
      </Card>

      {/* Critical Bypass */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <CardTitle className="text-base">Critical Ticket Capacity Bypass</CardTitle>
              <CardDescription>Allow Critical-priority tickets to be assigned even when technicians are at capacity</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Critical tickets bypass capacity limits</p>
              <p className="text-xs text-muted-foreground mt-1">
                When enabled, Critical priority tickets will be assigned regardless of capacity limits. Useful for urgent incidents.
              </p>
            </div>
            <Switch
              checked={criticalBypass}
              onCheckedChange={(v) => { setCriticalBypass(v); setHasChanges(true); }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
