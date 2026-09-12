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
import { Loader2, Save, Plus, Edit, Hash, Tags, Flag, Palette } from 'lucide-react';

export function TicketSettings() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('numbering');

  const { data: ticketConfig, isLoading: configLoading } = useQuery({
    queryKey: ['settings', 'ticket_config'],
    queryFn: async () => {
      const res = await api.get('/settings/ticket_config');
      return res.data.data;
    }
  });

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/categories');
      return res.data.data;
    }
  });

  if (configLoading || categoriesLoading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Ticket Configuration</CardTitle>
          <CardDescription>
            Configure how tickets are generated, categorized, and prioritized.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList>
              <TabsTrigger value="numbering" className="flex items-center gap-2">
                <Hash className="h-4 w-4" /> Numbering & Status
              </TabsTrigger>
              <TabsTrigger value="categories" className="flex items-center gap-2">
                <Tags className="h-4 w-4" /> Categories
              </TabsTrigger>
              <TabsTrigger value="priorities" className="flex items-center gap-2">
                <Flag className="h-4 w-4" /> Priorities
              </TabsTrigger>
            </TabsList>

            <TabsContent value="numbering">
              <NumberingAndStatusManager config={ticketConfig} queryClient={queryClient} />
            </TabsContent>

            <TabsContent value="categories">
              <CategoriesManager categories={categories} queryClient={queryClient} />
            </TabsContent>

            <TabsContent value="priorities">
              <PrioritiesManager config={ticketConfig} queryClient={queryClient} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function NumberingAndStatusManager({ config, queryClient }: { config: any, queryClient: any }) {
  const [formData, setFormData] = useState({
    prefix: config?.prefix || 'DSP',
    include_year: config?.include_year ?? true,
    number_length: config?.number_length || 6,
    starting_number: config?.starting_number || 1,
    status_config: config?.status_config || {}
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.put('/settings/ticket_config', { value: payload });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'ticket_config'] });
      alert('Ticket numbering and statuses saved successfully.');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to save settings');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      ...config,
      ...formData,
      number_length: Number(formData.number_length),
      starting_number: Number(formData.starting_number)
    });
  };

  const handleStatusChange = (statusKey: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      status_config: {
        ...prev.status_config,
        [statusKey]: {
          ...prev.status_config[statusKey],
          [field]: value
        }
      }
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Ticket Number Generation</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border rounded-lg bg-slate-50/50">
          <div className="space-y-2">
            <Label>Ticket Prefix</Label>
            <Input value={formData.prefix} onChange={e => setFormData({...formData, prefix: e.target.value})} required />
          </div>
          <div className="space-y-2 flex flex-col justify-end">
            <div className="flex items-center space-x-2 h-10">
              <Switch checked={formData.include_year} onCheckedChange={c => setFormData({...formData, include_year: c})} />
              <Label>Include Current Year (e.g. {new Date().getFullYear()})</Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Sequence Number Length</Label>
            <Input type="number" min="3" max="10" value={formData.number_length} onChange={e => setFormData({...formData, number_length: e.target.value})} required />
          </div>
          <div className="space-y-2">
            <Label>Starting Sequence Number</Label>
            <Input type="number" min="1" value={formData.starting_number} onChange={e => setFormData({...formData, starting_number: e.target.value})} required />
          </div>
          <div className="md:col-span-2 p-3 bg-blue-50 text-blue-800 rounded text-sm border border-blue-200">
            <strong>Preview: </strong> 
            {formData.prefix}-
            {formData.include_year ? `${new Date().getFullYear()}-` : ''}
            {String(formData.starting_number).padStart(Number(formData.number_length), '0')}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Ticket Statuses (UI Configuration)</h3>
        <p className="text-sm text-muted-foreground mb-4">
          The underlying system states are fixed to ensure workflow integrity. You can customize the display name, color, and active state here.
        </p>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>System Key</TableHead>
                <TableHead>Display Name</TableHead>
                <TableHead>Color Theme</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.keys(formData.status_config).map(key => {
                const status = formData.status_config[key];
                return (
                  <TableRow key={key}>
                    <TableCell className="font-medium">{key}</TableCell>
                    <TableCell>
                      <Input 
                        value={status.display_name} 
                        onChange={e => handleStatusChange(key, 'display_name', e.target.value)} 
                        className="h-8 max-w-[200px]"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Palette className="h-4 w-4 text-muted-foreground" />
                        <select 
                          className="flex h-8 w-[140px] items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                          value={status.color}
                          onChange={e => handleStatusChange(key, 'color', e.target.value)}
                        >
                          <option value="blue">Blue</option>
                          <option value="indigo">Indigo</option>
                          <option value="purple">Purple</option>
                          <option value="pink">Pink</option>
                          <option value="red">Red</option>
                          <option value="orange">Orange</option>
                          <option value="yellow">Yellow</option>
                          <option value="green">Green</option>
                          <option value="emerald">Emerald</option>
                          <option value="gray">Gray</option>
                          <option value="slate">Slate</option>
                        </select>
                        <Badge variant="outline" className={`bg-${status.color}-100 text-${status.color}-800 border-${status.color}-200`}>
                          Preview
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch 
                        checked={status.active} 
                        onCheckedChange={c => handleStatusChange(key, 'active', c)} 
                        disabled={['Open', 'Closed', 'Resolved'].includes(key)} // Protect critical statuses
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t">
        <Button type="submit" disabled={updateMutation.isPending}>
          {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Numbering & Statuses
        </Button>
      </div>
    </form>
  );
}

function CategoriesManager({ categories, queryClient }: { categories: any, queryClient: any }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', description: '', is_active: true, self_service_mode: 'Optional', guidance_enabled: true });

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingCategory) {
        return await api.put(`/categories/${editingCategory.id}`, payload);
      } else {
        return await api.post('/categories', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setIsModalOpen(false);
      alert(`Category ${editingCategory ? 'updated' : 'created'} successfully`);
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to save category');
    }
  });

  const openModal = (category?: any) => {
    if (category) {
      setEditingCategory(category);
      setFormData({ 
        name: category.name, 
        description: category.description || '', 
        is_active: category.is_active,
        self_service_mode: category.self_service_mode || 'Optional',
        guidance_enabled: category.guidance_enabled ?? true
      });
    } else {
      setEditingCategory(null);
      setFormData({ name: '', description: '', is_active: true, self_service_mode: 'Optional', guidance_enabled: true });
    }
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Ticket Categories</h3>
        <Button onClick={() => openModal()}><Plus className="h-4 w-4 mr-2" /> Add Category</Button>
      </div>
      
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Self-Service Mode</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories?.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-muted-foreground">{c.description || '-'}</TableCell>
                <TableCell>
                  {c.guidance_enabled ? (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700">{c.self_service_mode || 'Optional'}</Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">Disabled</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={c.is_active ? 'default' : 'secondary'}>{c.is_active ? 'Active' : 'Inactive'}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => openModal(c)}>
                    <Edit className="h-4 w-4 mr-2" /> Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Edit Category' : 'Create Category'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Category Name *</Label>
              <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
            </div>
            
            <div className="space-y-4 pt-4 border-t mt-4">
              <h4 className="font-medium text-sm">Self-Service Troubleshooting</h4>
              <p className="text-xs text-muted-foreground">If knowledge articles are available for this category, they will be shown to users before ticket creation.</p>
              
              <div className="flex items-center space-x-2">
                <Switch checked={formData.guidance_enabled} onCheckedChange={c => setFormData({...formData, guidance_enabled: c})} />
                <Label>Enable Self-Service Guidance</Label>
              </div>

              {formData.guidance_enabled && (
                <div className="space-y-2">
                  <Label>Guidance Mode</Label>
                  <select 
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={formData.self_service_mode}
                    onChange={e => setFormData({...formData, self_service_mode: e.target.value})}
                  >
                    <option value="Optional">Self-Service Optional (User can skip)</option>
                    <option value="Self-Service First">Self-Service First (User must review guidance)</option>
                    <option value="Technician Direct">Technician Direct (Skip guidance entirely)</option>
                  </select>
                </div>
              )}
            </div>
            {editingCategory && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2 mt-4">
                  <Switch checked={formData.is_active} onCheckedChange={c => setFormData({...formData, is_active: c})} />
                  <Label>Active</Label>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={() => mutation.mutate(formData)} disabled={!formData.name || mutation.isPending}>
              {mutation.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PrioritiesManager({ config, queryClient }: { config: any, queryClient: any }) {
  const [formData, setFormData] = useState({
    priority_config: config?.priority_config || {}
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.put('/settings/ticket_config', { value: payload });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'ticket_config'] });
      alert('Ticket priorities saved successfully.');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to save settings');
    }
  });

  const handlePriorityChange = (priorityKey: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      priority_config: {
        ...prev.priority_config,
        [priorityKey]: {
          ...prev.priority_config[priorityKey],
          [field]: value
        }
      }
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      ...config,
      ...formData
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Ticket Priorities (UI Configuration)</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Customize the display name and color for system priorities. Note: SLAs are configured in the separate SLA Settings module.
        </p>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>System Key</TableHead>
                <TableHead>Display Name</TableHead>
                <TableHead>Color Theme</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.keys(formData.priority_config).map(key => {
                const priority = formData.priority_config[key];
                return (
                  <TableRow key={key}>
                    <TableCell className="font-medium">{key}</TableCell>
                    <TableCell>
                      <Input 
                        value={priority.display_name} 
                        onChange={e => handlePriorityChange(key, 'display_name', e.target.value)} 
                        className="h-8 max-w-[200px]"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Palette className="h-4 w-4 text-muted-foreground" />
                        <select 
                          className="flex h-8 w-[140px] items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                          value={priority.color}
                          onChange={e => handlePriorityChange(key, 'color', e.target.value)}
                        >
                          <option value="blue">Blue</option>
                          <option value="indigo">Indigo</option>
                          <option value="purple">Purple</option>
                          <option value="red">Red</option>
                          <option value="orange">Orange</option>
                          <option value="yellow">Yellow</option>
                          <option value="green">Green</option>
                          <option value="gray">Gray</option>
                        </select>
                        <Badge variant="outline" className={`bg-${priority.color}-100 text-${priority.color}-800 border-${priority.color}-200`}>
                          Preview
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch 
                        checked={priority.active} 
                        onCheckedChange={c => handlePriorityChange(key, 'active', c)} 
                        disabled={['Low', 'Medium', 'High', 'Critical'].includes(key)} // Can't disable system priorities currently
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t">
        <Button type="submit" disabled={updateMutation.isPending}>
          {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Priorities
        </Button>
      </div>
    </form>
  );
}
