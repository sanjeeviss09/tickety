import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollText } from 'lucide-react';

export function AuditLogSettings() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Audit Logs</CardTitle>
          <CardDescription>
            Immutable history of all system configuration changes and administrative actions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-lg bg-slate-50/50">
            <ScrollText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-medium mb-2">Audit Log Viewer</h3>
            <p className="text-muted-foreground max-w-md">
              The audit logs are being securely recorded in the backend. The UI viewer for filtering and exporting logs is under development.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
