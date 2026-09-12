import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm as useHookForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { useTicketStore } from '../../../store/ticketStore';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lightbulb, CheckCircle, ArrowRight, Video, FileText, Loader2, ArrowLeft } from 'lucide-react';

const ticketSchema = z.object({
  subject: z.string().min(5, 'Subject must be at least 5 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  category_id: z.string().min(1, 'Category is required'),
  asset_id: z.string().optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']),
  contact_number: z.string().optional(),
});

type WizardStep = 'DETAILS' | 'TROUBLESHOOTING' | 'RESOLVED' | 'SUBMITTING';

export function TicketForm() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const { categories, fetchCategories } = useTicketStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [wizardStep, setWizardStep] = useState<WizardStep>('DETAILS');
  const [selfServiceSessionId, setSelfServiceSessionId] = useState<string | null>(null);
  const [categoryArticles, setCategoryArticles] = useState<any[]>([]);
  const [isArticlesLoading, setIsArticlesLoading] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const form = useHookForm<z.infer<typeof ticketSchema>>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      subject: '',
      description: '',
      category_id: '',
      asset_id: 'none',
      priority: 'Low',
      contact_number: '',
    },
  });

  const { data: myAssets = [] } = useQuery({
    queryKey: ['my-assets'],
    queryFn: async () => {
      const res = await api.get('/assets');
      return res.data.data;
    }
  });

  const selectedCategoryId = form.watch('category_id');

  // Fetch articles immediately when category is selected
  useEffect(() => {
    if (!selectedCategoryId) {
      setCategoryArticles([]);
      return;
    }

    const fetchCategoryArticles = async () => {
      setIsArticlesLoading(true);
      try {
        const { data } = await supabase
          .from('knowledge_articles')
          .select('id, title, excerpt, slug, video_url, troubleshooting_type, estimated_resolution_time')
          .eq('category_id', selectedCategoryId)
          .eq('status', 'Published')
          .eq('self_service_enabled', true)
          .order('views_count', { ascending: false });
        
        setCategoryArticles(data || []);
      } catch (err) {
        console.error("Failed to fetch guidance", err);
      } finally {
        setIsArticlesLoading(false);
      }
    };

    fetchCategoryArticles();

    // Auto-priority logic
    const category = categories.find(c => c.id === selectedCategoryId);
    if (category) {
      let newPriority: 'Low' | 'Medium' | 'High' | 'Critical' = 'Low';
      const name = category.name.toLowerCase();
      if (name.includes('security')) newPriority = 'Critical';
      else if (name.includes('infrastructure') || name.includes('network') || name.includes('erp')) newPriority = 'High';
      else if (name.includes('hardware') || name.includes('software') || name.includes('access request')) newPriority = 'Medium';
      form.setValue('priority', newPriority);
    }
  }, [selectedCategoryId, categories, form]);

  const startSelfServiceSession = async () => {
    try {
      const { data, error } = await supabase
        .from('self_service_sessions')
        .insert([{
          employee_id: profile?.id,
          unit_id: profile?.unit_id,
          department_id: profile?.department_id,
          category_id: selectedCategoryId,
          related_asset_id: form.getValues('asset_id') === 'none' ? null : form.getValues('asset_id') || null,
          subject: form.getValues('subject'),
          status: 'Started'
        }])
        .select()
        .single();
        
      if (error) throw error;
      setSelfServiceSessionId(data.id);
      return data.id;
    } catch (err) {
      console.error("Error starting self-service session", err);
      return null;
    }
  };

  const updateSessionStatus = async (status: string, sessionId: string) => {
    await supabase.from('self_service_sessions').update({ 
      status, 
      completed_at: new Date().toISOString() 
    }).eq('id', sessionId);
  };

  const handleNextStep = async () => {
    // Validate form before proceeding
    const isValid = await form.trigger();
    if (!isValid) return;


    const hasGuidance = categoryArticles.length > 0;
    
    // User feedback: "if not attached its not a self service if it attached to specfic category it is self service"
    if (hasGuidance) {
      setIsLoading(true);
      await startSelfServiceSession();
      setIsLoading(false);
      setWizardStep('TROUBLESHOOTING');
    } else {
      // Proceed directly to submit if no articles are available (Technician Direct)
      submitTicket(null);
    }
  };

  const handleResolved = async () => {
    setIsLoading(true);
    if (selfServiceSessionId) {
      await updateSessionStatus('Solved', selfServiceSessionId);
    }
    setIsLoading(false);
    setWizardStep('RESOLVED');
  };

  const handleNotResolved = async () => {
    setIsLoading(true);
    if (selfServiceSessionId) {
      await updateSessionStatus('Not Solved', selfServiceSessionId);
    }
    submitTicket(selfServiceSessionId);
    // Note: submitTicket changes wizard step, but if error occurs we need to reset loading
    // However submitTicket doesn't reset isLoading on error. Let's fix that.
  };

  const submitTicket = async (sessionId: string | null) => {
    setWizardStep('SUBMITTING');
    setError(null);
    try {
      const values = form.getValues();
      await api.post('/tickets', {
        ...values,
        asset_id: values.asset_id === '' ? 'none' : values.asset_id,
        self_service_session_id: sessionId
      });
      navigate('/tickets');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
      setWizardStep('DETAILS'); // Revert on error
      setIsLoading(false);
    }
  };



  const trackArticleClick = async (article: any) => {
    if (!selfServiceSessionId) return;
    await supabase.from('self_service_interactions').insert([{
      session_id: selfServiceSessionId,
      article_id: article.id,
      interaction_type: 'VIEW_ARTICLE'
    }]);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          {wizardStep === 'TROUBLESHOOTING' ? 'Troubleshooting Guidance' : 'Raise a Ticket'}
        </h1>
        {wizardStep === 'DETAILS' && (
          <Button variant="outline" onClick={() => navigate('/tickets')}>Cancel</Button>
        )}
      </div>

      {wizardStep === 'DETAILS' && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Ticket Details</CardTitle>
            <CardDescription>Please provide the necessary information to help us assist you.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form className="space-y-6">
                <FormField control={form.control} name="category_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select the relevant category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="subject" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject</FormLabel>
                    <FormControl>
                      <Input placeholder="Brief summary of the issue" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="asset_id" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Related Asset (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an asset" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {myAssets.map((a: any) => (
                            <SelectItem key={a.id} value={a.id}>{a.name} ({a.asset_code})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="priority" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority (Auto-assigned)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled>
                        <FormControl>
                          <SelectTrigger className="bg-muted">
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Low">Low</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="High">High</SelectItem>
                          <SelectItem value="Critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Please describe the issue in detail" className="h-32" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {error && <div className="text-sm font-medium text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>}

                <div className="flex justify-end pt-4">
                  <Button type="button" size="lg" onClick={handleNextStep} disabled={isLoading || isArticlesLoading} className="w-full sm:w-auto">
                    {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                    {categoryArticles.length > 0 ? (
                      <>Continue <ArrowRight className="ml-2 h-4 w-4" /></>
                    ) : (
                      'Submit Ticket'
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {wizardStep === 'TROUBLESHOOTING' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="border-primary/20 bg-primary/5 shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3 text-primary">
                <Lightbulb className="h-6 w-6" />
                <CardTitle>Before you raise a ticket, let's try to solve this</CardTitle>
              </div>
              <CardDescription className="text-base mt-2 text-foreground/80">
                Based on the <strong>{categories.find((c: any) => c.id === selectedCategoryId)?.name}</strong> category, we found the following potential solutions. Please review them before continuing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {categoryArticles.map((article: any) => (
                <a 
                  key={article.id} 
                  href={`/help-center/article/${article.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => trackArticleClick(article)}
                  className="block p-4 bg-card border rounded-lg hover:border-primary/50 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-start gap-4">
                    <div className="bg-primary/10 p-3 rounded-md group-hover:bg-primary/20 transition-colors">
                      {article.video_url ? <Video className="h-6 w-6 text-primary" /> : <FileText className="h-6 w-6 text-primary" />}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-base group-hover:text-primary transition-colors">{article.title}</h4>
                      {article.excerpt && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{article.excerpt}</p>}
                      
                      <div className="flex items-center gap-4 mt-3 text-xs font-medium text-muted-foreground">
                        {article.troubleshooting_type && (
                          <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> {article.troubleshooting_type}</span>
                        )}
                        {article.estimated_resolution_time && (
                          <span className="flex items-center gap-1">⏱ {article.estimated_resolution_time} min read/watch</span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </a>
              ))}
            </CardContent>
            <CardFooter className="bg-background/50 border-t p-6 flex flex-col sm:flex-row justify-between items-center gap-4">
              <Button variant="ghost" onClick={() => setWizardStep('DETAILS')} className="w-full sm:w-auto order-2 sm:order-1">
                <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
              </Button>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto order-1 sm:order-2">
                <Button variant="default" className="bg-green-600 hover:bg-green-700 w-full sm:w-auto" onClick={handleResolved} disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  This Solved My Problem
                </Button>
                <Button variant="secondary" className="w-full sm:w-auto" onClick={handleNotResolved} disabled={isLoading}>
                  Still Need Help / Raise Ticket
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      )}

      {wizardStep === 'SUBMITTING' && (
        <Card className="shadow-md">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
            <h3 className="text-xl font-semibold">Creating your ticket...</h3>
            <p className="text-muted-foreground">Please wait while we route your request to the correct unit.</p>
          </CardContent>
        </Card>
      )}

      {wizardStep === 'RESOLVED' && (
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
      )}
    </div>
  );
}
