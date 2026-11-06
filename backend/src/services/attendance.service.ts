import { supabaseAdmin } from '../config/supabase';
import { routeUnassignedTicketsForTechnician } from './routing.service';

export const checkIn = async (technician_id: string, shift_date: string) => {
  const { data, error } = await supabaseAdmin
    .from('technician_attendance')
    .select('*')
    .eq('technician_id', technician_id)
    .eq('shift_date', shift_date)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error('Error fetching attendance record');
  }

  const now = new Date().toISOString();

  if (data) {
    if (data.status === 'Present' || data.status === 'Checked Out') {
      throw new Error(`Technician is already ${data.status.toLowerCase()}`);
    }

    const { error: updateError } = await supabaseAdmin
      .from('technician_attendance')
      .update({
        status: data.status === 'Late' ? 'Late' : 'Present',
        check_in_time: now
      })
      .eq('id', data.id);

    if (updateError) throw updateError;
    const { assignedCount } = await routeUnassignedTicketsForTechnician(technician_id);
    const message = assignedCount > 0
      ? `Checked in successfully. Assigned ${assignedCount} pending ticket${assignedCount > 1 ? 's' : ''} from your unit.`
      : 'Checked in successfully';
    return { success: true, message, assignedCount };
  } else {
    // Implicitly create an attendance record if none exists for this shift
    const { error: insertError } = await supabaseAdmin
      .from('technician_attendance')
      .insert([{
        technician_id,
        shift_date,
        status: 'Present',
        check_in_time: now
      }]);

    if (insertError) throw insertError;
    const { assignedCount } = await routeUnassignedTicketsForTechnician(technician_id);
    const message = assignedCount > 0
      ? `Checked in successfully. Assigned ${assignedCount} pending ticket${assignedCount > 1 ? 's' : ''} from your unit.`
      : 'Checked in successfully';
    return { success: true, message, assignedCount };
  }
};

export const checkOut = async (technician_id: string, shift_date: string) => {
  const { data, error } = await supabaseAdmin
    .from('technician_attendance')
    .select('*')
    .eq('technician_id', technician_id)
    .eq('shift_date', shift_date)
    .single();

  if (error || !data || (data.status !== 'Present' && data.status !== 'Late')) {
    throw new Error('Cannot check out: Not checked in');
  }

  const checkInTime = new Date(data.check_in_time).getTime();
  const checkOutTime = new Date().getTime();
  const durationMins = Math.floor((checkOutTime - checkInTime) / 60000);

  const { error: updateError } = await supabaseAdmin
    .from('technician_attendance')
    .update({
      status: 'Checked Out',
      check_out_time: new Date(checkOutTime).toISOString(),
      total_working_duration_mins: (data.total_working_duration_mins || 0) + durationMins
    })
    .eq('id', data.id);

  if (updateError) throw updateError;
  return { success: true, message: 'Checked out successfully' };
};
