import cron from 'node-cron';
import { supabaseAdmin } from '../config/supabase';
import { calculateSlaStatus } from './sla.service';
import { sendEmail } from './email.service';

/**
 * Periodically evaluate tickets for SLA escalations.
 */
export function startSlaScheduler() {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log('[SLA Scheduler] Evaluating active SLA policies...');
    try {
      // Get all active tickets
      const { data: tickets, error } = await supabaseAdmin
        .from('tickets')
        .select('id, ticket_number, sla_policy_id')
        .not('status', 'in', '("Resolved", "Closed", "Canceled")')
        .not('sla_policy_id', 'is', null);

      if (error || !tickets) return;

      for (const ticket of tickets) {
        // Calculate current real-time SLA status
        const slaState = await calculateSlaStatus(ticket.id);

        if (!slaState.dueDate) continue;
        
        const totalSlaSeconds = slaState.elapsedSeconds + slaState.remainingSeconds;
        const consumedPct = totalSlaSeconds > 0 ? (slaState.elapsedSeconds / totalSlaSeconds) * 100 : 0;

        // Fetch escalation rules for this policy
        const { data: rules } = await supabaseAdmin
          .from('sla_escalation_rules')
          .select('*')
          .eq('policy_id', ticket.sla_policy_id);

        if (!rules) continue;

        for (const rule of rules) {
          if (consumedPct >= Number(rule.threshold_percent)) {
            // Check if we already escalated this rule for this ticket
            const { data: existingEvent } = await supabaseAdmin
              .from('ticket_escalation_events')
              .select('id')
              .eq('ticket_id', ticket.id)
              .eq('rule_id', rule.id)
              .single();

            if (!existingEvent) {
              // Trigger escalation
              console.log(`[SLA] Escalating ticket ${ticket.ticket_number} at ${rule.threshold_percent}%`);
              
              let recipientEmail = '';

              if (rule.recipient_type === 'User') {
                const { data: user } = await supabaseAdmin.from('profiles').select('email_address').eq('id', rule.recipient_id).single();
                if (user) recipientEmail = user.email_address;
              } else if (rule.recipient_type === 'Manager') {
                // Determine manager (simplification for this example, usually involves org structure)
                // For now, assuming recipient_id could be a fallback group
              }
              
              if (recipientEmail && rule.action === 'Notify') {
                await sendEmail({
                  to: recipientEmail,
                  subject: `[SLA Escalation] Ticket ${ticket.ticket_number}`,
                  html: `<p>Ticket <b>${ticket.ticket_number}</b> has exceeded the SLA threshold of ${rule.threshold_percent}%.</p>
                         <p>Action required.</p>`
                });
              }

              // Record event
              await supabaseAdmin.from('ticket_escalation_events').insert([{
                ticket_id: ticket.id,
                policy_id: ticket.sla_policy_id,
                rule_id: rule.id,
                threshold_percent: rule.threshold_percent,
                action_taken: rule.action
              }]);
            }
          }
        }
      }
    } catch (err) {
      console.error('[SLA Scheduler] Error:', err);
    }
  });
  console.log('✅ SLA Scheduler started (every 5 min)');
}
