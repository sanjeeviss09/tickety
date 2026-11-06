import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

export const getCategories = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('ticket_categories')
      .select('*')
      .order('name');
      
    if (error) throw error;
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

import { z } from 'zod';

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  is_active: z.boolean().optional(),
  self_service_mode: z.string().optional(),
  guidance_enabled: z.boolean().optional(),
  self_service_enabled: z.boolean().optional(),
  technician_required: z.boolean().optional(),
  self_service_title: z.string().optional().nullable(),
  self_service_description: z.string().optional().nullable(),
  troubleshooting_steps: z.string().optional().nullable(),
  knowledge_article_id: z.string().uuid().optional().nullable(),
  video_url: z.string().optional().nullable(),
  allow_skip: z.boolean().optional(),
  skip_label: z.string().optional().nullable(),
  default_priority: z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
  default_sla: z.number().int().optional().nullable(),
  related_asset_required: z.boolean().optional(),
});

export const createCategory = async (req: Request, res: Response) => {
  try {
    const validatedData = categorySchema.parse(req.body);

    const { data, error } = await supabaseAdmin
      .from('ticket_categories')
      .insert([validatedData])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ status: 'success', message: 'Category created successfully', data });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ status: 'error', message: error.issues.map(i => i.message).join(', ') });
    }
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validatedData = categorySchema.partial().parse(req.body);

    const { data, error } = await supabaseAdmin
      .from('ticket_categories')
      .update(validatedData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ status: 'success', message: 'Category updated successfully', data });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ status: 'error', message: error.issues.map(i => i.message).join(', ') });
    }
    res.status(500).json({ status: 'error', message: error.message });
  }
};
