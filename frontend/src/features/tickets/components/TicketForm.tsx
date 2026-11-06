import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm as useHookForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lightbulb, CheckCircle, Video, Loader2, ArrowLeft, Search, UploadCloud, X, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

const ticketSchema = z.object({
  subject: z.string().min(5, 'Subject must be at least 5 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  category_id: z.string().min(1, 'Category is required'),
  asset_id: z.string().optional(),
  ticket_for: z.enum(['myself', 'another']),
  affected_employee_id: z.string().optional(),
  unit_id: z.string().optional(),
  department_id: z.string().optional(),
});

type WizardStep = 'CATEGORY' | 'TROUBLESHOOTING' | 'DETAILS' | 'RESOLVED' | 'SUBMITTING';

export function TicketForm() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [wizardStep, setWizardStep] = useState<WizardStep>('CATEGORY');
  const [selfServiceEventId, setSelfServiceEventId] = useState<string | null>(null);
  
  const [selectedCategory, setSelectedCategory] = useState<any>(null);

  // Employee search state
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);

  // Category search state
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const [debouncedCategorySearch, setDebouncedCategorySearch] = useState('');

  // Attachments state
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(employeeSearchTerm), 500);
    return () => clearTimeout(handler);
  }, [employeeSearchTerm]);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedCategorySearch(categorySearchTerm), 300);
    return () => clearTimeout(handler);
  }, [categorySearchTerm]);

  const { data: rawCategories = [], isLoading: isCategoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      try {
        const res = await api.get('/categories');
        return Array.isArray(res.data?.data) ? res.data.data : [];
      } catch (err) {
        console.error('Error fetching categories:', err);
        return [];
      }
    }
  });

  const categories = Array.isArray(rawCategories) ? rawCategories : [];

  const form = useHookForm<z.infer<typeof ticketSchema>>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      subject: '',
      description: '',
      category_id: '',
      asset_id: 'none',
      ticket_for: 'myself',
      affected_employee_id: undefined,
      unit_id: '',
      department_id: '',
    },
  });

  const ticketFor = form.watch('ticket_for');
  const affectedEmployeeId = form.watch('affected_employee_id');

  const { data: rawEmployeeResults = [], isFetching: isSearching } = useQuery({
    queryKey: ['employees-search', debouncedSearch],
    queryFn: async () => {
      try {
        const q = debouncedSearch?.trim();
        const url = q ? `/employees?q=${encodeURIComponent(q)}&limit=10` : '/employees?limit=10';
        const res = await api.get(url);
        return Array.isArray(res.data?.data) ? res.data.data : [];
      } catch (err) {
        console.error('Error fetching employees:', err);
        return [];
      }
    },
    enabled: ticketFor === 'another',
  });

  const employeeResults = Array.isArray(rawEmployeeResults) ? rawEmployeeResults : [];

  const { data: units = [] } = useQuery({
    queryKey: ['units'],
    queryFn: async () => {
      const res = await api.get('/units');
      return res.data?.data || [];
    }
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const res = await api.get('/departments');
      return res.data?.data || [];
    }
  });

  const activeEmployeeId = ticketFor === 'another' ? affectedEmployeeId : profile?.id;

  const { data: rawAssets = [], isLoading: isAssetsLoading } = useQuery({
    queryKey: ['employee-assets', activeEmployeeId],
    queryFn: async () => {
      if (!activeEmployeeId) return [];
      try {
        const res = await api.get(`/assets?assigned_to=${activeEmployeeId}`);
        return Array.isArray(res.data?.data) ? res.data.data : [];
      } catch (err) {
        console.error('Error fetching employee assets:', err);
        return [];
      }
    },
    enabled: !!activeEmployeeId
  });

  const assets = Array.isArray(rawAssets) ? rawAssets : [];

  useEffect(() => {
    // Auto-select default asset when assets change
    if (assets.length > 0) {
      const defaultAsset = assets.find((a: any) => 
        a.assignments?.some((ass: any) => ass.is_default && ass.assigned_to === activeEmployeeId)
      );
      if (defaultAsset) {
        form.setValue('asset_id', defaultAsset.id);
      } else {
        form.setValue('asset_id', 'none');
      }
    } else {
      form.setValue('asset_id', 'none');
    }
  }, [assets, activeEmployeeId, form]);

  useEffect(() => {
    if (ticketFor === 'myself' && profile) {
      if (profile.unit_id) form.setValue('unit_id', profile.unit_id);
      if (profile.department_id) form.setValue('department_id', profile.department_id);
    }
  }, [profile, ticketFor, form]);

  const handleCategorySelect = async (categoryId: string) => {
    const category = categories.find((c: any) => c.id === categoryId);
    setSelectedCategory(category);
    form.setValue('category_id', categoryId);

    if (category?.self_service_enabled) {
      setIsLoading(true);
      try {
        const payload = {
          category_id: categoryId,
          guidance_shown: {
            title: category.self_service_title,
            description: category.self_service_description,
            steps: category.troubleshooting_steps,
            video: category.video_url
          }
        };
        const res = await api.post('/self-service/events', payload);
        if (res.data?.data?.id) {
          setSelfServiceEventId(res.data.data.id);
        }
        setWizardStep('TROUBLESHOOTING');
      } catch (err) {
        console.error("Failed to init self-service session", err);
        setWizardStep('DETAILS'); // Fallback
      } finally {
        setIsLoading(false);
      }
    } else {
      setWizardStep('DETAILS');
    }
  };

  const updateSelfServiceEvent = async (outcome: string, skip_reason?: string) => {
    if (!selfServiceEventId) return;
    try {
      await api.put(`/self-service/events/${selfServiceEventId}`, {
        outcome,
        skip_reason
      });
    } catch (err) {
      console.error("Failed to update self service event", err);
    }
  };

  const handleSolved = async () => {
    setIsLoading(true);
    await updateSelfServiceEvent('solved');
    setIsLoading(false);
    setWizardStep('RESOLVED');
  };

  const handleEscalate = async () => {
    setIsLoading(true);
    await updateSelfServiceEvent('escalated');
    setIsLoading(false);
    setWizardStep('DETAILS');
  };

  const handleSkip = async () => {
    setIsLoading(true);
    await updateSelfServiceEvent('skipped', 'employee_did_not_have_time');
    setIsLoading(false);
    setWizardStep('DETAILS');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const queryClient = useQueryClient();

  const submitTicket = async (values: z.infer<typeof ticketSchema>) => {
    if (ticketFor === 'another' && !affectedEmployeeId) {
      form.setError('affected_employee_id', { type: 'manual', message: 'Please select an employee' });
      return;
    }
    
    if (selectedCategory?.related_asset_required && (!values.asset_id || values.asset_id === 'none')) {
      form.setError('asset_id', { type: 'manual', message: 'Related Asset is required for this category' });
      return;
    }
    
    setWizardStep('SUBMITTING');
    setError(null);
    try {
      let attachmentsPayload = [];
      
      // Upload files
      if (files.length > 0) {
        for (const file of files) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
          const filePath = `${profile?.id}/${fileName}`;
          
          const { error: uploadError } = await supabase.storage
            .from('ticket_attachments')
            .upload(filePath, file, { cacheControl: '3600', upsert: false });
            
          if (uploadError) throw uploadError;
          
          attachmentsPayload.push({
            file_name: fileName,
            original_filename: file.name,
            file_size: file.size,
            file_type: file.type,
            storage_path: filePath
          });
        }
      }

      const payload = {
        ...values,
        asset_id: (!values.asset_id || values.asset_id === 'none') ? null : values.asset_id,
        unit_id: values.unit_id ? values.unit_id : (ticketFor === 'myself' && profile?.unit_id ? profile.unit_id : null),
        department_id: values.department_id ? values.department_id : (ticketFor === 'myself' && profile?.department_id ? profile.department_id : null),
        affected_employee_id: ticketFor === 'another' ? (values.affected_employee_id || null) : null,
        self_service_event_id: selfServiceEventId || null,
        attachments: attachmentsPayload
      };

      await api.post('/tickets', payload);

      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['tech-active-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['tech-dashboard-data'] });
      navigate('/tickets');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to submit ticket');
      setWizardStep('DETAILS'); // Revert on error
      setIsLoading(false);
    }
  };
  const filteredCategories = categories.filter((c: any) => 
    (c?.name && c.name.toLowerCase().includes(debouncedCategorySearch.toLowerCase())) || 
    (c?.description && c.description.toLowerCase().includes(debouncedCategorySearch.toLowerCase()))
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 max-w-6xl mx-auto w-full">
      <div className="flex justify-between items-center mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {wizardStep === 'CATEGORY' && 'What do you need help with?'}
            {wizardStep === 'TROUBLESHOOTING' && 'Troubleshooting Guidance'}
            {wizardStep === 'DETAILS' && 'Raise a Ticket'}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {wizardStep === 'CATEGORY' && 'Choose a service category to get started'}
            {wizardStep === 'TROUBLESHOOTING' && 'Try these quick steps before creating a ticket'}
            {wizardStep === 'DETAILS' && 'Provide issue details and assign affected employee or asset'}
          </p>
        </div>
        {wizardStep === 'CATEGORY' && (
          <Button variant="outline" size="sm" onClick={() => navigate('/tickets')}>Cancel</Button>
        )}
      </div>

      {wizardStep === 'CATEGORY' && (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="relative mb-3 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search categories..." 
              value={categorySearchTerm} 
              onChange={(e) => setCategorySearchTerm(e.target.value)} 
              className="pl-9 h-9 text-sm bg-background"
            />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            {categories.length === 0 && isCategoriesLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {[1,2,3,4,5,6,7,8].map(i => (
                  <div key={i} className="border rounded-lg p-3.5 h-20 animate-pulse bg-muted/50" />
                ))}
              </div>
            ) : filteredCategories.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <p className="text-sm">No categories found.</p>
                <Button variant="link" size="sm" onClick={() => setCategorySearchTerm('')}>Clear search</Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredCategories.map((c: any) => (
                  <div 
                    key={c.id}
                    onClick={() => handleCategorySelect(c.id)}
                    className="border rounded-lg p-3.5 hover:border-primary hover:shadow-sm cursor-pointer transition-all bg-card flex flex-col justify-center h-22 group"
                  >
                    <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">{c.name}</h3>
                    {c.description && <p className="text-muted-foreground text-xs mt-1 leading-snug line-clamp-2">{c.description}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {wizardStep === 'TROUBLESHOOTING' && selectedCategory && (
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Card className="border-primary/20 bg-primary/5 shadow-sm max-w-4xl mx-auto">
            <CardHeader className="py-3 px-5 border-b bg-primary/10">
              <div className="flex items-center gap-2.5 text-primary">
                <Lightbulb className="h-5 w-5" />
                <CardTitle className="text-base">{selectedCategory.self_service_title || 'Before you raise a ticket, let\'s try to solve this'}</CardTitle>
              </div>
              {selectedCategory.self_service_description && (
                <CardDescription className="text-xs text-foreground/80 mt-1">
                  {selectedCategory.self_service_description}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {selectedCategory.troubleshooting_steps && (
                <div className="prose prose-sm dark:prose-invert bg-card p-3 rounded-md border text-xs max-h-48 overflow-y-auto">
                  {(typeof selectedCategory.troubleshooting_steps === 'string'
                    ? selectedCategory.troubleshooting_steps.split('\n')
                    : Array.isArray(selectedCategory.troubleshooting_steps)
                    ? selectedCategory.troubleshooting_steps
                    : [String(selectedCategory.troubleshooting_steps)]
                  ).map((line: string, i: number) => (
                    <p key={i} className="my-1">{line}</p>
                  ))}
                </div>
              )}

              {selectedCategory.video_url && (
                <div className="bg-card p-3 rounded-md border flex items-center gap-3">
                  <Video className="h-6 w-6 text-primary" />
                  <div>
                    <h4 className="font-medium text-xs">Troubleshooting Video</h4>
                    <a href={selectedCategory.video_url} target="_blank" rel="noreferrer" className="text-primary text-xs hover:underline">
                      Watch Video Tutorial
                    </a>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="bg-background/50 border-t p-4 flex flex-col justify-between items-center gap-2.5">
              <div className="flex flex-col sm:flex-row gap-2.5 w-full">
                <Button variant="default" className="bg-green-600 hover:bg-green-700 flex-1 h-9 text-xs" onClick={handleSolved} disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <CheckCircle className="h-4 w-4 mr-1.5" />}
                  This Solved My Problem
                </Button>
                <Button variant="secondary" className="flex-1 h-9 text-xs" onClick={handleEscalate} disabled={isLoading}>
                  Still Need Help / Raise Ticket
                </Button>
              </div>
              {selectedCategory.allow_skip && (
                <Button variant="ghost" size="sm" className="w-full text-muted-foreground text-xs h-7" onClick={handleSkip} disabled={isLoading}>
                  {selectedCategory.skip_label || 'I Don\'t Have Time / Raise Ticket'}
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>
      )}

      {wizardStep === 'DETAILS' && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submitTicket)} className="flex-1 flex flex-col min-h-0">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-0">
              
              {/* Left Column (8 cols): Subject, Description, Attachments */}
              <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-4">
                <Card className="shadow-sm">
                  <CardHeader className="py-2.5 px-4 border-b">
                    <CardTitle className="text-sm font-semibold">Issue Details</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    <FormField control={form.control} name="subject" render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs font-semibold">Subject *</FormLabel>
                        <FormControl>
                          <Input placeholder="Brief summary of the issue" className="h-9 text-sm" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="description" render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs font-semibold">Description *</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Please describe what happened, error messages, and steps to reproduce..." className="h-28 text-sm resize-none" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader className="py-2.5 px-4 border-b">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-sm font-semibold">Attachments</CardTitle>
                      <span className="text-xs text-muted-foreground">Optional</span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    <div className="border border-dashed rounded-lg p-3 flex flex-col items-center justify-center bg-muted/20 hover:bg-muted/40 transition-colors relative cursor-pointer">
                      <input type="file" multiple className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleFileChange} />
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <UploadCloud className="h-5 w-5 text-primary" />
                        <span className="text-xs font-medium">Drag & drop files or click to upload</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground mt-0.5">PNG, JPG, PDF, DOCX, XLSX, ZIP</span>
                    </div>

                    {files.length > 0 && (
                      <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                        {files.map((file, i) => (
                          <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 bg-muted/60 border rounded-md text-xs">
                            <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="truncate max-w-[150px] font-medium">{file.name}</span>
                            <span className="text-[10px] text-muted-foreground">({(file.size / 1024 / 1024).toFixed(2)}MB)</span>
                            <button type="button" className="text-muted-foreground hover:text-destructive ml-1" onClick={() => removeFile(i)}>
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right Column (4-5 cols): Category, Affected Employee, Related Asset, Actions */}
              <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4">
                <Card className="shadow-sm">
                  <CardHeader className="py-2.5 px-4 border-b">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold">Request Configuration</CardTitle>
                      <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs text-primary hover:text-primary" onClick={() => setWizardStep('CATEGORY')}>
                        <ArrowLeft className="mr-1 h-3 w-3" /> Change
                      </Button>
                    </div>
                    <CardDescription className="text-xs flex items-center gap-1.5 mt-0.5">
                      <span>Category:</span>
                      <span className="font-semibold text-foreground">{selectedCategory?.name}</span>
                      {selectedCategory?.technician_required && (
                        <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded text-[10px] font-medium">Tech Required</span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4">
                    {/* Who is ticket for */}
                    <div className="space-y-1.5">
                      <FormField control={form.control} name="ticket_for" render={({ field }) => (
                        <FormItem className="space-y-1.5">
                          <FormLabel className="text-xs font-semibold">Who is this ticket for?</FormLabel>
                          <div className="grid grid-cols-2 gap-2">
                            <label className={cn("flex items-center justify-center gap-1.5 border p-2 rounded-md cursor-pointer text-xs font-medium hover:border-primary transition-colors text-center", field.value === 'myself' && "border-primary bg-primary/10 text-primary")}>
                              <input type="radio" value="myself" checked={field.value === 'myself'} onChange={(e) => { field.onChange(e); form.setValue('affected_employee_id', undefined); }} className="sr-only" />
                              <span>Myself</span>
                            </label>
                            <label className={cn("flex items-center justify-center gap-1.5 border p-2 rounded-md cursor-pointer text-xs font-medium hover:border-primary transition-colors text-center", field.value === 'another' && "border-primary bg-primary/10 text-primary")}>
                              <input type="radio" value="another" checked={field.value === 'another'} onChange={field.onChange} className="sr-only" />
                              <span>Another Employee</span>
                            </label>
                          </div>
                        </FormItem>
                      )} />

                      {ticketFor === 'myself' && profile && (
                        <div className="bg-muted/40 border px-3 py-1.5 rounded-md text-xs">
                          <span className="font-semibold">{profile.full_name}</span> &middot; <span className="text-muted-foreground">{profile.email_address}</span>
                        </div>
                      )}

                      {ticketFor === 'another' && (
                        <FormField control={form.control} name="affected_employee_id" render={({ field }) => (
                          <FormItem className="relative space-y-1">
                            {!field.value ? (
                              <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                <Input 
                                  placeholder="Type name, email, or ID..." 
                                  className="pl-8 h-8 text-xs"
                                  value={employeeSearchTerm}
                                  onFocus={() => setIsSearchFocused(true)}
                                  onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                                  onChange={(e) => {
                                    setEmployeeSearchTerm(e.target.value);
                                    setIsSearchFocused(true);
                                  }}
                                />
                              </div>
                            ) : (
                              <div className="bg-primary/5 border border-primary/20 p-2.5 rounded-md text-xs flex justify-between items-center">
                                <div className="flex flex-col overflow-hidden mr-2">
                                  <span className="font-semibold text-primary truncate">{selectedEmployee?.full_name || employeeSearchTerm}</span>
                                  <span className="text-[10px] text-muted-foreground truncate">{selectedEmployee?.email_address ? `${selectedEmployee.email_address} · ${selectedEmployee.department?.name || 'No Dept'}` : 'Selected Employee'}</span>
                                </div>
                                <Button 
                                  type="button" 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-6 px-2 text-[10px] shrink-0" 
                                  onClick={() => { 
                                    field.onChange(undefined); 
                                    setEmployeeSearchTerm(''); 
                                    setSelectedEmployee(null);
                                    setIsSearchFocused(true);
                                  }}
                                >
                                  Change
                                </Button>
                              </div>
                            )}

                            {isSearchFocused && !field.value && (
                              <div className="absolute z-30 w-full mt-1 bg-popover border shadow-lg rounded-md overflow-hidden text-xs max-h-48 overflow-y-auto">
                                {isSearching ? (
                                  <div className="p-2.5 text-muted-foreground flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin"/> Searching...</div>
                                ) : employeeResults.length > 0 ? (
                                  employeeResults.map((emp: any) => (
                                    <div 
                                      key={emp.id} 
                                      className="p-2.5 hover:bg-muted cursor-pointer flex flex-col border-b last:border-0 transition-colors" 
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        field.onChange(emp.id);
                                        setEmployeeSearchTerm(emp.full_name);
                                        setSelectedEmployee(emp);
                                        setIsSearchFocused(false);
                                        
                                        // Auto-fill Unit and Department
                                        const matchedUnit = units.find((u: any) => u.id === emp.unit_id || (u.name && emp.unit?.name && u.name.toLowerCase() === emp.unit.name.toLowerCase()));
                                        const matchedDept = departments.find((d: any) => d.id === emp.department_id || (d.name && emp.department?.name && d.name.toLowerCase() === emp.department.name.toLowerCase()));
                                        if (matchedUnit) form.setValue('unit_id', matchedUnit.id);
                                        if (matchedDept) form.setValue('department_id', matchedDept.id);
                                      }}
                                    >
                                      <span className="font-medium text-foreground">{emp.full_name}</span>
                                      <span className="text-[10px] text-muted-foreground">{emp.email_address} &middot; {emp.department?.name || 'No Dept'}</span>
                                    </div>
                                  ))
                                ) : (
                                  <div className="p-2.5 text-muted-foreground">No employees found.</div>
                                )}
                              </div>
                            )}
                            <FormMessage />
                          </FormItem>
                        )} />
                      )}
                    </div>

                    {/* Unit & Department (Auto-filled but editable) */}
                    {ticketFor === 'another' && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <FormField control={form.control} name="unit_id" render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormLabel className="text-[10px] font-semibold text-muted-foreground">Business Unit</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || undefined}>
                              <FormControl>
                                <SelectTrigger className="h-7 text-xs bg-muted/20">
                                  <SelectValue placeholder="Auto-filled" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {units.map((u: any) => (
                                  <SelectItem key={u.id} value={u.id} className="text-xs">{u.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />

                        <FormField control={form.control} name="department_id" render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormLabel className="text-[10px] font-semibold text-muted-foreground">Department</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || undefined}>
                              <FormControl>
                                <SelectTrigger className="h-7 text-xs bg-muted/20">
                                  <SelectValue placeholder="Auto-filled" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {departments.map((d: any) => (
                                  <SelectItem key={d.id} value={d.id} className="text-xs">{d.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                      </div>
                    )}

                    {/* Asset */}
                    <div className="space-y-1">
                      <FormField control={form.control} name="asset_id" render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-xs font-semibold">Related Asset {selectedCategory?.related_asset_required ? '*' : '(Optional)'}</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || 'none'} disabled={isAssetsLoading}>
                            <FormControl>
                              <SelectTrigger className="h-9 text-xs">
                                <SelectValue placeholder={isAssetsLoading ? "Loading assets..." : "Select an asset"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {!selectedCategory?.related_asset_required && <SelectItem value="none">No specific asset</SelectItem>}
                              {assets.length === 0 && selectedCategory?.related_asset_required && <SelectItem value="none" disabled>No assigned assets found</SelectItem>}
                              {assets.map((a: any) => {
                                const isDefault = a.assignments?.some((ass: any) => ass.is_default && ass.assigned_to === activeEmployeeId);
                                return (
                                  <SelectItem key={a.id} value={a.id} className="text-xs">
                                    {isDefault ? '⭐ ' : ''}{a.name} ({a.asset_code}){isDefault ? ' — Default' : ''}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </CardContent>
                  
                  <CardFooter className="p-4 bg-muted/20 border-t flex flex-col gap-2">
                    {error && <div className="text-xs font-medium text-destructive bg-destructive/10 p-2 rounded-md w-full">{error}</div>}
                    <Button type="submit" size="default" disabled={isLoading} className="w-full">
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Submit Ticket
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => navigate('/tickets')} disabled={isLoading} className="w-full text-xs text-muted-foreground">
                      Cancel
                    </Button>
                  </CardFooter>
                </Card>
              </div>

            </div>
          </form>
        </Form>
      )}

      {wizardStep === 'SUBMITTING' && (
        <div className="flex-1 min-h-0 overflow-y-auto pr-2 pb-8">
          <Card className="shadow-md">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
              <h3 className="text-xl font-semibold">Creating your ticket...</h3>
              <p className="text-muted-foreground">Please wait while we process your request and upload files.</p>
            </CardContent>
          </Card>
        </div>
      )}

      {wizardStep === 'RESOLVED' && (
        <div className="flex-1 min-h-0 overflow-y-auto pr-2 pb-8">
          <Card className="border-green-200 bg-green-50 shadow-md">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-6 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-2">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-green-900 mb-2">Great! Your issue appears to be resolved.</h2>
                <p className="text-green-700 max-w-md mx-auto">
                  No ticket was created. This self-service resolution has been recorded to help us improve our knowledge base.
                </p>
              </div>
              <Button size="lg" onClick={() => navigate('/dashboard')} className="mt-4 bg-green-600 hover:bg-green-700">
                Return to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
