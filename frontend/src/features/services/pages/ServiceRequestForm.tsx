import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useServiceCatalogStore } from '../../../store/serviceCatalogStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export function ServiceRequestForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { services, fetchServices, submitRequest, loading } = useServiceCatalogStore();
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (services.length === 0) {
      fetchServices();
    }
  }, [services.length, fetchServices]);

  const service = services.find(s => s.id === id);

  if (loading && !service) {
    return <div className="py-20 text-center">Loading service details...</div>;
  }

  if (!service) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-2xl font-bold mb-4">Service not found</h2>
        <Link to="/help-center/services">
          <Button variant="outline">Return to Catalog</Button>
        </Link>
      </div>
    );
  }

  const handleChange = (fieldName: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    
    setSubmitting(true);
    try {
      await submitRequest(id, formData);
      alert('Service request submitted successfully! A ticket has been created.');
      navigate('/tickets');
    } catch (err) {
      console.error(err);
      alert('Failed to submit request.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field: any) => {
    switch (field.field_type) {
      case 'text':
        return <Input required={field.is_required} onChange={e => handleChange(field.field_name, e.target.value)} />;
      case 'textarea':
        return <Textarea required={field.is_required} onChange={e => handleChange(field.field_name, e.target.value)} />;
      case 'select':
        return (
          <Select onValueChange={val => handleChange(field.field_name, val)}>
            <SelectTrigger>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt: string) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox id={field.field_name} onCheckedChange={val => handleChange(field.field_name, !!val)} />
            <label htmlFor={field.field_name} className="text-sm font-medium leading-none">
              {field.field_label}
            </label>
          </div>
        );
      default:
        return <Input required={field.is_required} onChange={e => handleChange(field.field_name, e.target.value)} />;
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link to="/help-center/services" className="text-muted-foreground hover:text-primary flex items-center text-sm">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Catalog
      </Link>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{service.name}</CardTitle>
          <CardDescription>{service.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {service.dynamic_form_fields?.sort((a, b) => a.order_index - b.order_index).map(field => (
              <div key={field.id} className="space-y-2">
                {field.field_type !== 'checkbox' && (
                  <Label>
                    {field.field_label}
                    {field.is_required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                )}
                {renderField(field)}
              </div>
            ))}
            
            {(!service.dynamic_form_fields || service.dynamic_form_fields.length === 0) && (
              <div className="py-4 text-muted-foreground text-sm">
                No additional information is required for this request.
              </div>
            )}
            
            <div className="pt-4 border-t flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => navigate('/help-center/services')}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {submitting ? 'Submitting...' : 'Submit Request'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
