import { supabaseAdmin } from '../config/supabase';
import { notifyAndEmail } from './notifications.service';

/**
 * Check assignment SLA thresholds for all unassigned, open tickets with an assignment_due_at.
 * Sends idempotent notifications using the assignment_sla_events table.
 * Should be called on a schedule (e.g., every 5 minutes).
 */
export async function checkAssignmentSlaThresholds() {
  const now = new Date();

  // Get all open, unassigned tickets with an assignment deadline
  const { data: tickets, error } = await supabaseAdmin
    .from('tickets')
    .select(`
      id, ticket_number, subject, priority, unit_id, category_id,
      assignment_due_at, assignment_sla_state, created_at,
      units(name),
      ticket_categories(name)
    `)
    .is('assigned_to', null)
    .not('status', 'in', '("Resolved","Closed","Cancelled","Assigned","In Progress")')
    .not('assignment_due_at', 'is', null);

  if (error || !tickets) {
    console.error('[assignerSla] Error fetching tickets:', error);
    return;
  }

  for (const ticket of tickets) {
    const dueAt = new Date(ticket.assignment_due_at);
    const remainingMs = dueAt.getTime() - now.getTime();
    const totalMs = dueAt.getTime() - new Date(ticket.created_at).getTime();
    const elapsedPercent = totalMs > 0 ? ((totalMs - remainingMs) / totalMs) * 100 : 100;

    let newState: string = 'On Track';
    let thresholdType: string | null = null;

    if (now >= dueAt) {
      newState = 'Breached';
      thresholdType = 'breached';
    } else if (elapsedPercent >= 90) {
      newState = 'At Risk';
      thresholdType = 'at_risk';
    } else if (elapsedPercent >= 75) {
      newState = 'Approaching';
      thresholdType = 'approaching';
    }

    // Update SLA state if changed
    if (newState !== ticket.assignment_sla_state) {
      await supabaseAdmin
        .from('tickets')
        .update({ assignment_sla_state: newState })
        .eq('id', ticket.id);
    }

    // Send idempotent notification
    if (thresholdType) {
      await notifyAssignmentSlaThreshold(ticket, thresholdType, newState);
    }
  }
}

async function notifyAssignmentSlaThreshold(
  ticket: any,
  thresholdType: string,
  slaState: string
) {
  // Check if already notified for this threshold
  const { data: existing } = await supabaseAdmin
    .from('assignment_sla_events')
    .select('id')
    .eq('ticket_id', ticket.id)
    .eq('threshold_type', thresholdType)
    .maybeSingle();

  if (existing) return; // Already notified

  // Find assigners for this unit
  const { data: assigners } = await supabaseAdmin
    .from('assigner_unit_assignments')
    .select('assigner_id, is_primary, is_backup, profiles!inner(id, full_name, email_address)')
    .eq('unit_id', ticket.unit_id)
    .eq('is_active', true);

  if (!assigners || assigners.length === 0) {
    // Fall back to Admin
    await notifyAdminAboutSla(ticket, slaState);
    return;
  }

  const primaryAssigners = assigners.filter(a => a.is_primary);
  const backupAssigners = assigners.filter(a => a.is_backup);

  const recipientsToNotify = thresholdType === 'breached'
    ? [...backupAssigners, ...primaryAssigners]  // Escalate to backup on breach
    : primaryAssigners;

  if (recipientsToNotify.length === 0) {
    await notifyAdminAboutSla(ticket, slaState);
    return;
  }

  const eventName = thresholdType === 'breached'
    ? 'Assignment SLA Breached'
    : thresholdType === 'at_risk'
    ? 'Assignment SLA At Risk'
    : 'Assignment SLA Approaching';

  const templateVars = {
    ticket_number: ticket.ticket_number || ticket.id,
    subject: ticket.subject,
    priority: ticket.priority,
    unit_name: ticket.units?.name || 'Unknown Unit',
    category_name: ticket.ticket_categories?.name || 'Unknown Category',
    sla_state: slaState,
    assignment_due_at: ticket.assignment_due_at,
    ticket_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/assigner/tickets/${ticket.id}`,
  };

  for (const assigner of recipientsToNotify) {
    const profile = (assigner as any).profiles;
    if (!profile) continue;

    await notifyAndEmail({
      recipientProfileId: profile.id,
      eventName,
      templateVars,
      link: templateVars.ticket_url,
      fallbackTitle: `[${slaState}] Assignment SLA - Ticket #${ticket.ticket_number}`,
      fallbackMessage: `Ticket ${ticket.ticket_number} (${ticket.priority}) assignment SLA is ${slaState}.`,
    });

    // Record the notification event (idempotent)
    await supabaseAdmin
      .from('assignment_sla_events')
      .upsert({
        ticket_id: ticket.id,
        threshold_type: thresholdType,
        notified_at: new Date().toISOString(),
        recipient_id: profile.id,
      }, { onConflict: 'ticket_id,threshold_type', ignoreDuplicates: true });
  }
}

async function notifyAdminAboutSla(ticket: any, slaState: string) {
  const { data: adminRole } = await supabaseAdmin
    .from('roles')
    .select('id')
    .eq('name', 'Admin')
    .single();

  if (!adminRole) return;

  const { data: admins } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('role_id', adminRole.id);

  if (!admins) return;

  for (const admin of admins) {
    await notifyAndEmail({
      recipientProfileId: admin.id,
      eventName: 'Assignment SLA Breached',
      templateVars: {
        ticket_number: ticket.ticket_number || ticket.id,
        subject: ticket.subject,
        priority: ticket.priority,
        sla_state: slaState,
        ticket_url: `http://localhost:5173/assigner/tickets/${ticket.id}`,
      },
      fallbackTitle: `[${slaState}] Assignment SLA - Ticket #${ticket.ticket_number}`,
      fallbackMessage: `No assigner configured for unit. Ticket ${ticket.ticket_number} assignment SLA is ${slaState}.`,
    });
  }
}

/**
 * Start the assignment SLA scheduler (runs every 5 minutes).
 */
export function startAssignmentSlaScheduler() {
  const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  console.log('[assignerSla] Assignment SLA scheduler started (every 5 minutes)');

  // Run immediately on startup
  checkAssignmentSlaThresholds().catch(err =>
    console.error('[assignerSla] Initial check error:', err)
  );

  setInterval(() => {
    checkAssignmentSlaThresholds().catch(err =>
      console.error('[assignerSla] Scheduler error:', err)
    );
  }, INTERVAL_MS);
}
