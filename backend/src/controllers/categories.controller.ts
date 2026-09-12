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

export const createCategory = async (req: Request, res: Response) => {
  try {
    const { name, description, is_active, self_service_mode, guidance_enabled } = req.body;
    
    if (!name) {
      return res.status(400).json({ status: 'error', message: 'Name is required' });
    }

    const { data, error } = await supabaseAdmin
      .from('ticket_categories')
      .insert([{ 
        name, 
        description, 
        is_active, 
        self_service_mode: self_service_mode || 'Optional', 
        guidance_enabled: guidance_enabled ?? true 
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ status: 'success', message: 'Category created successfully', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, is_active, self_service_mode, guidance_enabled } = req.body;
    
    const updatePayload: any = { name, description, is_active };
    if (self_service_mode !== undefined) updatePayload.self_service_mode = self_service_mode;
    if (guidance_enabled !== undefined) updatePayload.guidance_enabled = guidance_enabled;

    const { data, error } = await supabaseAdmin
      .from('ticket_categories')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ status: 'success', message: 'Category updated successfully', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};
