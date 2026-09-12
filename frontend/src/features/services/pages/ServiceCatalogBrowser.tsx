import { useEffect } from 'react';
import { useServiceCatalogStore } from '../../../store/serviceCatalogStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export function ServiceCatalogBrowser() {
  const { services, fetchServices, loading } = useServiceCatalogStore();

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  if (loading) {
    return <div className="py-20 text-center">Loading services...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Service Catalog</h2>
        <p className="text-muted-foreground mt-2">Request hardware, software, access, and more.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => (
          <Card key={service.id} className="flex flex-col hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="text-xl">{service.name}</CardTitle>
              </div>
              <CardDescription>{service.category}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between space-y-4">
              <p className="text-sm text-muted-foreground">
                {service.description}
              </p>
              <div className="space-y-4 mt-auto pt-4 border-t">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> SLA: {service.sla_hours || 24}h</span>
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-4 w-4" /> 
                    {service.approval_type === 'None' ? 'Auto-approved' : 'Requires Approval'}
                  </span>
                </div>
                <Link to={`/help-center/services/${service.id}`} className="block">
                  <Button className="w-full">Request Service</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
        {services.length === 0 && (
          <div className="col-span-3 text-center py-12 text-muted-foreground">
            No services currently available in the catalog.
          </div>
        )}
      </div>
    </div>
  );
}
