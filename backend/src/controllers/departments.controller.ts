import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

export const getDepartments = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('departments')
      .select('*')
      .order('name');
      
    if (error) throw error;
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const createDepartment = async (req: Request, res: Response) => {
  try {
    const { name, is_active, unit_id } = req.body;
    
    if (!name) {
      return res.status(400).json({ status: 'error', message: 'Name is required' });
    }

    const { data, error } = await supabaseAdmin
      .from('departments')
      .insert([{ name, is_active, unit_id }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ status: 'success', message: 'Department created successfully', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const updateDepartment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, is_active, unit_id } = req.body;
    
    const { data, error } = await supabaseAdmin
      .from('departments')
      .update({ name, is_active, unit_id })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ status: 'success', message: 'Department updated successfully', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const deleteDepartment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabaseAdmin
      .from('departments')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ status: 'success', message: 'Department deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};
