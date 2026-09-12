import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Database } from 'lucide-react';

export function DataSettings() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Data & Import Management</CardTitle>
          <CardDescription>
            Bulk import historical tickets, assets, and users. Export system data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-lg bg-slate-50/50">
            <Database className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-medium mb-2">Data Operations Engine</h3>
            <p className="text-muted-foreground max-w-md">
              The bulk import pipeline for mapping external CSV formats to the DeskPulse schema is currently being provisioned.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
