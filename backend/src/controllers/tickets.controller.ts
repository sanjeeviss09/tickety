import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { z } from 'zod';
import { sendEmail } from '../services/email.service';
import { handleSlaStatusTransition } from './ticketWorkflow.controller';

const optionalUuid = z.preprocess(
  (val) => (val === '' || val === undefined || val === 'none' ? null : val),
  z.string().uuid().nullable().optional()
);

const createTicketSchema = z.object({
  subject: z.string().min(1),
  description: z.string().min(1),
  category_id: z.string().uuid(),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).optional().nullable(),
  department_id: optionalUuid,
  unit_id: optionalUuid,
  asset_id: optionalUuid,
  contact_number: z.string().optional().nullable(),
  preferred_contact: z.string().optional().nullable(),
  cc_emails: z.array(z.string().email()).optional(),
  self_service_session_id: optionalUuid,
  self_service_event_id: optionalUuid,
  ticket_for: z.enum(['myself', 'another']).default('myself'),
  affected_employee_id: optionalUuid,
  attachments: z.array(z.object({
    file_name: z.string(),
    original_filename: z.string().optional(),
    file_size: z.number(),
    file_type: z.string(),
    storage_path: z.string()
  })).optional()
});

import { routeTicket } from '../services/routing.service';
import { matchSlaPolicy, calculateSlaDeadlines } from '../services/slaMatching.service';

export const createTicket = async (req: Request, res: Response) => {
  try {
    const authUserId = req.user?.id;
    if (!authUserId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

    // Fetch the user's profile to get profile.id, unit_id, and department_id
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, unit_id, department_id, email_address, full_name')
      .or(`id.eq.${authUserId},auth_user_id.eq.${authUserId}`)
      .single();
      
    if (profileErr || !profile) {
      return res.status(400).json({ status: 'error', message: 'User profile not found' });
    }

    const validatedData = createTicketSchema.parse(req.body);
    const { asset_id, self_service_session_id, self_service_event_id, ticket_for, affected_employee_id, attachments, ...ticketData } = validatedData;

    let affectedProfile = profile;
    if (ticket_for === 'another' && affected_employee_id) {
      const { data: anotherProfile, error: anotherErr } = await supabaseAdmin
        .from('profiles')
        .select('id, unit_id, department_id, email_address, full_name')
        .eq('id', affected_employee_id)
        .single();
      if (anotherProfile) {
        affectedProfile = anotherProfile;
      }
    }

    // Use affected profile unit and department if not explicitly provided
    let finalUnitId = ticketData.unit_id || affectedProfile.unit_id || null;
    const finalDeptId = ticketData.department_id || affectedProfile.department_id || null;
    
    if (!finalUnitId && finalDeptId) {
      const { data: dept } = await supabaseAdmin
        .from('departments')
        .select('unit_id')
        .eq('id', finalDeptId)
        .single();
      if (dept?.unit_id) {
        finalUnitId = dept.unit_id;
      }
    }
    
    // Auto-assign priority based on category if not provided
    let finalPriority = ticketData.priority;
    if (!finalPriority) {
      const { data: category } = await supabaseAdmin
        .from('ticket_categories')
        .select('default_priority')
        .eq('id', ticketData.category_id)
        .single();
      finalPriority = category?.default_priority || 'Low';
    }

    const finalAssetId = asset_id || null;

    const { data: ticket, error } = await supabaseAdmin
      .from('tickets')
      .insert([{
        ...ticketData,
        priority: finalPriority,
        unit_id: finalUnitId,
        department_id: finalDeptId,
        created_by: profile.id,
        requester_id: profile.id,
        affected_employee_id: affectedProfile.id,
        related_asset_id: finalAssetId,
        status: 'Open',
        self_service_session_id: self_service_session_id || null,
        self_service_event_id: self_service_event_id || null
      }])
      .select('*, created_by(*)')
      .single();

    if (error) throw error;

    // SLA Matching and Calculation
    const matchedPolicy = await matchSlaPolicy(ticket.unit_id, ticket.category_id, ticket.priority);
    
    if (matchedPolicy) {
      const { firstResponseDueAt, resolutionDueAt } = await calculateSlaDeadlines(
        matchedPolicy.id, 
        new Date(ticket.created_at)
      );

      await supabaseAdmin.from('tickets').update({
        sla_policy_id: matchedPolicy.id,
        first_response_due_at: firstResponseDueAt.toISOString(),
        resolution_due_at: resolutionDueAt.toISOString(),
        // Keep due_date for backwards compatibility
        due_date: resolutionDueAt.toISOString()
      }).eq('id', ticket.id);
    }

    if (asset_id && asset_id !== 'none') {
      await supabaseAdmin.from('asset_ticket_mapping').insert([{
        ticket_id: ticket.id,
        asset_id: asset_id,
        linked_by: profile.id
      }]);
    }

    if (attachments && attachments.length > 0) {
      const attachmentRecords = attachments.map(att => ({
        ticket_id: ticket.id,
        file_name: att.file_name,
        original_filename: att.original_filename || att.file_name,
        file_size: att.file_size,
        file_type: att.file_type,
        storage_path: att.storage_path,
        uploaded_by: profile.id,
        visibility: 'Employee'
      }));
      await supabaseAdmin.from('ticket_attachments').insert(attachmentRecords);
    }

    if (self_service_session_id) {
      await supabaseAdmin.from('self_service_sessions').update({
        ticket_id: ticket.id,
        status: 'Raised Ticket'
      }).eq('id', self_service_session_id);
    }

    // Log timeline
    const timelineEvents = [{
      ticket_id: ticket.id,
      user_id: profile.id,
      action_type: 'CREATED',
      message: ticket_for === 'another' ? `Ticket created on behalf of ${affectedProfile.full_name}` : 'Ticket created',
    }];
    
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        timelineEvents.push({
          ticket_id: ticket.id,
          user_id: profile.id,
          action_type: 'ATTACHMENT_ADDED',
          message: `${profile.full_name || 'User'} uploaded ${att.original_filename || att.file_name}`,
        });
      }
    }
    
    await supabaseAdmin.from('ticket_timeline').insert(timelineEvents);

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
      to: affectedProfile.email_address,
      subject: `[${ticket.ticket_number}] Ticket Created: ${ticket.subject}`,
      html: `<p>Your ticket has been created successfully.</p><p>Ticket Number: ${ticket.ticket_number}</p><p>We will get back to you shortly.</p>`
    }).catch(console.error);

    if (ticket_for === 'another' && profile.email_address !== affectedProfile.email_address) {
      sendEmail({
        to: profile.email_address,
        subject: `[${ticket.ticket_number}] Ticket Created for ${affectedProfile.full_name}`,
        html: `<p>The ticket you raised on behalf of ${affectedProfile.full_name} has been created successfully.</p><p>Ticket Number: ${ticket.ticket_number}</p>`
      }).catch(console.error);
    }

    res.status(201).json({ status: 'success', data: updatedTicket || ticket });
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
    
    const page = parseInt(req.query.page as string) || 0;
    const limit = parseInt(req.query.limit as string) || 20;
    
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
      `, { count: 'exact' });
      
    // RLS in backend
    if (role === 'Employee') {
      query = query.or(`created_by.eq.${userId},requester_id.eq.${userId},affected_employee_id.eq.${userId}`);
    } 

    // Apply filters from query params
    if (req.query.status && req.query.status !== 'All') {
      const statuses = (req.query.status as string).split(',');
      query = query.in('status', statuses);
    }
    
    if (req.query.priority && req.query.priority !== 'All') {
      const priorities = (req.query.priority as string).split(',');
      query = query.in('priority', priorities);
    }

    if (req.query.search) {
      query = query.or(`subject.ilike.%${req.query.search}%,ticket_number.ilike.%${req.query.search}%`);
    }

    if (req.query.sla && req.query.sla !== 'All') {
      const now = new Date();
      const nowIso = now.toISOString();

      if (req.query.sla === 'overdue') {
        query = query.lt('due_date', nowIso).not('status', 'in', '("Resolved","Closed","Cancelled")');
      } else if (req.query.sla === 'approaching') {
        const limitDate = new Date(Date.now() + 4 * 3600000).toISOString();
        query = query.gte('due_date', nowIso).lt('due_date', limitDate).not('status', 'in', '("Resolved","Closed","Cancelled")');
      } else if (req.query.sla === 'breached') {
        // Tickets that have breached SLA:
        // 1. Active tickets past their due date
        // 2. Closed/resolved tickets that were resolved after their due date
        // 3. Or assignment_sla_state is 'Breached'
        const { data: candidates } = await supabaseAdmin
          .from('tickets')
          .select('id, due_date, status, resolution_date, closed_at, updated_at, assignment_sla_state')
          .or(`due_date.lt.${nowIso},assignment_sla_state.eq.Breached`);

        const breachedIds = (candidates || []).filter(t => {
          if (t.assignment_sla_state === 'Breached') return true;
          if (!t.due_date) return false;
          const due = new Date(t.due_date);
          if (!['Resolved', 'Closed', 'Cancelled'].includes(t.status)) {
            return due < now;
          }
          const completedAt = t.resolution_date ? new Date(t.resolution_date) : (t.closed_at ? new Date(t.closed_at) : (t.updated_at ? new Date(t.updated_at) : null));
          return completedAt ? completedAt > due : false;
        }).map(t => t.id);

        if (breachedIds.length > 0) {
          query = query.in('id', breachedIds);
        } else {
          query = query.in('id', ['00000000-0000-0000-0000-000000000000']);
        }
      }
    }
    
    // Sort and Paginate
    query = query
      .order('created_at', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1);

    const { data, count, error } = await query;
    if (error) throw error;
    
    if (data && data.length > 0) {
      const profileIds = new Set<string>();
      for (const t of data) {
        if (t.requester_id) profileIds.add(t.requester_id);
        if (t.affected_employee_id) profileIds.add(t.affected_employee_id);
      }
      if (profileIds.size > 0) {
        const { data: profs } = await supabaseAdmin
          .from('profiles')
          .select('id, full_name, email_address, profile_picture_url')
          .in('id', Array.from(profileIds));
        if (profs) {
          const profMap = new Map(profs.map(p => [p.id, p]));
          for (const t of data) {
            t.requester = t.requester_id ? profMap.get(t.requester_id) || null : null;
            t.affected = t.affected_employee_id ? profMap.get(t.affected_employee_id) || null : null;
          }
        }
      }
    }

    res.json({ status: 'success', data, count });
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
        assets:asset_ticket_mapping (asset:assets (id, name, asset_code)),
        related_asset:assets!tickets_related_asset_id_fkey (id, name, asset_code),
        ticket_self_service_events!tickets_self_service_event_id_fkey (*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    
    if (data) {
      const profileIds = [data.requester_id, data.affected_employee_id].filter(Boolean);
      if (profileIds.length > 0) {
        const { data: profs } = await supabaseAdmin
          .from('profiles')
          .select('id, full_name, email_address, profile_picture_url, employee_id')
          .in('id', profileIds);
        if (profs) {
          data.requester = profs.find(p => p.id === data.requester_id) || null;
          data.affected = profs.find(p => p.id === data.affected_employee_id) || null;
        }
      }
    }
    
    // Role check
    if (req.user?.role === 'Employee' && data.created_by !== req.user.id && data.requester_id !== req.user.id && data.affected_employee_id !== req.user.id) {
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

    await supabaseAdmin.from('audit_logs').insert([{
      user_id: userId,
      action: 'TICKET_STATUS_CHANGED',
      entity_type: 'ticket',
      entity_id: id,
      new_values: { status, is_admin_override: true }
    }]);

    res.json({ status: 'success', data: ticket });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const getEligibleTechnicians = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const { data: ticket, error: tErr } = await supabaseAdmin.from('tickets').select('unit_id').eq('id', id).single();
    if (tErr) throw tErr;
    
    const unitId = ticket?.unit_id;
    
    if (!unitId) {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('*, role:roles(name)')
      if (error) throw error;
      const techs = data.filter((p: any) => p.role?.name === 'Technician');
      return res.json({ status: 'success', data: techs });
    }

    const { data: assignments, error: aErr } = await supabaseAdmin.from('unit_technician_assignments').select('technician_id').eq('unit_id', unitId);
    if (aErr) throw aErr;
    const assignedTechIds = assignments.map((a: any) => a.technician_id);

    let query = supabaseAdmin.from('profiles').select('*, role:roles(name)');
    
    if (assignedTechIds.length > 0) {
      query = query.or(`unit_id.eq.${unitId},id.in.(${assignedTechIds.join(',')})`);
    } else {
      query = query.eq('unit_id', unitId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    const techs = data.filter((p: any) => p.role?.name === 'Technician');
    res.json({ status: 'success', data: techs });
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

    // Track first response if not already set
    if (targetAssignee && !ticket.first_response_at) {
      await supabaseAdmin.from('tickets').update({
        first_response_at: new Date().toISOString()
      }).eq('id', ticket.id);
    }

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

    // Fetch the ticket to check if first_response_at is set
    const { data: ticket } = await supabaseAdmin.from('tickets').select('first_response_at').eq('id', id).single();
    if (ticket && !ticket.first_response_at && !is_internal) {
      await supabaseAdmin.from('tickets').update({
        first_response_at: new Date().toISOString()
      }).eq('id', id);
    }

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

export const deleteTicket = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Check permission (Admin only or Creator)
    const { data: ticket, error: fetchError } = await supabaseAdmin
      .from('tickets')
      .select('created_by')
      .eq('id', id)
      .single();

    if (fetchError || !ticket) {
      return res.status(404).json({ status: 'error', message: 'Ticket not found' });
    }

    if (req.user?.role?.toLowerCase() !== 'admin' && ticket.created_by !== req.user?.id) {
      return res.status(403).json({ status: 'error', message: 'Forbidden' });
    }

    const { error } = await supabaseAdmin.from('tickets').delete().eq('id', id);
    if (error) throw error;
    
    res.json({ status: 'success', message: 'Ticket deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

