import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useKnowledgeStore } from '../../../store/knowledgeStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const articleSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  slug: z.string().min(5, 'Slug must be at least 5 characters'),
  content: z.string().min(10, 'Content is required'),
  category_id: z.string().min(1, 'Category is required'),
  status: z.enum(['Draft', 'In Review', 'Published', 'Archived']),
  allow_comments: z.boolean().default(true),
});

export function ArticleEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { categories, fetchCategories, createArticle, updateArticle } = useKnowledgeStore();
  const [loading, setLoading] = useState(false);
  const isEditing = !!id;

  useEffect(() => {
    fetchCategories();
    if (isEditing) {
      // In a real app we might fetch by ID for the admin editor, but we use what we have or add fetchArticleById.
      // Assuming currentArticle is populated or we need an endpoint. For now just standard form setup.
    }
  }, []);

  const form = useForm<z.infer<typeof articleSchema>>({
    resolver: zodResolver(articleSchema) as any,
    defaultValues: {
      title: '',
      slug: '',
      content: '',
      category_id: '',
      status: 'Draft',
      allow_comments: true,
    }
  });

  const onSubmit = async (values: z.infer<typeof articleSchema>) => {
    setLoading(true);
    try {
      if (isEditing) {
        await updateArticle(id, values);
      } else {
        await createArticle(values);
      }
      navigate('/kb-admin');
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['link', 'image', 'video'],
      ['clean'],
      ['code-block']
    ],
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">{isEditing ? 'Edit Article' : 'Create Article'}</h1>
        <Button variant="outline" onClick={() => navigate('/kb-admin')}>Cancel</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Article Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-6">
              <FormField
                control={form.control as any}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Article title" {...field} onChange={(e) => {
                        field.onChange(e);
                        if (!isEditing) {
                          form.setValue('slug', e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''));
                        }
                      }} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control as any}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL Slug</FormLabel>
                      <FormControl>
                        <Input placeholder="article-url-slug" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control as any}
                  name="category_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control as any}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Draft">Draft</SelectItem>
                        <SelectItem value="In Review">In Review</SelectItem>
                        <SelectItem value="Published">Published</SelectItem>
                        <SelectItem value="Archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <FormLabel>Content</FormLabel>
                <Controller
                  name="content"
                  control={form.control}
                  render={({ field }) => (
                    <ReactQuill 
                      theme="snow" 
                      value={field.value} 
                      onChange={field.onChange} 
                      modules={modules}
                      className="h-96 mb-12"
                    />
                  )}
                />
                {form.formState.errors.content && (
                  <p className="text-sm font-medium text-destructive mt-10">{form.formState.errors.content.message}</p>
                )}
              </div>

              <div className="pt-8 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => navigate('/kb-admin')}>Cancel</Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Article'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
