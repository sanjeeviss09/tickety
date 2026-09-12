import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { z } from 'zod';

const serviceRequestSchema = z.object({
  service_id: z.string().uuid(),
  form_data: z.record(z.any())
});

export const getServiceCatalog = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('service_catalog')
      .select('*, dynamic_form_fields(*)')
      .eq('is_active', true)
      .order('category');
      
    if (error) throw error;
    res.json({ status: 'success', data });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

export const submitServiceRequest = async (req: Request, res: Response) => {
  try {
    const validatedData = serviceRequestSchema.parse(req.body);
    const user = (req as any).user;
    
    // First verify the service exists
    const { data: service, error: serviceError } = await supabaseAdmin
      .from('service_catalog')
      .select('name, category, approval_type, sla_hours')
      .eq('id', validatedData.service_id)
      .single();
      
    if (serviceError) throw serviceError;
    
    // Create the parent ticket first
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('tickets')
      .insert([{
        title: `Service Request: ${service.name}`,
        description: `Form Data: ${JSON.stringify(validatedData.form_data, null, 2)}`,
        created_by: user.id,
        status: 'Open',
        priority: 'Medium'
      }])
      .select()
      .single();

    if (ticketError) throw ticketError;

    // Create the service request record linking to the ticket
    const { data, error } = await supabaseAdmin
      .from('service_requests')
      .insert([{
        service_id: validatedData.service_id,
        ticket_id: ticket.id,
        form_data: validatedData.form_data,
        approval_status: service.approval_type === 'None' ? 'Approved' : 'Pending'
      }])
      .select()
      .single();
      
    if (error) throw error;
    res.status(201).json({ status: 'success', data: { ...data, ticket } });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message });
  }
};

// Admin Service Catalog CRUD
export const createService = async (req: Request, res: Response) => {
  try {
    const { name, description, icon, category, approval_type, sla_hours, is_active } = req.body;
    const { data, error } = await supabaseAdmin
      .from('service_catalog')
      .insert([{ name, description, icon, category, approval_type, sla_hours, is_active }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ status: 'success', data });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message });
  }
};

export const updateService = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, icon, category, approval_type, sla_hours, is_active } = req.body;
    const { data, error } = await supabaseAdmin
      .from('service_catalog')
      .update({ name, description, icon, category, approval_type, sla_hours, is_active })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    res.json({ status: 'success', data });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message });
  }
};

export const createFormField = async (req: Request, res: Response) => {
  try {
    const { service_id, field_name, field_label, field_type, is_required, options, order_index } = req.body;
    const { data, error } = await supabaseAdmin
      .from('dynamic_form_fields')
      .insert([{ service_id, field_name, field_label, field_type, is_required, options, order_index }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ status: 'success', data });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message });
  }
};

export const deleteFormField = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from('dynamic_form_fields').delete().eq('id', id);
    if (error) throw error;
    res.json({ status: 'success', message: 'Field deleted' });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message });
  }
};
