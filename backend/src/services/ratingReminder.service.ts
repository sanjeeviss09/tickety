import cron from 'node-cron';
import { supabaseAdmin } from '../config/supabase';
import { notifyAndEmail } from './notifications.service';

const APP_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * Rating Reminder Scheduler
 * Runs every 30 minutes. Checks for tickets in "Awaiting Employee Confirmation"
 * that need a reminder. Idempotent — checks reminder history before sending.
 */
export function startRatingReminderScheduler() {
  cron.schedule('*/30 * * * *', async () => {
    try {
      await processRatingReminders();
    } catch (error) {
      console.error('[RatingReminderScheduler] Error:', error);
    }
  });
  console.log('✅ Rating reminder scheduler started (every 30 min)');
}

async function processRatingReminders() {
  // Load closure config
  const { data: configData } = await supabaseAdmin
    .from('system_settings').select('value').eq('key', 'closure_config').single();
  const config = configData?.value ?? {};

  if (!config.reminder_enabled) return;

  const maxReminders: number = config.max_reminders ?? 2;
  const firstDelayHours: number = config.first_reminder_delay_hours ?? 24;
  const frequencyHours: number = config.reminder_frequency_hours ?? 24;
  const sendOnWeekends: boolean = config.send_reminders_on_weekends ?? false;

  // Skip weekends if configured
  const today = new Date();
  if (!sendOnWeekends && (today.getDay() === 0 || today.getDay() === 6)) return;

  // Get all tickets awaiting confirmation
  const { data: pendingConfirmations } = await supabaseAdmin
    .from('ticket_resolution_confirmations')
    .select(`
      id, ticket_id, employee_id, technician_id, requested_at,
      ticket:tickets!ticket_resolution_confirmations_ticket_id_fkey(
        id, ticket_number, subject, status,
        creator:profiles!tickets_created_by_fkey(id, full_name, email_address),
        assignee:profiles!tickets_assigned_to_fkey(id, full_name)
      ),
      resolution:ticket_resolution!ticket_resolution_confirmations_resolution_id_fkey(resolution_summary)
    `)
    .eq('status', 'Pending');

  if (!pendingConfirmations?.length) return;

  const now = Date.now();

  for (const conf of pendingConfirmations) {
    const ticket: any = conf.ticket;

    // Verify ticket is still awaiting confirmation
    if (!ticket || ticket.status !== 'Awaiting Employee Confirmation') continue;

    const requestedAt = new Date(conf.requested_at).getTime();
    const elapsedHours = (now - requestedAt) / 3_600_000;

    // Check how many reminders already sent
    const { data: existingReminders } = await supabaseAdmin
      .from('ticket_rating_reminders')
      .select('reminder_number, sent_at')
      .eq('ticket_id', conf.ticket_id)
      .order('reminder_number', { ascending: false });

    const reminderCount = existingReminders?.length ?? 0;

    // Already maxed out?
    if (reminderCount >= maxReminders) continue;

    // Calculate when the next reminder should be sent
    let nextReminderAt: number;
    if (reminderCount === 0) {
      nextReminderAt = requestedAt + firstDelayHours * 3_600_000;
    } else {
      const lastReminder = existingReminders![0];
      nextReminderAt = new Date(lastReminder.sent_at).getTime() + frequencyHours * 3_600_000;
    }

    if (now < nextReminderAt) continue; // Not yet time

    const reminderNumber = reminderCount + 1;

    // Idempotent insert (UNIQUE constraint on ticket_id + reminder_number)
    const { error: insertError } = await supabaseAdmin
      .from('ticket_rating_reminders')
      .insert([{
        ticket_id: conf.ticket_id,
        confirmation_id: conf.id,
        employee_id: conf.employee_id,
        reminder_number: reminderNumber,
        sent_at: new Date().toISOString(),
        delivery_status: 'sent',
      }]);

    if (insertError) {
      // UNIQUE violation = already sent this reminder, skip silently
      if (insertError.code === '23505') continue;
      console.error('[RatingReminderScheduler] Insert error:', insertError);
      continue;
    }

    // Send notification + email
    if (conf.employee_id && ticket.creator?.id) {
      await notifyAndEmail({
        recipientProfileId: ticket.creator.id,
        eventName: 'Rating Reminder',
        templateVars: {
          ticket_number: ticket.ticket_number,
          subject: ticket.subject,
          employee_name: ticket.creator?.full_name || 'User',
          technician_name: ticket.assignee?.full_name || 'Technician',
          resolution_summary: (conf.resolution as any)?.resolution_summary || '',
          ticket_url: `${APP_URL}/tickets/${conf.ticket_id}`,
          company_name: 'DeskPulse',
          reminder_number: String(reminderNumber),
        },
        link: `/tickets/${conf.ticket_id}`,
      }).catch((err: any) => {
        console.error('[RatingReminderScheduler] Notify error:', err);
        supabaseAdmin.from('ticket_rating_reminders').update({
          delivery_status: 'failed',
          notes: String(err.message),
        }).eq('ticket_id', conf.ticket_id).eq('reminder_number', reminderNumber);
      });
    }

    // Auto-close logic if max days exceeded
    const closureConfig = configData?.value ?? {};
    const autoCloseDays: number = closureConfig.auto_close_days_no_response ?? 3;
    const autoCloseCutoff = requestedAt + autoCloseDays * 24 * 3_600_000;

    if (now > autoCloseCutoff && reminderNumber >= maxReminders) {
      const closeNow = new Date().toISOString();
      await supabaseAdmin.from('tickets').update({
        status: 'Closed',
        closed_at: closeNow,
        resolved_at: closeNow,
        resolution_date: closeNow,
      }).eq('id', conf.ticket_id).eq('status', 'Awaiting Employee Confirmation');

      await supabaseAdmin.from('ticket_resolution_confirmations').update({
        status: 'Confirmed',
        employee_comment: 'Auto-closed by system: no response within configured period',
        responded_at: closeNow,
      }).eq('id', conf.id);

      await supabaseAdmin.from('ticket_timeline').insert([{
        ticket_id: conf.ticket_id,
        user_id: null,
        action_type: 'STATUS_CHANGE',
        message: `Ticket automatically closed after ${autoCloseDays} days with no employee response.`,
        metadata: { auto: true, old_status: 'Awaiting Employee Confirmation', new_status: 'Closed' },
      }]);

      console.log(`[RatingReminderScheduler] Auto-closed ticket ${ticket.ticket_number}`);
    }
  }
}
