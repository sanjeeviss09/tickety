import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import { supabaseAdmin } from '../config/supabase';
import { routeUnassignedTicketsForTechnician } from '../services/routing.service';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// GET /workforce/summary  —  KPI cards (Available Techs, Not Checked In, At Capacity, Active Rule)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/summary', requireAuth, requireRole(['Admin', 'Technician']), async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    // 1. Fetch all technician profiles
    const { data: techs, error: techErr } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, roles!inner(name)')
      .eq('is_active', true)
      .eq('roles.name', 'Technician');

    if (techErr) throw techErr;
    const techIds = techs?.map(t => t.id) || [];

    if (techIds.length === 0) {
      return res.json({
        status: 'success',
        data: { available: 0, notCheckedIn: 0, atCapacity: 0, totalTechs: 0, rule: null }
      });
    }

    // 2. Fetch today's attendance records
    const { data: attendance } = await supabaseAdmin
      .from('technician_attendance')
      .select('technician_id, status, shift_profile_id, shift:shift_profiles(start_time, end_time, grace_period_mins, working_days)')
      .in('technician_id', techIds)
      .eq('shift_date', today);

    // 3. Fetch active leaves
    const { data: leaves } = await supabaseAdmin
      .from('technician_leave_exceptions')
      .select('technician_id')
      .in('technician_id', techIds)
      .eq('status', 'Approved')
      .eq('assignment_impact', 'Unavailable')
      .lte('start_time', now.toISOString())
      .gte('end_time', now.toISOString());

    const onLeaveSet = new Set(leaves?.map(l => l.technician_id) || []);

    // 4. Fetch active ticket counts per technician
    const { data: activeTickets } = await supabaseAdmin
      .from('tickets')
      .select('assigned_to')
      .in('assigned_to', techIds)
      .not('status', 'in', '(Resolved,Closed,Cancelled)');

    const workloadCounts: Record<string, number> = {};
    (activeTickets || []).forEach(t => {
      if (t.assigned_to) {
        workloadCounts[t.assigned_to] = (workloadCounts[t.assigned_to] || 0) + 1;
      }
    });

    // 5. Fetch global rules
    const { data: rules } = await supabaseAdmin
      .from('assignment_availability_rules')
      .select('*')
      .limit(1)
      .single();

    // 6. Fetch per-technician capacity overrides
    const { data: techCapacities } = await supabaseAdmin
      .from('technician_capacities')
      .select('technician_id, capacity_limit')
      .in('technician_id', techIds);

    const capacityOverrides: Record<string, number | null> = {};
    (techCapacities || []).forEach(tc => {
      capacityOverrides[tc.technician_id] = tc.capacity_limit;
    });

    const defaultCap = rules?.default_capacity_limit ?? 10;

    // Calculate counts
    let available = 0;
    let notCheckedIn = 0;
    let atCapacity = 0;

    const attendanceMap: Record<string, any> = {};
    (attendance || []).forEach(a => { attendanceMap[a.technician_id] = a; });

    techIds.forEach(techId => {
      if (onLeaveSet.has(techId)) return; // on leave, skip

      const att = attendanceMap[techId];
      const isPresent = att && (att.status === 'Present' || att.status === 'Late');

      if (isPresent) {
        available++;
        // Check capacity
        const cap = capacityOverrides[techId] !== undefined ? capacityOverrides[techId] : defaultCap;
        const load = workloadCounts[techId] || 0;
        if (cap !== null && load >= cap) {
          atCapacity++;
        }
      } else if (att && (att.status === 'Scheduled' || att.status === 'Not Checked In')) {
        notCheckedIn++;
      }
    });

    res.json({
      status: 'success',
      data: {
        available,
        notCheckedIn,
        atCapacity,
        totalTechs: techIds.length,
        rule: rules || null
      }
    });
  } catch (error: any) {
    console.error('[Workforce Summary Error]', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /workforce/attendance/today  —  Full technician status table
// ─────────────────────────────────────────────────────────────────────────────
router.get('/attendance/today', requireAuth, requireRole(['Admin', 'Technician']), async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    // 1. All active technicians
    const { data: techs, error: techErr } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email_address, employee_id, roles!inner(name)')
      .eq('is_active', true)
      .eq('roles.name', 'Technician');

    if (techErr) throw techErr;
    const techIds = techs?.map(t => t.id) || [];
    if (techIds.length === 0) return res.json({ status: 'success', data: [] });

    // 2. Today's attendance with shift info
    const { data: attendance } = await supabaseAdmin
      .from('technician_attendance')
      .select(`
        id, technician_id, status, check_in_time, check_out_time,
        shift:shift_profiles(id, name, start_time, end_time)
      `)
      .in('technician_id', techIds)
      .eq('shift_date', today);

    // 3. Active shift assignments (for techs without attendance records)
    const { data: shiftAssignments } = await supabaseAdmin
      .from('technician_shift_assignments')
      .select('technician_id, shift:shift_profiles(id, name, start_time, end_time, working_days)')
      .in('technician_id', techIds)
      .lte('effective_start', today)
      .or(`effective_end.is.null,effective_end.gte.${today}`);

    // 4. Active leaves
    const { data: leaves } = await supabaseAdmin
      .from('technician_leave_exceptions')
      .select('technician_id, exception_type, reason')
      .in('technician_id', techIds)
      .eq('status', 'Approved')
      .eq('assignment_impact', 'Unavailable')
      .lte('start_time', now.toISOString())
      .gte('end_time', now.toISOString());

    const leaveMap: Record<string, any> = {};
    (leaves || []).forEach(l => { leaveMap[l.technician_id] = l; });

    // 5. Active ticket counts
    const { data: activeTickets } = await supabaseAdmin
      .from('tickets')
      .select('assigned_to')
      .in('assigned_to', techIds)
      .not('status', 'in', '(Resolved,Closed,Cancelled)');

    const workloadCounts: Record<string, number> = {};
    (activeTickets || []).forEach(t => {
      if (t.assigned_to) workloadCounts[t.assigned_to] = (workloadCounts[t.assigned_to] || 0) + 1;
    });

    // 6. Global rules + per-technician capacity
    const { data: rules } = await supabaseAdmin
      .from('assignment_availability_rules')
      .select('*').limit(1).single();

    const { data: techCapacities } = await supabaseAdmin
      .from('technician_capacities')
      .select('technician_id, capacity_limit')
      .in('technician_id', techIds);

    const capacityOverrides: Record<string, number | null> = {};
    (techCapacities || []).forEach(tc => { capacityOverrides[tc.technician_id] = tc.capacity_limit; });

    const defaultCap = rules?.default_capacity_limit ?? 10;

    // Build shift assignment map
    const shiftMap: Record<string, any> = {};
    (shiftAssignments || []).forEach(sa => {
      if (!shiftMap[sa.technician_id]) shiftMap[sa.technician_id] = sa.shift;
    });

    // Build attendance map
    const attMap: Record<string, any> = {};
    (attendance || []).forEach(a => { attMap[a.technician_id] = a; });

    // 7. Compose response
    const result = (techs || []).map(tech => {
      const att = attMap[tech.id];
      const leave = leaveMap[tech.id];
      const shift = att?.shift || shiftMap[tech.id] || null;
      const load = workloadCounts[tech.id] || 0;
      const cap = capacityOverrides[tech.id] !== undefined ? capacityOverrides[tech.id] : defaultCap;

      let attendanceStatus = att?.status || 'No Record';
      if (leave) attendanceStatus = 'Leave';

      // Determine routing status
      let routingStatus: string;
      if (leave) {
        routingStatus = 'On Leave';
      } else if (attendanceStatus === 'Present' || attendanceStatus === 'Late') {
        if (cap !== null && load >= cap) {
          routingStatus = 'At Capacity';
        } else {
          routingStatus = 'Receiving Tickets';
        }
      } else if (attendanceStatus === 'Checked Out') {
        routingStatus = 'Checked Out';
      } else {
        routingStatus = 'Unavailable';
      }

      return {
        technician_id: tech.id,
        full_name: tech.full_name,
        employee_id: tech.employee_id,
        email: tech.email_address,
        shift: shift ? {
          id: shift.id,
          name: shift.name,
          start_time: shift.start_time,
          end_time: shift.end_time,
        } : null,
        attendance_status: attendanceStatus,
        check_in_time: att?.check_in_time || null,
        check_out_time: att?.check_out_time || null,
        active_load: load,
        capacity: cap,
        routing_status: routingStatus,
      };
    });

    res.json({ status: 'success', data: result });
  } catch (error: any) {
    console.error('[Workforce Attendance Error]', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// GET /workforce/attendance/my-status  —  Current logged-in technician status
// ─────────────────────────────────────────────────────────────────────────────
router.get('/attendance/my-status', requireAuth, async (req, res) => {
  try {
    const authUserId = (req as any).user?.id;
    if (!authUserId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, roles(name)')
      .or(`id.eq.${authUserId},auth_user_id.eq.${authUserId}`)
      .single();

    if (!profile) return res.status(404).json({ status: 'error', message: 'Profile not found' });

    const today = new Date().toISOString().split('T')[0];

    // Fetch today's attendance
    const { data: att } = await supabaseAdmin
      .from('technician_attendance')
      .select('*, shift:shift_profiles(id, name, start_time, end_time)')
      .eq('technician_id', profile.id)
      .eq('shift_date', today)
      .maybeSingle();

    // Fetch shift assignment if no attendance or shift not linked
    let shift = att?.shift || null;
    if (!shift) {
      const { data: assign } = await supabaseAdmin
        .from('technician_shift_assignments')
        .select('shift:shift_profiles(id, name, start_time, end_time)')
        .eq('technician_id', profile.id)
        .lte('effective_start', today)
        .or(`effective_end.is.null,effective_end.gte.${today}`)
        .limit(1)
        .maybeSingle();
      shift = (assign as any)?.shift || null;
    }

    res.json({
      status: 'success',
      data: {
        attendance: att || null,
        status: att?.status || 'Not Checked In',
        check_in_time: att?.check_in_time || null,
        check_out_time: att?.check_out_time || null,
        shift: shift
      }
    });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /workforce/attendance/check-in  —  Technician check-in
// ─────────────────────────────────────────────────────────────────────────────
router.post('/attendance/check-in', requireAuth, async (req, res) => {
  try {
    const { technician_id } = req.body;
    const authUserId = (req as any).user?.id;
    if (!authUserId) return res.status(401).json({ status: 'error', message: 'Unauthorized', error: 'Unauthorized' });

    // If not admin, tech can only check themselves in
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, roles(name)')
      .or(`id.eq.${authUserId},auth_user_id.eq.${authUserId}`)
      .single();

    const isAdmin = (profile as any)?.roles?.name === 'Admin';
    const targetTechId = isAdmin && technician_id ? technician_id : (profile?.id || technician_id);

    if (!targetTechId) return res.status(400).json({ status: 'error', message: 'Could not determine technician', error: 'Could not determine technician' });

    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    // Check existing record
    const { data: existing } = await supabaseAdmin
      .from('technician_attendance')
      .select('*')
      .eq('technician_id', targetTechId)
      .eq('shift_date', today)
      .maybeSingle();

    if (existing) {
      if (existing.status === 'Present' || existing.status === 'Late') {
        return res.status(400).json({ status: 'error', message: 'Already checked in', error: 'Already checked in' });
      }
      if (existing.status === 'Checked Out') {
        return res.status(400).json({ status: 'error', message: 'Already checked out for today', error: 'Already checked out for today' });
      }

      // Determine if late based on shift
      let status = 'Present';
      if (existing.shift_profile_id) {
        const { data: shift } = await supabaseAdmin
          .from('shift_profiles')
          .select('start_time, late_threshold_mins')
          .eq('id', existing.shift_profile_id)
          .single();

        if (shift) {
          const [h, m] = shift.start_time.split(':').map(Number);
          const shiftStart = new Date();
          shiftStart.setHours(h, m, 0, 0);
          const lateTime = new Date(shiftStart.getTime() + (shift.late_threshold_mins || 30) * 60000);
          if (new Date() > lateTime) status = 'Late';
        }
      }

      await supabaseAdmin
        .from('technician_attendance')
        .update({ status, check_in_time: now })
        .eq('id', existing.id);
    } else {
      // Find active shift assignment
      const { data: shiftAssign } = await supabaseAdmin
        .from('technician_shift_assignments')
        .select('shift_profile_id, shift:shift_profiles(start_time, late_threshold_mins)')
        .eq('technician_id', targetTechId)
        .lte('effective_start', today)
        .or(`effective_end.is.null,effective_end.gte.${today}`)
        .limit(1)
        .maybeSingle();

      let status = 'Present';
      if (shiftAssign?.shift) {
        const sh = shiftAssign.shift as any;
        const [h, m] = sh.start_time.split(':').map(Number);
        const shiftStart = new Date();
        shiftStart.setHours(h, m, 0, 0);
        const lateTime = new Date(shiftStart.getTime() + (sh.late_threshold_mins || 30) * 60000);
        if (new Date() > lateTime) status = 'Late';
      }

      await supabaseAdmin
        .from('technician_attendance')
        .insert([{
          technician_id: targetTechId,
          shift_date: today,
          shift_profile_id: shiftAssign?.shift_profile_id || null,
          status,
          check_in_time: now,
        }]);
    }

    // Automatically assign any pending unassigned tickets belonging to this technician's unit(s)
    const { assignedCount } = await routeUnassignedTicketsForTechnician(targetTechId);

    const message = assignedCount > 0
      ? `Checked in successfully. Assigned ${assignedCount} pending ticket${assignedCount > 1 ? 's' : ''} from your unit.`
      : 'Checked in successfully';

    res.json({ status: 'success', message, assignedCount });
  } catch (error: any) {
    console.error('[Check-in Error]', error.message);
    res.status(400).json({ status: 'error', message: error.message, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /workforce/attendance/check-out  —  Technician check-out
// ─────────────────────────────────────────────────────────────────────────────
router.post('/attendance/check-out', requireAuth, async (req, res) => {
  try {
    const { technician_id } = req.body;
    const authUserId = (req as any).user?.id;
    if (!authUserId) return res.status(401).json({ status: 'error', message: 'Unauthorized', error: 'Unauthorized' });

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, roles(name)')
      .or(`id.eq.${authUserId},auth_user_id.eq.${authUserId}`)
      .single();

    const isAdmin = (profile as any)?.roles?.name === 'Admin';
    const targetTechId = isAdmin && technician_id ? technician_id : (profile?.id || technician_id);
    if (!targetTechId) return res.status(400).json({ status: 'error', message: 'Could not determine technician', error: 'Could not determine technician' });

    const today = new Date().toISOString().split('T')[0];

    const { data: att } = await supabaseAdmin
      .from('technician_attendance')
      .select('*')
      .eq('technician_id', targetTechId)
      .eq('shift_date', today)
      .maybeSingle();

    if (!att || (att.status !== 'Present' && att.status !== 'Late')) {
      return res.status(400).json({ status: 'error', message: 'Not checked in. Cannot check out.', error: 'Not checked in. Cannot check out.' });
    }

    const checkInTime = new Date(att.check_in_time).getTime();
    const checkOutTime = Date.now();
    const durationMins = Math.floor((checkOutTime - checkInTime) / 60000);

    await supabaseAdmin
      .from('technician_attendance')
      .update({
        status: 'Checked Out',
        check_out_time: new Date(checkOutTime).toISOString(),
        total_working_duration_mins: (att.total_working_duration_mins || 0) + durationMins,
      })
      .eq('id', att.id);

    res.json({ status: 'success', message: 'Checked out successfully' });
  } catch (error: any) {
    console.error('[Check-out Error]', error.message);
    res.status(400).json({ status: 'error', message: error.message, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /workforce/attendance/mark  —  Admin manually mark attendance
// ─────────────────────────────────────────────────────────────────────────────
router.post('/attendance/mark', requireAuth, requireRole(['Admin']), async (req, res) => {
  try {
    const { technician_id, status, shift_date } = req.body;
    if (!technician_id || !status) {
      return res.status(400).json({ error: 'technician_id and status are required' });
    }

    const date = shift_date || new Date().toISOString().split('T')[0];

    const { data: existing } = await supabaseAdmin
      .from('technician_attendance')
      .select('id')
      .eq('technician_id', technician_id)
      .eq('shift_date', date)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from('technician_attendance')
        .update({ status, exception_message: `Manually marked by Admin` })
        .eq('id', existing.id);
    } else {
      await supabaseAdmin
        .from('technician_attendance')
        .insert([{
          technician_id,
          shift_date: date,
          status,
          exception_message: 'Manually marked by Admin',
        }]);
    }

    res.json({ status: 'success', message: 'Attendance marked' });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /workforce/rules  —  Get global assignment availability rules
// ─────────────────────────────────────────────────────────────────────────────
router.get('/rules', requireAuth, requireRole(['Admin', 'Technician']), async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('assignment_availability_rules')
      .select('*')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    res.json({ status: 'success', data: data || {} });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /workforce/rules  —  Update global assignment availability rules
// ─────────────────────────────────────────────────────────────────────────────
router.put('/rules', requireAuth, requireRole(['Admin']), async (req, res) => {
  try {
    const { require_attendance, default_capacity_limit, critical_tickets_bypass_capacity } = req.body;
    const authUserId = (req as any).user?.id;

    // Get profile ID
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('auth_user_id', authUserId)
      .single();

    // Get existing row
    const { data: existing } = await supabaseAdmin
      .from('assignment_availability_rules')
      .select('id')
      .limit(1)
      .single();

    const updatePayload: any = {
      updated_at: new Date().toISOString(),
      updated_by: profile?.id || null,
    };
    if (require_attendance !== undefined) updatePayload.require_attendance = require_attendance;
    if (default_capacity_limit !== undefined) updatePayload.default_capacity_limit = default_capacity_limit;
    if (critical_tickets_bypass_capacity !== undefined) updatePayload.critical_tickets_bypass_capacity = critical_tickets_bypass_capacity;

    if (existing) {
      const { data, error } = await supabaseAdmin
        .from('assignment_availability_rules')
        .update(updatePayload)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return res.json({ status: 'success', data });
    } else {
      const { data, error } = await supabaseAdmin
        .from('assignment_availability_rules')
        .insert([{ ...updatePayload }])
        .select()
        .single();

      if (error) throw error;
      return res.json({ status: 'success', data });
    }
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SHIFT PROFILES CRUD
// ─────────────────────────────────────────────────────────────────────────────
router.get('/shifts', requireAuth, requireRole(['Admin', 'Technician']), async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('shift_profiles')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json({ status: 'success', data: data || [] });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

router.post('/shifts', requireAuth, requireRole(['Admin']), async (req, res) => {
  try {
    const { name, start_time, end_time, working_days, timezone, grace_period_mins, late_threshold_mins, is_overnight, break_config } = req.body;
    if (!name || !start_time || !end_time) {
      return res.status(400).json({ error: 'name, start_time, end_time are required' });
    }

    const { data, error } = await supabaseAdmin
      .from('shift_profiles')
      .insert([{
        name,
        start_time,
        end_time,
        working_days: working_days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        timezone: timezone || 'UTC',
        grace_period_mins: grace_period_mins ?? 15,
        late_threshold_mins: late_threshold_mins ?? 30,
        is_overnight: is_overnight ?? false,
        break_config: break_config || null,
      }])
      .select()
      .single();

    if (error) throw error;
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

router.put('/shifts/:id', requireAuth, requireRole(['Admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    delete updates.id;
    delete updates.created_at;

    const { data, error } = await supabaseAdmin
      .from('shift_profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

router.delete('/shifts/:id', requireAuth, requireRole(['Admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin
      .from('shift_profiles')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
    res.json({ status: 'success', message: 'Shift deactivated' });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TECHNICIAN SHIFT ASSIGNMENTS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/shift-assignments', requireAuth, requireRole(['Admin']), async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('technician_shift_assignments')
      .select(`
        *,
        technician:profiles(id, full_name, employee_id),
        shift:shift_profiles(id, name, start_time, end_time)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ status: 'success', data: data || [] });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

router.post('/shift-assignments', requireAuth, requireRole(['Admin']), async (req, res) => {
  try {
    const { technician_id, shift_profile_id, effective_start, effective_end } = req.body;
    if (!technician_id || !shift_profile_id || !effective_start) {
      return res.status(400).json({ error: 'technician_id, shift_profile_id, effective_start required' });
    }

    const { data, error } = await supabaseAdmin
      .from('technician_shift_assignments')
      .insert([{ technician_id, shift_profile_id, effective_start, effective_end: effective_end || null }])
      .select()
      .single();

    if (error) throw error;
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

router.delete('/shift-assignments/:id', requireAuth, requireRole(['Admin']), async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('technician_shift_assignments')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ status: 'success', message: 'Assignment removed' });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TECHNICIAN CAPACITY OVERRIDES
// ─────────────────────────────────────────────────────────────────────────────
router.get('/capacities', requireAuth, requireRole(['Admin']), async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('technician_capacities')
      .select('*, technician:profiles(id, full_name, employee_id)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ status: 'success', data: data || [] });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

router.put('/capacities/:technician_id', requireAuth, requireRole(['Admin']), async (req, res) => {
  try {
    const { technician_id } = req.params;
    const { capacity_limit } = req.body;

    const { data: existing } = await supabaseAdmin
      .from('technician_capacities')
      .select('id')
      .eq('technician_id', technician_id)
      .maybeSingle();

    let data;
    if (existing) {
      const result = await supabaseAdmin
        .from('technician_capacities')
        .update({ capacity_limit })
        .eq('id', existing.id)
        .select()
        .single();
      if (result.error) throw result.error;
      data = result.data;
    } else {
      const result = await supabaseAdmin
        .from('technician_capacities')
        .insert([{ technician_id, capacity_limit }])
        .select()
        .single();
      if (result.error) throw result.error;
      data = result.data;
    }

    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// LEAVE / EXCEPTIONS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/leaves', requireAuth, requireRole(['Admin']), async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('technician_leave_exceptions')
      .select('*, technician:profiles!technician_leave_exceptions_technician_id_fkey(id, full_name, employee_id)')
      .order('start_time', { ascending: false })
      .limit(100);

    if (error) throw error;
    res.json({ status: 'success', data: data || [] });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

router.post('/leaves', requireAuth, requireRole(['Admin']), async (req, res) => {
  try {
    const { technician_id, exception_type, start_time, end_time, reason, assignment_impact, status: leaveStatus } = req.body;
    if (!technician_id || !exception_type || !start_time || !end_time) {
      return res.status(400).json({ error: 'technician_id, exception_type, start_time, end_time required' });
    }

    const authUserId = (req as any).user?.id;
    const { data: adminProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('auth_user_id', authUserId)
      .single();

    const { data, error } = await supabaseAdmin
      .from('technician_leave_exceptions')
      .insert([{
        technician_id,
        exception_type,
        start_time,
        end_time,
        reason: reason || null,
        assignment_impact: assignment_impact || 'Unavailable',
        status: leaveStatus || 'Approved',
        created_by: adminProfile?.id || null,
      }])
      .select()
      .single();

    if (error) throw error;
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

export default router;
