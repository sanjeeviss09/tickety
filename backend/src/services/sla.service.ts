import { supabaseAdmin } from '../config/supabase';

export interface SlaStatus {
  dueDate: Date | null;
  elapsedSeconds: number;
  remainingSeconds: number;
  pausedSeconds: number;
  status: 'On Track' | 'Approaching' | 'Breached';
  isPaused: boolean;
  warningThresholdPct: number;
}

/**
 * Calculate real SLA status for a ticket, accounting for pause intervals.
 * Reuses existing sla_configurations.resolution_hours and tickets.due_date.
 */
export async function calculateSlaStatus(ticketId: string): Promise<SlaStatus> {
  const { data: ticket } = await supabaseAdmin
    .from('tickets')
    .select('created_at, due_date, status, priority')
    .eq('id', ticketId)
    .single();

  const { data: slaExt } = await supabaseAdmin
    .from('system_settings')
    .select('value')
    .eq('key', 'sla_config_extended')
    .single();

  const warningThresholdPct = slaExt?.value?.warning_threshold_percent ?? 75;

  if (!ticket?.due_date) {
    return {
      dueDate: null,
      elapsedSeconds: 0,
      remainingSeconds: 0,
      pausedSeconds: 0,
      status: 'On Track',
      isPaused: false,
      warningThresholdPct,
    };
  }

  const now = Date.now();
  const createdAt = new Date(ticket.created_at).getTime();
  const dueAt = new Date(ticket.due_date).getTime();
  const totalSlaSeconds = (dueAt - createdAt) / 1000;

  // Get all completed pauses
  const { data: pauses } = await supabaseAdmin
    .from('ticket_sla_pauses')
    .select('paused_at, resumed_at, duration_seconds')
    .eq('ticket_id', ticketId)
    .not('resumed_at', 'is', null);

  const completedPauseSeconds = (pauses ?? []).reduce((sum: number, p: any) => {
    return sum + (p.duration_seconds ?? 0);
  }, 0);

  // Check for active (ongoing) pause
  const { data: activePause } = await supabaseAdmin
    .from('ticket_sla_pauses')
    .select('paused_at')
    .eq('ticket_id', ticketId)
    .is('resumed_at', null)
    .single();

  const activePauseSeconds = activePause
    ? Math.floor((now - new Date(activePause.paused_at).getTime()) / 1000)
    : 0;

  const totalPausedSeconds = completedPauseSeconds + activePauseSeconds;

  // Effective elapsed = wall clock elapsed - paused time
  const wallElapsedSeconds = Math.floor((now - createdAt) / 1000);
  const effectiveElapsedSeconds = Math.max(0, wallElapsedSeconds - totalPausedSeconds);
  const remainingSeconds = Math.floor(totalSlaSeconds - effectiveElapsedSeconds);

  const consumedPct = totalSlaSeconds > 0 ? (effectiveElapsedSeconds / totalSlaSeconds) * 100 : 0;

  let status: 'On Track' | 'Approaching' | 'Breached' = 'On Track';
  if (remainingSeconds <= 0) status = 'Breached';
  else if (consumedPct >= warningThresholdPct) status = 'Approaching';

  return {
    dueDate: new Date(ticket.due_date),
    elapsedSeconds: effectiveElapsedSeconds,
    remainingSeconds,
    pausedSeconds: totalPausedSeconds,
    status,
    isPaused: !!activePause,
    warningThresholdPct,
  };
}

/**
 * Start SLA pause — called when ticket moves to "Waiting for User".
 * Creates a new open pause record.
 */
export async function pauseSla(ticketId: string, pausedByProfileId: string) {
  // Only pause if there is no active pause
  const { data: existing } = await supabaseAdmin
    .from('ticket_sla_pauses')
    .select('id')
    .eq('ticket_id', ticketId)
    .is('resumed_at', null)
    .single();

  if (existing) return; // Already paused

  await supabaseAdmin.from('ticket_sla_pauses').insert([{
    ticket_id: ticketId,
    paused_by: pausedByProfileId,
    pause_reason: 'Waiting for User',
    paused_at: new Date().toISOString(),
  }]);
}

/**
 * Resume SLA — called when ticket leaves "Waiting for User".
 * Closes the open pause record and computes duration.
 */
export async function resumeSla(ticketId: string, resumedByProfileId: string) {
  const { data: activePause } = await supabaseAdmin
    .from('ticket_sla_pauses')
    .select('id, paused_at')
    .eq('ticket_id', ticketId)
    .is('resumed_at', null)
    .single();

  if (!activePause) return; // Nothing to resume

  const now = new Date();
  const durationSeconds = Math.floor(
    (now.getTime() - new Date(activePause.paused_at).getTime()) / 1000
  );

  await supabaseAdmin.from('ticket_sla_pauses').update({
    resumed_at: now.toISOString(),
    duration_seconds: durationSeconds,
    resumed_by: resumedByProfileId,
  }).eq('id', activePause.id);
}

/**
 * Calculate total active work duration in seconds across all completed sessions.
 * Does not include any currently active (not ended) session.
 */
export async function getTotalWorkDuration(ticketId: string): Promise<number> {
  const { data: sessions } = await supabaseAdmin
    .from('ticket_work_sessions')
    .select('duration_seconds')
    .eq('ticket_id', ticketId)
    .not('ended_at', 'is', null);

  return (sessions ?? []).reduce((sum: number, s: any) => sum + (s.duration_seconds ?? 0), 0);
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
