import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

// --- Technician Unit Assignments ---

export const getUnitAssignments = async (req: Request, res: Response) => {
  try {
    const { unit_id } = req.query;
    let query = supabaseAdmin.from('technician_unit_assignments')
      .select('*, profiles(full_name, email_address), units(name)');
      
    if (unit_id) {
      query = query.eq('unit_id', unit_id);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const createUnitAssignment = async (req: Request, res: Response) => {
  try {
    const { technician_id, unit_id, is_primary, assignment_type } = req.body;
    
    // If setting as primary, we should unset other primaries for this tech
    if (is_primary) {
      await supabaseAdmin.from('technician_unit_assignments')
        .update({ is_primary: false })
        .eq('technician_id', technician_id);
    }

    const { data, error } = await supabaseAdmin.from('technician_unit_assignments')
      .upsert([{
        technician_id,
        unit_id,
        is_primary: is_primary || false,
        assignment_type: assignment_type || 'Manual Assignment'
      }], { onConflict: 'technician_id,unit_id' })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const deleteUnitAssignment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from('technician_unit_assignments').delete().eq('id', id);
    if (error) throw error;
    res.json({ status: 'success' });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};


// --- Ticket Routing Rules ---

export const getRoutingRules = async (req: Request, res: Response) => {
  try {
    const { unit_id } = req.query;
    let query = supabaseAdmin.from('ticket_routing_rules')
      .select('*, units(name), departments(name), ticket_categories(name), profiles(full_name)');
      
    if (unit_id) {
      query = query.eq('unit_id', unit_id);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const createRoutingRule = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin.from('ticket_routing_rules')
      .insert([req.body])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const updateRoutingRule = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin.from('ticket_routing_rules')
      .update(req.body)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const deleteRoutingRule = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from('ticket_routing_rules').delete().eq('id', id);
    if (error) throw error;
    res.json({ status: 'success' });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};
