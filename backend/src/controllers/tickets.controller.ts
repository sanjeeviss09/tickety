import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { z } from 'zod';
import { sendEmail } from '../services/email.service';
import { handleSlaStatusTransition } from './ticketWorkflow.controller';

const createTicketSchema = z.object({
  subject: z.string().min(1),
  description: z.string().min(1),
  category_id: z.string().uuid(),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).default('Low'),
  department_id: z.string().uuid().optional().nullable(),
  unit_id: z.string().uuid().optional().nullable(),
  asset_id: z.string().uuid().optional().nullable().or(z.literal('none')),
  contact_number: z.string().optional().nullable(),
  preferred_contact: z.string().optional().nullable(),
  cc_emails: z.array(z.string().email()).optional(),
  self_service_session_id: z.string().uuid().optional().nullable(),
});

import { routeTicket } from '../services/routing.service';

export const createTicket = async (req: Request, res: Response) => {
  try {
    const authUserId = req.user?.id;
    if (!authUserId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

    // Fetch the user's profile to get profile.id, unit_id, and department_id
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, unit_id, department_id, email_address')
      .eq('auth_user_id', authUserId)
      .single();
      
    if (profileErr || !profile) {
      return res.status(400).json({ status: 'error', message: 'User profile not found' });
    }

    const validatedData = createTicketSchema.parse(req.body);
    const { asset_id, self_service_session_id, ...ticketData } = validatedData;

    // Use profile unit and department if not explicitly provided (or force it for Employees)
    const finalUnitId = ticketData.unit_id || profile.unit_id;
    const finalDeptId = ticketData.department_id || profile.department_id;

    const { data: ticket, error } = await supabaseAdmin
      .from('tickets')
      .insert([{
        ...ticketData,
        unit_id: finalUnitId,
        department_id: finalDeptId,
        created_by: profile.id,
        status: 'Open',
        self_service_session_id: self_service_session_id || null
      }])
      .select('*, created_by(*)')
      .single();

    if (error) throw error;

    if (asset_id && asset_id !== 'none') {
      await supabaseAdmin.from('asset_ticket_mapping').insert([{
        ticket_id: ticket.id,
        asset_id: asset_id,
        linked_by: profile.id
      }]);
    }

    if (self_service_session_id) {
      await supabaseAdmin.from('self_service_sessions').update({
        ticket_id: ticket.id,
        status: 'Raised Ticket'
      }).eq('id', self_service_session_id);
    }

    // Log timeline
    await supabaseAdmin.from('ticket_timeline').insert([{
      ticket_id: ticket.id,
      user_id: profile.id,
      action_type: 'CREATED',
      message: 'Ticket created',
    }]);

    // Attempt automatic routing
    await routeTicket(ticket, profile.id);

    // Re-fetch ticket to get updated assignment status
    const { data: updatedTicket } = await supabaseAdmin
      .from('tickets')
      .select('*, created_by(*), assignee:profiles!tickets_assigned_to_fkey(full_name)')
      .eq('id', ticket.id)
      .single();

    // In a real app, send email async
    sendEmail({
      to: profile.email_address,
      subject: `[${ticket.ticket_number}] Ticket Created: ${ticket.subject}`,
      html: `<p>Your ticket has been created successfully.</p><p>Ticket Number: ${ticket.ticket_number}</p><p>We will get back to you shortly.</p>`
    }).catch(console.error);

    res.status(201).json({ status: 'success', data: updatedTicket });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      const message = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
      return res.status(400).json({ status: 'error', message });
    }
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const getTickets = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    
    let query = supabaseAdmin
      .from('tickets')
      .select(`
        *,
        ticket_categories (name),
        units (name),
        departments (name),
        creator:profiles!tickets_created_by_fkey (full_name, email_address, profile_picture_url),
        assignee:profiles!tickets_assigned_to_fkey (full_name, email_address, profile_picture_url),
        assets:asset_ticket_mapping (asset:assets (id, name, asset_code))
      `);
      
    // RLS in backend
    if (role === 'Employee') {
      query = query.eq('created_by', userId);
    } else if (role === 'Technician') {
      // Tech can see assigned and open
      // In this version, tech can see all, but we could filter
      // query = query.or(`assigned_to.eq.${userId},status.eq.Open`);
    }

    // Apply filters from query params
    if (req.query.status) query = query.eq('status', req.query.status);
    if (req.query.priority) query = query.eq('priority', req.query.priority);
    
    // Sort
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const getTicketById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('tickets')
      .select(`
        *,
        ticket_categories (name),
        units (name),
        departments (name),
        creator:profiles!tickets_created_by_fkey (full_name, email_address, profile_picture_url, employee_id),
        assignee:profiles!tickets_assigned_to_fkey (full_name, email_address, profile_picture_url),
        assets:asset_ticket_mapping (asset:assets (id, name, asset_code))
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    
    // Role check
    if (req.user?.role === 'Employee' && data.created_by !== req.user.id) {
      return res.status(403).json({ status: 'error', message: 'Forbidden' });
    }

    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const updateTicketStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user?.id;

    const { data: oldTicket } = await supabaseAdmin.from('tickets').select('*').eq('id', id).single();
    if (!oldTicket) return res.status(404).json({ status: 'error', message: 'Not found' });

    // Prevent duplicate/no-op status updates
    if (oldTicket.status === status) {
      return res.json({ status: 'success', data: oldTicket });
    }

    const { data: ticket, error } = await supabaseAdmin
      .from('tickets')
      .update({ status, ...(status === 'Resolved' || status === 'Closed' ? { resolution_date: new Date().toISOString() } : {}) })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await supabaseAdmin.from('ticket_timeline').insert([{
      ticket_id: ticket.id,
      user_id: userId,
      action_type: 'STATUS_CHANGE',
      message: `Status changed from ${oldTicket.status} to ${status}`,
      metadata: { old_status: oldTicket.status, new_status: status }
    }]);

    // Hook SLA pause/resume when transitioning to/from "Waiting for User"
    await handleSlaStatusTransition(id as string, oldTicket.status, status, userId!);

    res.json({ status: 'success', data: ticket });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const assignTicket = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { assigned_to } = req.body;
    const userId = req.user?.id;

    const { data: oldTicket } = await supabaseAdmin.from('tickets').select('*').eq('id', id).single();
    if (!oldTicket) return res.status(404).json({ status: 'error', message: 'Not found' });

    const targetAssignee = assigned_to || null;
    if (oldTicket.assigned_to === targetAssignee) {
      return res.json({ status: 'success', data: oldTicket });
    }

    const { data: ticket, error } = await supabaseAdmin
      .from('tickets')
      .update({ 
        assigned_to: targetAssignee, 
        assigned_at: targetAssignee ? new Date().toISOString() : null,
        status: targetAssignee && oldTicket.status === 'Open' ? 'Assigned' : oldTicket.status
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await supabaseAdmin.from('ticket_timeline').insert([{
      ticket_id: ticket.id,
      user_id: userId,
      action_type: 'ASSIGNMENT',
      message: targetAssignee ? `Ticket assigned` : `Ticket unassigned`,
      metadata: { assigned_to: targetAssignee }
    }]);

    res.json({ status: 'success', data: ticket });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const addComment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { content, is_internal } = req.body;
    const userId = req.user?.id;

    if (!content) return res.status(400).json({ status: 'error', message: 'Content is required' });

    const { data: comment, error } = await supabaseAdmin
      .from('ticket_comments')
      .insert([{
        ticket_id: id,
        author_id: userId,
        content,
        is_internal: is_internal || false
      }])
      .select(`
        *,
        author:profiles!ticket_comments_author_id_fkey (full_name, profile_picture_url, roles(name))
      `)
      .single();

    if (error) throw error;

    await supabaseAdmin.from('ticket_timeline').insert([{
      ticket_id: id,
      user_id: userId,
      action_type: 'COMMENT',
      message: is_internal ? 'Added an internal note' : 'Added a comment',
      metadata: { comment_id: comment.id }
    }]);

    res.status(201).json({ status: 'success', data: comment });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const getComments = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const role = req.user?.role;

    let query = supabaseAdmin
      .from('ticket_comments')
      .select(`
        *,
        author:profiles!ticket_comments_author_id_fkey (full_name, profile_picture_url, roles(name))
      `)
      .eq('ticket_id', id)
      .order('created_at', { ascending: true });

    if (role === 'Employee') {
      query = query.eq('is_internal', false);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const deleteComment = async (req: Request, res: Response) => {
  try {
    const { id, commentId } = req.params;
    const userId = req.user?.id;

    const { data: comment, error: fetchError } = await supabaseAdmin
      .from('ticket_comments')
      .select('*')
      .eq('id', commentId)
      .single();

    if (fetchError || !comment) {
       return res.status(404).json({ status: 'error', message: 'Comment not found' });
    }

    if (comment.author_id !== userId && req.user?.role !== 'Admin') {
      return res.status(403).json({ status: 'error', message: 'Forbidden: You can only delete your own comments' });
    }

    const { error } = await supabaseAdmin
      .from('ticket_comments')
      .delete()
      .eq('id', commentId);

    if (error) throw error;

    await supabaseAdmin.from('ticket_timeline').insert([{
      ticket_id: id,
      user_id: userId,
      action_type: 'COMMENT',
      message: 'Deleted a comment',
      metadata: { deleted_comment_id: commentId }
    }]);

    res.json({ status: 'success', message: 'Comment deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const getTimeline = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('ticket_timeline')
      .select(`
        *,
        user:profiles!ticket_timeline_user_id_fkey (full_name, profile_picture_url)
      `)
      .eq('ticket_id', id)
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

