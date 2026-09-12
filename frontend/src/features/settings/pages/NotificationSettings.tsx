import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, Mail, BellRing, Edit, Send } from 'lucide-react';

export function NotificationSettings() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('events');

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['settings', 'notification_config'],
    queryFn: async () => {
      const res = await api.get('/settings/notification_config');
      return res.data.data;
    }
  });

  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['email_templates'],
    queryFn: async () => {
      const res = await api.get('/settings/email-templates/all');
      return res.data.data;
    }
  });

  if (configLoading || templatesLoading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Notifications & Email</CardTitle>
          <CardDescription>
            Configure system event triggers and customize transactional email templates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList>
              <TabsTrigger value="events" className="flex items-center gap-2">
                <BellRing className="h-4 w-4" /> Event Triggers
              </TabsTrigger>
              <TabsTrigger value="templates" className="flex items-center gap-2">
                <Mail className="h-4 w-4" /> Email Templates
              </TabsTrigger>
            </TabsList>

            <TabsContent value="events">
              <EventTriggersManager config={config} queryClient={queryClient} />
            </TabsContent>

            <TabsContent value="templates">
              <EmailTemplatesManager templates={templates} queryClient={queryClient} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function EventTriggersManager({ config, queryClient }: { config: any, queryClient: any }) {
  const [formData, setFormData] = useState({
    in_app: config?.in_app || {},
    email: config?.email || {},
    provider: config?.provider || { from_name: '', from_email: '', reply_to: '' }
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.put('/settings/notification_config', { value: payload });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'notification_config'] });
      alert('Notification settings saved successfully.');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to save settings');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const handleToggle = (type: 'in_app' | 'email', eventName: string, value: boolean) => {
    setFormData(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [eventName]: value
      }
    }));
  };

  const eventList = [
    { key: 'ticket_created', label: 'New Ticket Created' },
    { key: 'ticket_assigned', label: 'Ticket Assigned to Technician' },
    { key: 'ticket_status_changed', label: 'Ticket Status Changed' },
    { key: 'new_comment', label: 'New Comment Added' },
    { key: 'ticket_resolved', label: 'Ticket Resolved' },
    { key: 'ticket_closed', label: 'Ticket Closed' },
    { key: 'sla_warning', label: 'SLA Breach Warning' },
    { key: 'asset_assigned', label: 'Asset Assigned to User' },
    { key: 'warranty_expiry', label: 'Asset Warranty Expiring Soon' },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Email Provider Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border rounded-lg bg-slate-50/50">
          <div className="space-y-2">
            <Label>From Name</Label>
            <Input 
              value={formData.provider.from_name} 
              onChange={e => setFormData(prev => ({...prev, provider: {...prev.provider, from_name: e.target.value}}))} 
            />
          </div>
          <div className="space-y-2">
            <Label>From Email Address</Label>
            <Input 
              type="email"
              value={formData.provider.from_email} 
              onChange={e => setFormData(prev => ({...prev, provider: {...prev.provider, from_email: e.target.value}}))} 
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Reply-To Email Address</Label>
            <Input 
              type="email"
              value={formData.provider.reply_to} 
              onChange={e => setFormData(prev => ({...prev, provider: {...prev.provider, reply_to: e.target.value}}))} 
            />
          </div>
          <div className="md:col-span-2 p-3 bg-muted text-sm rounded">
            <strong>Note:</strong> Email delivery is handled securely via Supabase Edge Functions + Resend. The Resend API Key is managed in the secure Supabase environment variables.
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Notification Triggers</h3>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead className="text-center w-[150px]">In-App (Bell)</TableHead>
                <TableHead className="text-center w-[150px]">Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eventList.map(event => (
                <TableRow key={event.key}>
                  <TableCell className="font-medium">{event.label}</TableCell>
                  <TableCell className="text-center">
                    <Switch 
                      checked={!!formData.in_app[event.key]}
                      onCheckedChange={c => handleToggle('in_app', event.key, c)}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch 
                      checked={!!formData.email[event.key]}
                      onCheckedChange={c => handleToggle('email', event.key, c)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t">
        <Button type="submit" disabled={updateMutation.isPending}>
          {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Triggers
        </Button>
      </div>
    </form>
  );
}

function EmailTemplatesManager({ templates, queryClient }: { templates: any, queryClient: any }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [formData, setFormData] = useState({ subject_template: '', body_template: '', is_active: true });
  const [testEmail, setTestEmail] = useState('');

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      return await api.put(`/settings/email-templates/${editingTemplate.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email_templates'] });
      setIsModalOpen(false);
      alert(`Template updated successfully`);
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to save template');
    }
  });

  const testEmailMutation = useMutation({
    mutationFn: async () => {
      return await api.post(`/settings/email-templates/test`, {
        to_email: testEmail,
        subject: `[Test] ${editingTemplate?.subject_template.replace('{{ticket_number}}', 'DSP-2026-00102')}`,
        html_body: editingTemplate?.body_template
          .replace('{{ticket_number}}', 'DSP-2026-00102')
          .replace('{{employee_name}}', 'Jane Doe')
          .replace('{{subject}}', 'Sample Ticket Subject')
          .replace('{{priority}}', 'High')
          .replace('{{ticket_url}}', 'http://localhost:5173/tickets/DSP-2026-00102')
          .replace('{{company_name}}', 'Acme Corp')
      });
    },
    onSuccess: () => {
      setIsTestModalOpen(false);
      setTestEmail('');
      alert('Test email sent successfully via Edge Function!');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to send test email');
    }
  });

  const openModal = (template: any) => {
    setEditingTemplate(template);
    setFormData({ 
      subject_template: template.subject_template, 
      body_template: template.body_template, 
      is_active: template.is_active 
    });
    setIsModalOpen(true);
  };

  const openTestModal = (template: any) => {
    setEditingTemplate(template);
    setIsTestModalOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event Trigger Name</TableHead>
              <TableHead>Subject Template</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates?.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No templates configured</TableCell></TableRow>
            )}
            {templates?.map((t: any) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.event_name}</TableCell>
                <TableCell className="text-muted-foreground truncate max-w-[300px]">{t.subject_template}</TableCell>
                <TableCell>
                  <Badge variant={t.is_active ? 'default' : 'secondary'}>{t.is_active ? 'Active' : 'Inactive'}</Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="outline" size="sm" onClick={() => openTestModal(t)}>
                    <Send className="h-4 w-4 mr-2" /> Test
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openModal(t)}>
                    <Edit className="h-4 w-4 mr-2" /> Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Template: {editingTemplate?.event_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email Subject</Label>
              <Input value={formData.subject_template} onChange={e => setFormData({...formData, subject_template: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>HTML Body</Label>
              <Textarea 
                value={formData.body_template} 
                onChange={e => setFormData({...formData, body_template: e.target.value})} 
                className="h-64 font-mono text-sm"
              />
            </div>
            
            <div className="bg-slate-50 p-3 rounded text-sm border space-y-1">
              <strong>Available Variables:</strong>
              <p className="text-muted-foreground font-mono text-xs">
                {`{{ticket_number}}, {{employee_name}}, {{subject}}, {{priority}}, {{ticket_url}}, {{technician_name}}, {{company_name}}`}
              </p>
            </div>

            <div className="flex items-center space-x-2 mt-4">
              <Switch checked={formData.is_active} onCheckedChange={c => setFormData({...formData, is_active: c})} />
              <Label>Enable Template</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={() => mutation.mutate(formData)} disabled={!formData.subject_template || mutation.isPending}>
              {mutation.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : 'Save Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isTestModalOpen} onOpenChange={setIsTestModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Test Email: {editingTemplate?.event_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              This will invoke the Supabase Edge Function to send a real email using Resend, substituting mock data into the variables.
            </p>
            <div className="space-y-2">
              <Label>Send To Email Address</Label>
              <Input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="your.email@example.com" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTestModalOpen(false)}>Cancel</Button>
            <Button onClick={() => testEmailMutation.mutate()} disabled={!testEmail || testEmailMutation.isPending}>
              {testEmailMutation.isPending ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              {testEmailMutation.isPending ? 'Sending...' : 'Send Email'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
