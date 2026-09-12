import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Info, Server, Activity } from 'lucide-react';

export function SystemInfoSettings() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>System Information</CardTitle>
          <CardDescription>
            View application version, infrastructure health, and database telemetry.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="p-4 border rounded-lg bg-slate-50/50 flex flex-col items-center justify-center text-center">
              <Server className="h-8 w-8 text-primary mb-2" />
              <div className="text-2xl font-bold">100%</div>
              <div className="text-sm text-muted-foreground">Uptime (90 Days)</div>
            </div>
            <div className="p-4 border rounded-lg bg-slate-50/50 flex flex-col items-center justify-center text-center">
              <Activity className="h-8 w-8 text-primary mb-2" />
              <div className="text-2xl font-bold">14 ms</div>
              <div className="text-sm text-muted-foreground">Avg API Latency</div>
            </div>
            <div className="p-4 border rounded-lg bg-slate-50/50 flex flex-col items-center justify-center text-center">
              <Info className="h-8 w-8 text-primary mb-2" />
              <div className="text-2xl font-bold">v1.2.4</div>
              <div className="text-sm text-muted-foreground">DeskPulse Core</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
