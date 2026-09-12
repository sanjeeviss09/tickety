import { useState, useEffect } from 'react';
import { useKnowledgeStore } from '../../../store/knowledgeStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export function FaqManager() {
  const { faqs, fetchFaqs, createFaq, updateFaq, createFaqCategory } = useKnowledgeStore();
  const [loading, setLoading] = useState(false);
  const [isFaqOpen, setIsFaqOpen] = useState(false);
  const [isCatOpen, setIsCatOpen] = useState(false);
  const [formData, setFormData] = useState({ category_id: '', question: '', answer: '', is_published: true });
  const [catData, setCatData] = useState({ name: '', order_index: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchFaqs();
  }, [fetchFaqs]);

  const handleSaveFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        await updateFaq(editingId, formData);
      } else {
        await createFaq(formData);
      }
      setIsFaqOpen(false);
      setFormData({ category_id: '', question: '', answer: '', is_published: true });
      setEditingId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCat = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createFaqCategory(catData);
      setIsCatOpen(false);
      setCatData({ name: '', order_index: 0 });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (faq: any) => {
    setFormData({ category_id: faq.category_id, question: faq.question, answer: faq.answer, is_published: faq.is_published });
    setEditingId(faq.id);
    setIsFaqOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">FAQ Manager</h2>
        <div className="flex gap-2">
          <Dialog open={isCatOpen} onOpenChange={setIsCatOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Plus className="mr-2 h-4 w-4" /> New Category</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New FAQ Category</DialogTitle></DialogHeader>
              <form onSubmit={handleSaveCat} className="space-y-4">
                <div className="space-y-2">
                  <Label>Category Name</Label>
                  <Input required value={catData.name} onChange={e => setCatData({ ...catData, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Order Index</Label>
                  <Input type="number" required value={catData.order_index} onChange={e => setCatData({ ...catData, order_index: parseInt(e.target.value) })} />
                </div>
                <Button type="submit" disabled={loading} className="w-full">Save Category</Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isFaqOpen} onOpenChange={(open) => { setIsFaqOpen(open); if(!open) setEditingId(null); }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> New FAQ</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingId ? 'Edit FAQ' : 'New FAQ'}</DialogTitle></DialogHeader>
              <form onSubmit={handleSaveFaq} className="space-y-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={formData.category_id} onValueChange={(val) => setFormData({ ...formData, category_id: val })}>
                    <SelectTrigger><SelectValue placeholder="Select Category" /></SelectTrigger>
                    <SelectContent>
                      {faqs.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Question</Label>
                  <Input required value={formData.question} onChange={e => setFormData({ ...formData, question: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Answer</Label>
                  <Textarea required value={formData.answer} onChange={e => setFormData({ ...formData, answer: e.target.value })} className="h-32" />
                </div>
                <Button type="submit" disabled={loading} className="w-full">Save FAQ</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-6">
        {faqs.map((category) => (
          <Card key={category.id}>
            <CardHeader className="py-4">
              <CardTitle className="text-lg">{category.name}</CardTitle>
            </CardHeader>
            <CardContent>
              {category.faqs && category.faqs.length > 0 ? (
                <div className="divide-y border rounded-md">
                  {category.faqs.map((faq: any) => (
                    <div key={faq.id} className="p-4 flex justify-between items-start hover:bg-muted/50 transition-colors">
                      <div className="space-y-1 pr-6">
                        <p className="font-medium text-sm">{faq.question}</p>
                        <p className="text-sm text-muted-foreground">{faq.answer}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(faq)} className="shrink-0">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No FAQs in this category.</p>
              )}
            </CardContent>
          </Card>
        ))}
        {faqs.length === 0 && (
          <p className="text-muted-foreground text-center py-8">No FAQ categories found.</p>
        )}
      </div>
    </div>
  );
}
