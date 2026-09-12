import { useEffect } from 'react';
import { useServiceCatalogStore } from '../../../store/serviceCatalogStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, Edit, Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function ServiceCatalogManager() {
  const { services, fetchServices, loading } = useServiceCatalogStore();

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Service Catalog Admin</h1>
          <p className="text-muted-foreground mt-1">Manage services, request forms, and SLAs.</p>
        </div>
        <Button><Plus className="mr-2 h-4 w-4" /> New Service</Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <p>Loading...</p>
        ) : services.map((service) => (
          <Card key={service.id} className="flex flex-col">
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="text-xl">{service.name}</CardTitle>
                <Badge variant={service.approval_type === 'None' ? 'secondary' : 'default'}>
                  Approval: {service.approval_type}
                </Badge>
              </div>
              <CardDescription>{service.category}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between">
              <p className="text-sm text-muted-foreground mb-4">
                {service.description}
              </p>
              <div className="flex justify-end gap-2 mt-auto">
                <Button variant="outline" size="sm">
                  <Settings className="mr-2 h-4 w-4" /> Form Builder
                </Button>
                <Button variant="default" size="sm">
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {services.length === 0 && !loading && (
          <div className="col-span-3 text-center py-12 text-muted-foreground">
            No services configured yet.
          </div>
        )}
      </div>
    </div>
  );
}
