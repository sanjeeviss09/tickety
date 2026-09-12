import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Clock } from 'lucide-react';

export function SlaSettings() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>SLA & Escalation Policies</CardTitle>
          <CardDescription>
            Configure Service Level Agreements and automated escalation matrices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-lg bg-slate-50/50">
            <Clock className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-medium mb-2">Advanced SLA Matrix (Coming Soon)</h3>
            <p className="text-muted-foreground max-w-md">
              The advanced SLA Matrix engine is currently being built. It will support dynamic resolution time targets based on Priority, Category, and Business Unit.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
