import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { z } from 'zod';

const articleSchema = z.object({
  title: z.string().min(3),
  slug: z.string().min(3),
  content: z.string(),
  excerpt: z.string().optional(),
  category_id: z.string().uuid(),
  status: z.enum(['Draft', 'In Review', 'Published', 'Archived']),
  allow_comments: z.boolean().default(true),
  tags: z.array(z.string()).optional()
});

const serviceRequestSchema = z.object({
  service_id: z.string().uuid(),
  ticket_id: z.string().uuid(),
  form_data: z.record(z.any()),
});

export const getArticles = async (req: Request, res: Response) => {
  try {
    const { status, category_id, search } = req.query;
    
    let query = supabaseAdmin
      .from('knowledge_articles')
      .select('*, knowledge_categories(name), author:author_id(id, raw_user_meta_data)');
      
    if (status) query = query.eq('status', status);
    if (category_id) query = query.eq('category_id', category_id);
    
    // For search, use the FTS index or ilike
    if (search) {
      query = query.textSearch('fts', search as string, { type: 'websearch' });
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) throw error;
    res.json({ status: 'success', data });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

export const getArticleBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { data, error } = await supabaseAdmin
      .from('knowledge_articles')
      .select('*, knowledge_categories(name), author:author_id(id, raw_user_meta_data), article_tags(tag)')
      .eq('slug', slug)
      .single();
      
    if (error) throw error;
    
    // Increment views
    await supabaseAdmin
      .from('knowledge_articles')
      .update({ views_count: (data.views_count || 0) + 1 })
      .eq('id', data.id);
      
    res.json({ status: 'success', data });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

export const createArticle = async (req: Request, res: Response) => {
  try {
    const validatedData = articleSchema.parse(req.body);
    const user = (req as any).user;
    
    const { tags, ...articleData } = validatedData;
    
    const { data: article, error: articleError } = await supabaseAdmin
      .from('knowledge_articles')
      .insert([{
        ...articleData,
        author_id: user.id
      }])
      .select()
      .single();
      
    if (articleError) throw articleError;
    
    if (tags && tags.length > 0) {
      const tagInserts = tags.map(tag => ({
        article_id: article.id,
        tag
      }));
      await supabaseAdmin.from('article_tags').insert(tagInserts);
    }
    
    res.status(201).json({ status: 'success', data: article });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message });
  }
};

export const updateArticle = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validatedData = articleSchema.partial().parse(req.body);
    const user = (req as any).user;
    
    // Create version before update
    const { data: oldArticle } = await supabaseAdmin
      .from('knowledge_articles')
      .select('*')
      .eq('id', id)
      .single();
      
    if (oldArticle) {
      await supabaseAdmin
        .from('article_versions')
        .insert([{
          article_id: id,
          version_number: 1, // simplified
          title: oldArticle.title,
          content: oldArticle.content,
          editor_id: user.id
        }]);
    }
    
    const { tags, ...articleData } = validatedData;
    
    const { data, error } = await supabaseAdmin
      .from('knowledge_articles')
      .update(articleData)
      .eq('id', id)
      .select()
      .single();
      
    if (error) throw error;
    
    if (tags) {
      await supabaseAdmin.from('article_tags').delete().eq('article_id', id);
      if (tags.length > 0) {
        const tagInserts = tags.map(tag => ({ article_id: id, tag }));
        await supabaseAdmin.from('article_tags').insert(tagInserts);
      }
    }
    
    res.json({ status: 'success', data });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message });
  }
};

export const rateArticle = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { is_helpful, feedback } = req.body;
    const user = (req as any).user;
    
    const { error } = await supabaseAdmin
      .from('article_ratings')
      .upsert({
        article_id: id,
        user_id: user.id,
        is_helpful,
        feedback
      });
      
    if (error) throw error;
    
    // Update article counts
    const field = is_helpful ? 'helpful_count' : 'not_helpful_count';
    const { data: article } = await supabaseAdmin.from('knowledge_articles').select(field).eq('id', id).single();
    if (article) {
      await supabaseAdmin.from('knowledge_articles').update({ [field]: (article as any)[field] + 1 }).eq('id', id);
    }
    
    res.json({ status: 'success', message: 'Rating saved' });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message });
  }
};

// FAQ Management
export const getFaqs = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('faq_categories')
      .select('*, faqs(*)');
    if (error) throw error;
    res.json({ status: 'success', data });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// SOP Management
export const getSops = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('sop_documents')
      .select('*, departments(name)')
      .eq('status', 'Active');
    if (error) throw error;
    res.json({ status: 'success', data });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

export const getCategories = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('knowledge_categories')
      .select('*')
      .order('name');
    if (error) throw error;
    res.json({ status: 'success', data });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// Admin Categories CRUD
export const createCategory = async (req: Request, res: Response) => {
  try {
    const { name, description, icon } = req.body;
    const { data, error } = await supabaseAdmin
      .from('knowledge_categories')
      .insert([{ name, description, icon }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ status: 'success', data });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message });
  }
};

export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, icon, is_active } = req.body;
    const { data, error } = await supabaseAdmin
      .from('knowledge_categories')
      .update({ name, description, icon, is_active })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    res.json({ status: 'success', data });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message });
  }
};

// Admin FAQ CRUD
export const createFaqCategory = async (req: Request, res: Response) => {
  try {
    const { name, order_index } = req.body;
    const { data, error } = await supabaseAdmin.from('faq_categories').insert([{ name, order_index }]).select().single();
    if (error) throw error;
    res.status(201).json({ status: 'success', data });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message });
  }
};

export const createFaq = async (req: Request, res: Response) => {
  try {
    const { category_id, question, answer, is_published } = req.body;
    const { data, error } = await supabaseAdmin.from('faqs').insert([{ category_id, question, answer, is_published }]).select().single();
    if (error) throw error;
    res.status(201).json({ status: 'success', data });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message });
  }
};

export const updateFaq = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { category_id, question, answer, is_published } = req.body;
    const { data, error } = await supabaseAdmin.from('faqs').update({ category_id, question, answer, is_published }).eq('id', id).select().single();
    if (error) throw error;
    res.json({ status: 'success', data });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message });
  }
};

// Admin SOP CRUD
export const createSop = async (req: Request, res: Response) => {
  try {
    const { title, description, department_id, status, storage_path } = req.body;
    const user = (req as any).user;
    const { data, error } = await supabaseAdmin
      .from('sop_documents')
      .insert([{ title, description, department_id, status, storage_path, created_by: user.id }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ status: 'success', data });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message });
  }
};

export const updateSop = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, department_id, status, storage_path } = req.body;
    const { data, error } = await supabaseAdmin
      .from('sop_documents')
      .update({ title, description, department_id, status, storage_path })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    res.json({ status: 'success', data });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message });
  }
};

export const deleteSop = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from('sop_documents').delete().eq('id', id);
    if (error) throw error;
    res.json({ status: 'success', message: 'SOP deleted' });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message });
  }
};

// Article Comments
export const getArticleComments = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('article_comments')
      .select('*, user:user_id(id, raw_user_meta_data)')
      .eq('article_id', id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json({ status: 'success', data });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

export const addArticleComment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { content, parent_id } = req.body;
    const user = (req as any).user;
    const { data, error } = await supabaseAdmin
      .from('article_comments')
      .insert([{ article_id: id, user_id: user.id, content, parent_id }])
      .select('*, user:user_id(id, raw_user_meta_data)')
      .single();
    if (error) throw error;
    res.status(201).json({ status: 'success', data });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message });
  }
};
