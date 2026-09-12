import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { z } from 'zod';

const userSchema = z.object({
  employee_id: z.string().min(2),
  full_name: z.string().min(2),
  mobile_number: z.string().optional(),
  role_id: z.string().uuid(),
  unit_id: z.string().uuid(),
  department_id: z.string().uuid(),
  employment_status: z.enum(['Active', 'Inactive', 'Suspended']).default('Active'),
});

export const getRoles = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('roles')
      .select('*')
      .order('name');
    if (error) throw error;
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const getUsers = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select(`
        *,
        roles (name),
        units (name),
        departments (name)
      `);
      
    if (error) throw error;
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select(`
        *,
        roles (name),
        units (name),
        departments (name)
      `)
      .eq('id', id)
      .single();
      
    if (error) throw error;
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const createUser = async (req: Request, res: Response) => {
  try {
    const parsedData = userSchema.parse(req.body);
    
    // Generate pseudo email and a random secure password
    const email = `${parsedData.employee_id.toLowerCase()}@deskpulse.internal`;
    const tempPassword = Math.random().toString(36).slice(-12) + 'Aa1!'; // Complex enough to pass checks
    
    // Create user in Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { 
        full_name: parsedData.full_name,
        employee_id: parsedData.employee_id
      }
    });

    if (authError) throw authError;

    // The trigger will create a profile. We need to update it with the specific details.
    if (authUser.user) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
          full_name: parsedData.full_name,
          employee_id: parsedData.employee_id,
          mobile_number: parsedData.mobile_number,
          role_id: parsedData.role_id,
          unit_id: parsedData.unit_id,
          department_id: parsedData.department_id,
          employment_status: parsedData.employment_status,
          has_set_password: false
        })
        .eq('id', authUser.user.id);

      if (profileError) throw profileError;
    }

    res.status(201).json({ status: 'success', message: 'User created successfully', data: authUser.user });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ status: 'error', errors: error.issues });
    }
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Prevent updating critical fields via this endpoint if needed, but since it's Admin only, we allow it.
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ status: 'success', message: 'User updated successfully', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Delete from auth (cascades to profile)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id as string);
    
    if (error) throw error;
    res.json({ status: 'success', message: 'User deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};
