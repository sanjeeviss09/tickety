import { useEffect } from 'react';
import { useKnowledgeStore } from '../../../store/knowledgeStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Download, FileText, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '../../../lib/supabase';

export function FaqSopBrowser() {
  const { faqs, sops, fetchFaqs, fetchSops, loading } = useKnowledgeStore();

  useEffect(() => {
    fetchFaqs();
    fetchSops();
  }, [fetchFaqs, fetchSops]);

  if (loading) {
    return <div className="py-20 text-center">Loading...</div>;
  }

  return (
    <div className="space-y-12">
      <section>
        <div className="mb-6">
          <h2 className="text-3xl font-bold tracking-tight">Frequently Asked Questions</h2>
          <p className="text-muted-foreground mt-2">Quick answers to common issues.</p>
        </div>

        <div className="space-y-8">
          {faqs.map((category: any) => (
            <div key={category.id} className="space-y-4">
              <h3 className="text-xl font-semibold border-b pb-2">{category.name}</h3>
              <Accordion type="single" collapsible className="w-full">
                {category.faqs?.map((faq: any) => (
                  <AccordionItem key={faq.id} value={faq.id}>
                    <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
                {(!category.faqs || category.faqs.length === 0) && (
                  <p className="text-sm text-muted-foreground py-4">No FAQs in this category.</p>
                )}
              </Accordion>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-6">
          <h2 className="text-3xl font-bold tracking-tight">Policies & SOPs</h2>
          <p className="text-muted-foreground mt-2">Download official company documents, manuals, and standard operating procedures.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {sops.map((sop: any) => (
            <Card key={sop.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" /> {sop.title}
                </CardTitle>
                <CardDescription>{sop.departments?.name || 'Company Wide'}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">{sop.description}</p>
                <Button variant="outline" className="w-full" onClick={async () => {
                  try {
                    const { data, error } = await supabase.storage.from('sop_documents').createSignedUrl(sop.storage_path, 60 * 60);
                    if (error) throw error;
                    window.open(data.signedUrl, '_blank');
                  } catch (err) {
                    console.error('Error getting download link', err);
                    alert('Could not download document. It might have been removed.');
                  }
                }}>
                  <ExternalLink className="mr-2 h-4 w-4" /> Open Document
                </Button>
              </CardContent>
            </Card>
          ))}
          {sops.length === 0 && (
            <div className="col-span-2 text-center py-12 text-muted-foreground border rounded-lg bg-card">
              No policies or SOPs available for download.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
