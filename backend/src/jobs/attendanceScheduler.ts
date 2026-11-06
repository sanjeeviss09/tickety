import cron from 'node-cron';
import { supabaseAdmin } from '../config/supabase';

// Run every 5 minutes
export const startAttendanceScheduler = () => {
  cron.schedule('*/5 * * * *', async () => {
    console.log('[Attendance Scheduler] Running attendance checks...');
    try {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const currentHour = now.getUTCHours();
      const currentMin = now.getUTCMinutes();
      const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}`;

      // 1. Mark 'Late' if grace period passed for Scheduled
      // We would need to join technician_attendance and shift_profiles.
      const { data: records, error } = await supabaseAdmin
        .from('technician_attendance')
        .select(`
          id, 
          status, 
          shift_profile_id,
          shift_profiles(start_time, grace_period_mins)
        `)
        .eq('shift_date', today)
        .eq('status', 'Scheduled');
        
      if (!error && records) {
        for (const record of records) {
          const profile = record.shift_profiles as any;
          if (!profile || !profile.start_time) continue;
          
          // Simple time comparison
          const startTimeStr = profile.start_time; // e.g., '09:00:00'
          const gracePeriod = profile.grace_period_mins || 15;
          
          // Convert to minutes since midnight for easy comparison
          const startParts = startTimeStr.split(':').map(Number);
          const startMins = startParts[0] * 60 + startParts[1];
          const currentTotalMins = currentHour * 60 + currentMin;
          
          if (currentTotalMins > (startMins + gracePeriod)) {
             await supabaseAdmin
               .from('technician_attendance')
               .update({ status: 'Late' })
               .eq('id', record.id);
             console.log(`[Attendance Scheduler] Marked attendance record ${record.id} as Late`);
          }
        }
      }
    } catch (err) {
      console.error('[Attendance Scheduler] Error:', err);
    }
  });
};
