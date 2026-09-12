import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

export const getUnits = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('units')
      .select('*')
      .order('name');
      
    if (error) throw error;
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const createUnit = async (req: Request, res: Response) => {
  try {
    const { name, is_active } = req.body;
    
    if (!name) {
      return res.status(400).json({ status: 'error', message: 'Name is required' });
    }

    const { data, error } = await supabaseAdmin
      .from('units')
      .insert([{ name, is_active }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ status: 'success', message: 'Unit created successfully', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const updateUnit = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, is_active } = req.body;
    
    const { data, error } = await supabaseAdmin
      .from('units')
      .update({ name, is_active })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ status: 'success', message: 'Unit updated successfully', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const deleteUnit = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabaseAdmin
      .from('units')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ status: 'success', message: 'Unit deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};
