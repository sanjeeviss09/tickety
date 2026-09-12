import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { z } from 'zod';
import { notifyAndEmail, notifyEscalationRecipients } from '../services/notifications.service';
import { pauseSla, resumeSla, calculateSlaStatus, getTotalWorkDuration } from '../services/sla.service';

const APP_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// â”€â”€â”€ Helper: build ticket URL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ticketUrl(ticketId: string) {
  return `${APP_URL}/tickets/${ticketId}`;
}

// â”€â”€â”€ Helper: get settings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function getSetting(key: string) {
  const { data } = await supabaseAdmin.from('system_settings').select('value').eq('key', key).single();
  return data?.value ?? {};
}

// â”€â”€â”€ Helper: resolve auth user â†’ profile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function getCallerProfile(req: Request): Promise<{ profileId: string; authId: string } | null> {
  const authId = req.user?.id;
  if (!authId) return null;
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('auth_user_id', authId)
    .single();
  if (!data) return null;
  return { profileId: data.id as string, authId };
}

// â”€â”€â”€ POST /tickets/:id/start-work â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const startWork = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const caller = await getCallerProfile(req);
    if (!caller) return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    const { profileId, authId } = caller;

    const { data: ticket, error: ticketErr } = await supabaseAdmin
      .from('tickets')
      .select('*, creator:profiles!tickets_created_by_fkey(id, full_name, email_address), assignee:profiles!tickets_assigned_to_fkey(id, full_name)')
      .eq('id', id as string)
      .single();

    if (ticketErr || !ticket) return res.status(404).json({ status: 'error', message: 'Ticket not found' });
    if (ticket.assigned_to !== profileId) return res.status(403).json({ status: 'error', message: 'You are not the assigned technician' });
    if (!['Assigned', 'Reopened'].includes(ticket.status)) {
      return res.status(400).json({ status: 'error', message: `Cannot start work on a ticket with status "${ticket.status}"` });
    }
    if (ticket.active_work_session_id) {
      return res.status(400).json({ status: 'error', message: 'Work is already in progress for this ticket' });
    }

    const now = new Date().toISOString();
    const isResume = ticket.status === 'Reopened';

    const { data: session, error: sessionErr } = await supabaseAdmin
      .from('ticket_work_sessions')
      .insert([{ ticket_id: id as string, technician_id: profileId, session_type: isResume ? 'resumed' : 'active', started_at: now }])
      .select().single();
    if (sessionErr) throw sessionErr;

    if (ticket.status === 'Waiting for User') {
      await resumeSla(id as string, profileId);
    }

    const updateData: any = { status: 'In Progress', active_work_session_id: session.id };
    if (!ticket.work_started_at) updateData.work_started_at = now;
    await supabaseAdmin.from('tickets').update(updateData).eq('id', id as string);

    await supabaseAdmin.from('ticket_timeline').insert([{
      ticket_id: id as string, user_id: authId,
      action_type: 'WORK_STARTED',
      message: isResume ? 'Technician resumed work on the ticket' : 'Technician started work on the ticket',
      metadata: { session_id: session.id, work_started_at: now },
    }]);

    await supabaseAdmin.from('audit_logs').insert([{
      user_id: authId,
      action: isResume ? 'TICKET_WORK_RESUMED' : 'TICKET_WORK_STARTED',
      entity_type: 'ticket', entity_id: id as string,
      new_values: { status: 'In Progress', session_id: session.id },
    }]);

    if (ticket.creator?.id) {
      notifyAndEmail({
        recipientProfileId: ticket.creator.id as string,
        eventName: 'Work Started',
        templateVars: {
          ticket_number: ticket.ticket_number,
          subject: ticket.subject,
          technician_name: (ticket.assignee as any)?.full_name || 'Technician',
          work_started_at: new Date(now).toLocaleString(),
          ticket_url: ticketUrl(id as string),
          company_name: 'DeskPulse',
        },
        link: `/tickets/${id}`,
      }).catch(() => {});
    }

    const { data: updatedTicket } = await supabaseAdmin
      .from('tickets')
      .select('*, creator:profiles!tickets_created_by_fkey(full_name), assignee:profiles!tickets_assigned_to_fkey(full_name)')
      .eq('id', id as string).single();

    res.json({ status: 'success', data: { ticket: updatedTicket, session } });
  } catch (error: any) {
    console.error('[startWork]', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
};


// â”€â”€â”€ POST /tickets/:id/complete â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const completeSchema = z.object({
  problem_identified: z.string().min(1, 'Problem identified is required'),
  work_performed: z.string().min(1, 'Work performed is required'),
  resolution_summary: z.string().min(1, 'Resolution summary is required'),
  root_cause: z.string().optional().nullable(),
  preventive_recommendation: z.string().optional().nullable(),
});

export const completeWork = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const caller = await getCallerProfile(req);
    if (!caller) return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    const { profileId, authId } = caller;

    const { data: ticket } = await supabaseAdmin
      .from('tickets')
      .select('*, creator:profiles!tickets_created_by_fkey(id, full_name), assignee:profiles!tickets_assigned_to_fkey(id, full_name)')
      .eq('id', id as string).single();

    if (!ticket) return res.status(404).json({ status: 'error', message: 'Ticket not found' });
    if (ticket.assigned_to !== profileId) return res.status(403).json({ status: 'error', message: 'Not the assigned technician' });
    if (ticket.status !== 'In Progress') {
      return res.status(400).json({ status: 'error', message: `Ticket must be "In Progress" to complete. Current: "${ticket.status}"` });
    }

    const validatedData = completeSchema.parse(req.body);
    const now = new Date().toISOString();

    // End active work session
    if (ticket.active_work_session_id) {
      const { data: session } = await supabaseAdmin
        .from('ticket_work_sessions').select('started_at').eq('id', ticket.active_work_session_id).single();
      if (session) {
        const durationSeconds = Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000);
        await supabaseAdmin.from('ticket_work_sessions').update({
          ended_at: now,
          duration_seconds: durationSeconds,
        }).eq('id', ticket.active_work_session_id);
      }
    }

    const totalWorkDuration = await getTotalWorkDuration(id as string);
    const slaStatus = await calculateSlaStatus(id as string);

    // How many previous attempts
    const { count: prevAttempts } = await supabaseAdmin
      .from('ticket_resolution').select('id', { count: 'exact' }).eq('ticket_id', id);

    // Create resolution record
    const { data: resolution, error: resErr } = await supabaseAdmin
      .from('ticket_resolution')
      .insert([{
        ticket_id: id as string,
        technician_id: profileId,
        problem_identified: validatedData.problem_identified,
        work_performed: validatedData.work_performed,
        resolution_summary: validatedData.resolution_summary,
        root_cause: validatedData.root_cause || null,
        preventive_recommendation: validatedData.preventive_recommendation || null,
        total_work_duration_seconds: totalWorkDuration,
        sla_status_at_completion: slaStatus.status,
        attempt_number: (prevAttempts ?? 0) + 1,
        technician_completed_at: now,
      }])
      .select().single();

    if (resErr) throw resErr;

    // Create resolution confirmation request
    const { data: confirmation, error: confErr } = await supabaseAdmin
      .from('ticket_resolution_confirmations')
      .insert([{
        ticket_id: id as string,
        resolution_id: resolution.id,
        employee_id: ticket.creator?.id,
        technician_id: profileId,
        status: 'Pending',
        requested_at: now,
      }])
      .select().single();

    if (confErr) throw confErr;

    // Update ticket
    await supabaseAdmin.from('tickets').update({
      status: 'Awaiting Employee Confirmation',
      technician_completed_at: now,
      active_work_session_id: null,
      total_work_duration_seconds: totalWorkDuration,
    }).eq('id', id as string);

    // Timeline
    await supabaseAdmin.from('ticket_timeline').insert([{
      ticket_id: id as string,
      user_id: profileId,
      action_type: 'WORK_COMPLETED',
      message: 'Technician marked ticket as completed. Awaiting employee confirmation.',
      metadata: { resolution_id: resolution.id, confirmation_id: confirmation.id, sla_status: slaStatus.status },
    }]);

    // Audit log
    await supabaseAdmin.from('audit_logs').insert([{
      user_id: authId,
      action: 'TICKET_WORK_COMPLETED',
      entity_type: 'ticket',
      entity_id: id as string,
      new_values: { status: 'Awaiting Employee Confirmation', resolution_id: resolution.id },
    }]);

    // Notify employee
    if (ticket.creator?.id) {
      await notifyAndEmail({
        recipientProfileId: ticket.creator.id as string,
        eventName: 'Completion Request',
        templateVars: {
          ticket_number: ticket.ticket_number,
          subject: ticket.subject,
          technician_name: (ticket.assignee as any)?.full_name || 'Technician',
          employee_name: ticket.creator.full_name || 'User',
          resolution_summary: validatedData.resolution_summary,
          completed_at: new Date(now).toLocaleString(),
          ticket_url: ticketUrl(id as string),
          company_name: 'DeskPulse',
        },
        link: `/tickets/${id}`,
      });
    }

    res.json({ status: 'success', data: { resolution, confirmation } });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ status: 'error', message: error.issues.map(i => i.message).join(', ') });
    }
    console.error('[completeWork]', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// â”€â”€â”€ POST /tickets/:id/confirm-resolution â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const confirmSchema = z.object({
  confirmed: z.boolean(),
  rejection_reason: z.string().optional().nullable(),
  employee_comment: z.string().optional().nullable(),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  feedback_comment: z.string().optional().nullable(),
});

export const confirmResolution = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const caller = await getCallerProfile(req);
    if (!caller) return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    const { profileId, authId } = caller;

    const { data: ticket } = await supabaseAdmin
      .from('tickets')
      .select('*, creator:profiles!tickets_created_by_fkey(id, full_name), assignee:profiles!tickets_assigned_to_fkey(id, full_name), units(name)')
      .eq('id', id as string).single();

    if (!ticket) return res.status(404).json({ status: 'error', message: 'Ticket not found' });
    if (ticket.created_by !== profileId) return res.status(403).json({ status: 'error', message: 'Only the ticket creator can confirm resolution' });
    if (ticket.status !== 'Awaiting Employee Confirmation') {
      return res.status(400).json({ status: 'error', message: `Ticket is not awaiting confirmation. Status: "${ticket.status}"` });
    }

    const validated = confirmSchema.parse(req.body);

    // Get rating config
    const ratingConfig = await getSetting('rating_config');
    const closureConfig = await getSetting('closure_config');

    // Get the pending confirmation
    const { data: confirmation } = await supabaseAdmin
      .from('ticket_resolution_confirmations')
      .select('*, resolution:ticket_resolution(resolution_summary)')
      .eq('ticket_id', id)
      .eq('status', 'Pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!confirmation) return res.status(404).json({ status: 'error', message: 'No pending confirmation found' });

    const now = new Date().toISOString();

    if (validated.confirmed) {
      // Validate rating if mandatory
      if (ratingConfig.mandatory_for_closure && !validated.rating) {
        return res.status(400).json({ status: 'error', message: 'Rating is required to confirm resolution' });
      }

      // Update confirmation
      await supabaseAdmin.from('ticket_resolution_confirmations').update({
        status: 'Confirmed',
        employee_comment: validated.employee_comment || null,
        responded_at: now,
      }).eq('id', confirmation.id);

      // Insert rating if provided
      let ratingRecord: any = null;
      if (validated.rating) {
        const { data: rating } = await supabaseAdmin
          .from('ticket_ratings')
          .insert([{
            ticket_id: id as string,
            confirmation_id: confirmation.id,
            employee_id: profileId,
            technician_id: ticket.assigned_to,
            unit_id: ticket.unit_id,
            department_id: ticket.department_id,
            rating: validated.rating,
            feedback_comment: validated.feedback_comment || null,
          }])
          .select().single();
        ratingRecord = rating;
      }

      // Update ticket â†’ Resolved
      const ticketUpdate: any = {
        status: 'Resolved',
        employee_confirmed_at: now,
        resolved_at: now,
        resolution_date: now,
      };

      if (closureConfig.auto_close_after_rating) {
        ticketUpdate.status = 'Closed';
        ticketUpdate.closed_at = now;
      }

      await supabaseAdmin.from('tickets').update(ticketUpdate).eq('id', id as string);

      // Timeline
      const timelineEntries = [
        {
          ticket_id: id as string, user_id: profileId,
          action_type: 'EMPLOYEE_CONFIRMED',
          message: 'Employee confirmed the resolution',
          metadata: { rating: validated.rating, confirmation_id: confirmation.id },
        },
      ];
      if (validated.rating) {
        timelineEntries.push({
          ticket_id: id as string, user_id: profileId,
          action_type: 'RATING_SUBMITTED',
          message: `Employee submitted rating: ${validated.rating}/5`,
          metadata: { rating: validated.rating, feedback: validated.feedback_comment } as any,
        });
      }
      if (closureConfig.auto_close_after_rating) {
        timelineEntries.push({
          ticket_id: id as string, user_id: null as any,
          action_type: 'STATUS_CHANGE',
          message: 'Ticket automatically closed after employee confirmation',
          metadata: { old_status: 'Resolved', new_status: 'Closed', auto: true } as any,
        });
      }
      await supabaseAdmin.from('ticket_timeline').insert(timelineEntries);

      // Notify technician
      if (ticket.assigned_to) {
        await notifyAndEmail({
          recipientProfileId: ticket.assigned_to,
          eventName: 'Employee Confirmed',
          templateVars: {
            ticket_number: ticket.ticket_number,
            subject: ticket.subject,
            technician_name: (ticket.assignee as any)?.full_name || 'Technician',
            employee_name: ticket.creator?.full_name || 'Employee',
            rating: String(validated.rating || 'N/A'),
            feedback: validated.feedback_comment || 'No comment',
            confirmed_at: new Date(now).toLocaleString(),
            ticket_url: ticketUrl(id as string),
            company_name: 'DeskPulse',
          },
          link: `/tickets/${id}`,
        });
      }

      // Notify employee of closure
      if (closureConfig.auto_close_after_rating && ticket.creator?.id) {
        const { data: resolution } = await supabaseAdmin
          .from('ticket_resolution').select('resolution_summary').eq('ticket_id', id)
          .order('created_at', { ascending: false }).limit(1).single();
        await notifyAndEmail({
          recipientProfileId: ticket.creator.id as string,
          eventName: 'Ticket Closed Notification',
          templateVars: {
            ticket_number: ticket.ticket_number,
            subject: ticket.subject,
            technician_name: (ticket.assignee as any)?.full_name || 'Technician',
            employee_name: ticket.creator?.full_name || 'Employee',
            resolution_summary: resolution?.resolution_summary || '',
            rating: String(validated.rating || 'N/A'),
            closed_at: new Date(now).toLocaleString(),
            ticket_url: ticketUrl(id as string),
            company_name: 'DeskPulse',
          },
          link: `/tickets/${id}`,
        });
      }

      // Low rating escalation
      if (validated.rating && validated.rating <= (ratingConfig.low_rating_threshold ?? 2) && ratingConfig.escalate_on_low_rating) {
        await notifyEscalationRecipients({
          eventName: 'Low Rating Alert',
          templateVars: {
            ticket_number: ticket.ticket_number,
            subject: ticket.subject,
            employee_name: ticket.creator?.full_name || 'Employee',
            technician_name: (ticket.assignee as any)?.full_name || 'Technician',
            rating: String(validated.rating),
            feedback: validated.feedback_comment || 'No comment',
            unit: ticket.units?.name || '',
            ticket_url: ticketUrl(id as string),
            company_name: 'DeskPulse',
          },
          link: `/tickets/${id}`,
        });
      }

      // Audit
      await supabaseAdmin.from('audit_logs').insert([{
        user_id: authId,
        action: 'TICKET_RESOLUTION_CONFIRMED',
        entity_type: 'ticket',
        entity_id: id as string,
        new_values: { status: ticketUpdate.status, rating: validated.rating },
      }]);

      return res.json({ status: 'success', data: { status: ticketUpdate.status, rating: ratingRecord } });
    } else {
      // Employee rejected resolution
      if (!validated.rejection_reason?.trim()) {
        return res.status(400).json({ status: 'error', message: 'Rejection reason is required' });
      }

      // Update confirmation
      await supabaseAdmin.from('ticket_resolution_confirmations').update({
        status: 'Rejected',
        rejection_reason: validated.rejection_reason,
        responded_at: now,
      }).eq('id', confirmation.id);

      // Reopen ticket
      await supabaseAdmin.from('tickets').update({
        status: 'Reopened',
        reopened_at: now,
        reopen_count: (ticket.reopen_count || 0) + 1,
        active_work_session_id: null,
      }).eq('id', id as string);

      // Timeline
      await supabaseAdmin.from('ticket_timeline').insert([{
        ticket_id: id as string, user_id: profileId,
        action_type: 'EMPLOYEE_REJECTED',
        message: `Employee reported issue not resolved: ${validated.rejection_reason}`,
        metadata: { rejection_reason: validated.rejection_reason, confirmation_id: confirmation.id },
      }, {
        ticket_id: id as string, user_id: null as any,
        action_type: 'STATUS_CHANGE',
        message: 'Ticket Reopened',
        metadata: { old_status: 'Awaiting Employee Confirmation', new_status: 'Reopened', reopen_count: (ticket.reopen_count || 0) + 1 },
      }]);

      // Notify technician
      if (ticket.assigned_to) {
        await notifyAndEmail({
          recipientProfileId: ticket.assigned_to,
          eventName: 'Ticket Reopened Notification',
          templateVars: {
            ticket_number: ticket.ticket_number,
            subject: ticket.subject,
            technician_name: (ticket.assignee as any)?.full_name || 'Technician',
            employee_name: ticket.creator?.full_name || 'Employee',
            rejection_reason: validated.rejection_reason,
            ticket_url: ticketUrl(id as string),
            company_name: 'DeskPulse',
          },
          link: `/tickets/${id}`,
        });
      }

      // Audit
      await supabaseAdmin.from('audit_logs').insert([{
        user_id: authId,
        action: 'TICKET_RESOLUTION_REJECTED',
        entity_type: 'ticket',
        entity_id: id as string,
        new_values: { status: 'Reopened', rejection_reason: validated.rejection_reason },
      }]);

      return res.json({ status: 'success', data: { status: 'Reopened' } });
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ status: 'error', message: error.issues.map(i => i.message).join(', ') });
    }
    console.error('[confirmResolution]', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// â”€â”€â”€ GET /tickets/:id/work-summary â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const getWorkSummary = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const role = req.user?.role;

    const { data: ticket } = await supabaseAdmin
      .from('tickets').select('status, work_started_at, technician_completed_at, total_work_duration_seconds, reopen_count, created_at, due_date, assigned_to').eq('id', id as string).single();

    if (!ticket) return res.status(404).json({ status: 'error', message: 'Not found' });

    const { data: sessions } = await supabaseAdmin
      .from('ticket_work_sessions').select('*').eq('ticket_id', id).order('started_at', { ascending: true });

    const { data: pauses } = await supabaseAdmin
      .from('ticket_sla_pauses').select('*').eq('ticket_id', id).order('paused_at', { ascending: true });

    const { data: resolution } = await supabaseAdmin
      .from('ticket_resolution').select('*').eq('ticket_id', id).order('attempt_number', { ascending: true });

    const slaStatus = await calculateSlaStatus(id as string);

    // First response time
    const firstSession = sessions?.[0];
    const firstResponseSeconds = firstSession && ticket.created_at
      ? Math.floor((new Date(firstSession.started_at).getTime() - new Date(ticket.created_at).getTime()) / 1000)
      : null;

    res.json({
      status: 'success',
      data: {
        ticket,
        sessions: sessions ?? [],
        pauses: pauses ?? [],
        resolutions: role === 'Employee'
          ? (resolution ?? []).map((r: any) => ({ resolution_summary: r.resolution_summary, problem_identified: r.problem_identified, work_performed: r.work_performed, technician_completed_at: r.technician_completed_at, attempt_number: r.attempt_number }))
          : (resolution ?? []),
        slaStatus,
        metrics: {
          totalWorkDurationSeconds: ticket.total_work_duration_seconds,
          totalSessions: sessions?.length ?? 0,
          firstResponseSeconds,
          reopenCount: ticket.reopen_count,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// â”€â”€â”€ GET /tickets/:id/resolution â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const getResolution = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const role = req.user?.role;

    let query = supabaseAdmin
      .from('ticket_resolution')
      .select('*, technician:profiles!ticket_resolution_technician_id_fkey(full_name, profile_picture_url)')
      .eq('ticket_id', id)
      .order('attempt_number', { ascending: true });

    const { data: resolutions, error } = await query;
    if (error) throw error;

    // For employees, filter fields
    const filtered = role === 'Employee'
      ? (resolutions ?? []).map((r: any) => ({
          id: r.id,
          resolution_summary: r.resolution_summary,
          problem_identified: r.problem_identified,
          work_performed: r.work_performed,
          technician_completed_at: r.technician_completed_at,
          attempt_number: r.attempt_number,
          technician: r.technician,
        }))
      : resolutions;

    // Get ratings and confirmations
    const { data: confirmations } = await supabaseAdmin
      .from('ticket_resolution_confirmations')
      .select('*, rating:ticket_ratings(*)')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true });

    res.json({ status: 'success', data: { resolutions: filtered ?? [], confirmations: confirmations ?? [] } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// â”€â”€â”€ POST /tickets/:id/attachments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const attachmentSchema = z.object({
  file_name: z.string().min(1),
  file_size: z.number().int().positive(),
  file_type: z.string().min(1),
  storage_path: z.string().min(1),
  visibility: z.enum(['internal', 'employee_visible']).default('internal'),
  description: z.string().optional().nullable(),
  attachment_type: z.enum(['evidence', 'screenshot', 'log', 'document', 'other']).default('evidence'),
});

export const addAttachment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const caller = await getCallerProfile(req);
    if (!caller) return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    const { profileId, authId } = caller;

    const { data: ticket } = await supabaseAdmin.from('tickets').select('ticket_number, subject').eq('id', id as string).single();
    if (!ticket) return res.status(404).json({ status: 'error', message: 'Ticket not found' });

    const validated = attachmentSchema.parse(req.body);

    const { data: attachment, error } = await supabaseAdmin
      .from('ticket_attachments')
      .insert([{
        ticket_id: id as string,
        uploaded_by: profileId,
        ...validated,
      }])
      .select('*, uploader:profiles!ticket_attachments_uploaded_by_fkey(full_name)')
      .single();

    if (error) throw error;

    // Timeline
    await supabaseAdmin.from('ticket_timeline').insert([{
      ticket_id: id as string,
      user_id: profileId,
      action_type: 'ATTACHMENT',
      message: `Attachment uploaded: ${validated.file_name} (${validated.visibility === 'internal' ? 'Internal' : 'Visible to Employee'})`,
      metadata: { attachment_id: attachment.id, file_name: validated.file_name, visibility: validated.visibility },
    }]);

    res.status(201).json({ status: 'success', data: attachment });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ status: 'error', message: error.issues.map(i => i.message).join(', ') });
    }
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// â”€â”€â”€ GET /tickets/:id/attachments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const getAttachments = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const role = req.user?.role;

    let query = supabaseAdmin
      .from('ticket_attachments')
      .select('*, uploader:profiles!ticket_attachments_uploaded_by_fkey(full_name, profile_picture_url)')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true });

    if (role === 'Employee') {
      query = query.eq('visibility', 'employee_visible');
    }

    const { data, error } = await query;
    if (error) throw error;

    // Generate signed URLs for secure access
    const attachmentsWithUrls = await Promise.all(
      (data ?? []).map(async (att: any) => {
        if (att.storage_path) {
          const { data: signedUrl } = await supabaseAdmin.storage
            .from('ticket_attachments')
            .createSignedUrl(att.storage_path, 3600); // 1 hour
          return { ...att, signed_url: signedUrl?.signedUrl || null };
        }
        return att;
      })
    );

    res.json({ status: 'success', data: attachmentsWithUrls });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// â”€â”€â”€ PATCH /tickets/:id/status â€” extend existing to handle SLA pause â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Note: This is the hook we add to the existing updateTicketStatus to handle
// SLA pause when status changes to/from "Waiting for User"
export const handleSlaStatusTransition = async (
  ticketId: string,
  oldStatus: string,
  newStatus: string,
  profileId: string
) => {
  const slaExt = await getSetting('sla_config_extended');
  if (!slaExt?.pause_sla_on_waiting_for_user) return;

  if (newStatus === 'Waiting for User' && oldStatus !== 'Waiting for User') {
    await pauseSla(ticketId, profileId);
  } else if (oldStatus === 'Waiting for User' && newStatus !== 'Waiting for User') {
    await resumeSla(ticketId, profileId);
  }
};




