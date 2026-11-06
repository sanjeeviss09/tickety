import { supabaseAdmin } from '../config/supabase';
import { calculateAssignmentSlaDeadline } from './assignmentRecommendation.service';

const PRIORITY_WEIGHTS: Record<string, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

export const routeTicket = async (ticket: any, assignedBy: string | null = null) => {
  let { unit_id, department_id, category_id, id: ticket_id, priority } = ticket;

  // Resolve unit_id from department if missing
  if (!unit_id && department_id) {
    const { data: dept } = await supabaseAdmin
      .from('departments')
      .select('unit_id')
      .eq('id', department_id)
      .single();
    if (dept?.unit_id) {
      unit_id = dept.unit_id;
      await supabaseAdmin.from('tickets').update({ unit_id }).eq('id', ticket_id);
    }
  }

  // Resolve unit_id from creator/requester profile if still missing
  if (!unit_id && (ticket.affected_employee_id || ticket.requester_id || ticket.created_by)) {
    const empId = ticket.affected_employee_id || ticket.requester_id || ticket.created_by;
    const { data: empProfile } = await supabaseAdmin
      .from('profiles')
      .select('unit_id')
      .eq('id', empId)
      .single();
    if (empProfile?.unit_id) {
      unit_id = empProfile.unit_id;
      await supabaseAdmin.from('tickets').update({ unit_id }).eq('id', ticket_id);
    }
  }

  if (!unit_id) return null;

  // 1. Get global availability rules
  const { data: rulesData } = await supabaseAdmin
    .from('assignment_availability_rules')
    .select('*')
    .limit(1)
    .single();
    
  const globalRules = rulesData || { 
    require_attendance: true, 
    default_capacity_limit: 10, 
    critical_tickets_bypass_capacity: true 
  };

  // 2. Base Eligibility (Active, Unit Match)
  const [{ data: eligibleAssignments }, { data: profileTechs }] = await Promise.all([
    supabaseAdmin
      .from('technician_unit_assignments')
      .select('technician_id, profiles!inner(is_active)')
      .eq('unit_id', unit_id)
      .eq('profiles.is_active', true),
    supabaseAdmin
      .from('profiles')
      .select('id, role:roles!inner(name)')
      .eq('unit_id', unit_id)
      .eq('is_active', true)
      .eq('roles.name', 'Technician')
  ]);

  const techIdsFromJunction = eligibleAssignments?.map(a => a.technician_id) || [];
  const techIdsFromProfile = profileTechs?.map(p => p.id) || [];
  const baseTechIds = Array.from(new Set([...techIdsFromJunction, ...techIdsFromProfile]));

  // Calculate SLA Deadline
  const slaDeadline = await calculateAssignmentSlaDeadline(
    priority || 'Medium',
    unit_id,
    category_id,
    ticket.created_at || new Date().toISOString()
  );

  if (baseTechIds.length === 0) {
    return handleNoCandidates(ticket_id, unit_id, category_id, slaDeadline, [], 'No active technicians in unit');
  }

  // 3. Routing Rules (Primary / Backup Pools)
  let primaryPool: string[] = [...baseTechIds];
  let backupPool: string[] = [];
  let usedRuleId: string | null = null;
  
  const { data: rules } = await supabaseAdmin
    .from('ticket_routing_rules')
    .select('id, department_id, category_id, routing_rule_technicians(technician_id, pool_type)')
    .eq('unit_id', unit_id)
    .eq('is_active', true);
  
  if (rules && rules.length > 0) {
    const bestMatch = rules.find(r => r.department_id === department_id && r.category_id === category_id);
    const deptMatch = rules.find(r => r.department_id === department_id && !r.category_id);
    const catMatch = rules.find(r => r.category_id === category_id && !r.department_id);
    
    const matchedRule = bestMatch || deptMatch || catMatch;
    if (matchedRule && matchedRule.routing_rule_technicians) {
      usedRuleId = matchedRule.id;
      primaryPool = matchedRule.routing_rule_technicians
        .filter((t: any) => t.pool_type === 'Primary')
        .map((t: any) => t.technician_id);
      backupPool = matchedRule.routing_rule_technicians
        .filter((t: any) => t.pool_type === 'Backup')
        .map((t: any) => t.technician_id);
    }
  }

  // 4. Filter pools by Attendance, Leaves, and Capacity
  const filterByAvailability = async (candidateIds: string[]) => {
    if (candidateIds.length === 0) return { available: [], activeTickets: [] };
    
    // Check Leaves
    const { data: leaves } = await supabaseAdmin
      .from('technician_leave_exceptions')
      .select('technician_id')
      .in('technician_id', candidateIds)
      .eq('status', 'Approved')
      .eq('assignment_impact', 'Unavailable')
      .lte('start_time', new Date().toISOString())
      .gte('end_time', new Date().toISOString());
      
    const techOnLeave = new Set(leaves?.map(l => l.technician_id) || []);
    let available = candidateIds.filter(id => !techOnLeave.has(id));

    // Check Attendance dynamically if required
    if (globalRules.require_attendance && available.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      
      const { data: attendanceData } = await supabaseAdmin
        .from('technician_attendance')
        .select(`
          technician_id, 
          status,
          shift_profiles(start_time, grace_period_mins)
        `)
        .in('technician_id', available)
        .eq('shift_date', today);
      
      const eligibleTechs = new Set<string>();
      (attendanceData || []).forEach((a: any) => {
        if (a.status === 'Present' || a.status === 'Late') {
          eligibleTechs.add(a.technician_id);
        } else if (a.status === 'Scheduled' && a.shift_profiles) {
          // Check dynamic grace period
          const [hours, minutes] = a.shift_profiles.start_time.split(':').map(Number);
          const shiftStart = new Date(now);
          shiftStart.setHours(hours, minutes, 0, 0);
          
          const graceEnd = new Date(shiftStart.getTime() + a.shift_profiles.grace_period_mins * 60000);
          if (now <= graceEnd) {
             eligibleTechs.add(a.technician_id);
          }
        }
      });
      available = available.filter(id => eligibleTechs.has(id));
    }
    
    // Check Capacity Workloads
    let activeTickets: any[] = [];
    if (available.length > 0) {
        const { data: ticketsData } = await supabaseAdmin
        .from('tickets')
        .select('assigned_to, priority, status, due_date, assigned_at')
        .in('assigned_to', available)
        .not('status', 'in', '(Resolved,Closed,Cancelled)');
        activeTickets = ticketsData || [];
    }
      
    const workloadCounts: Record<string, number> = {};
    activeTickets.forEach(t => {
      if (t.assigned_to) {
        workloadCounts[t.assigned_to] = (workloadCounts[t.assigned_to] || 0) + 1;
      }
    });

    const isCritical = priority === 'Critical';
    const capacityLimit = globalRules.default_capacity_limit;
    
    if (capacityLimit != null && !(isCritical && globalRules.critical_tickets_bypass_capacity)) {
       available = available.filter(id => (workloadCounts[id] || 0) < capacityLimit);
    }
    
    return { available, activeTickets };
  };

  let { available: candidateTechs, activeTickets } = await filterByAvailability(primaryPool);
  
  if (candidateTechs.length === 0 && backupPool.length > 0) {
    // Fallback
    const backupResult = await filterByAvailability(backupPool);
    candidateTechs = backupResult.available;
    activeTickets = backupResult.activeTickets;
  }

  if (candidateTechs.length === 0) {
    return handleNoCandidates(ticket_id, unit_id, category_id, slaDeadline, primaryPool, 'No available technicians (capacity, leave, or attendance limit)');
  }

  // 5. Workload Selection Strategy
  const workloads: Record<string, { weight: number, lastAssigned: number }> = {};
  candidateTechs.forEach(id => workloads[id] = { weight: 0, lastAssigned: 0 });
  
  activeTickets.forEach(t => {
    if (t.assigned_to && workloads[t.assigned_to]) {
      let weight = PRIORITY_WEIGHTS[t.priority] || 1;
      if (t.status === 'Waiting for User') weight = 0.5;
      if (t.due_date && new Date(t.due_date).getTime() < Date.now()) weight += 2;
      workloads[t.assigned_to].weight += weight;
      
      const assignedTime = new Date(t.assigned_at || 0).getTime();
      if (assignedTime > workloads[t.assigned_to].lastAssigned) {
        workloads[t.assigned_to].lastAssigned = assignedTime;
      }
    }
  });

  let minWeight = Infinity;
  let minTechs: string[] = [];
  candidateTechs.forEach(techId => {
    const w = workloads[techId].weight;
    if (w < minWeight) {
      minWeight = w;
      minTechs = [techId];
    } else if (w === minWeight) {
      minTechs.push(techId);
    }
  });

  const minTechsSorted = minTechs.sort((a, b) => workloads[a].lastAssigned - workloads[b].lastAssigned);
  
  // 6. Assign Ticket Atomically
  const bypassCapacity = priority === 'Critical' && globalRules.critical_tickets_bypass_capacity;
  let selectedTechId: string | null = null;
  
  for (const techId of minTechsSorted) {
    const routingResult = {
      routed_at: new Date().toISOString(),
      unit_id,
      category_id,
      eligible_count: candidateTechs.length,
      auto_assignment: true,
      selected_tech_id: techId,
      used_rule_id: usedRuleId,
      method: usedRuleId ? 'routing_rule' : 'lowest_workload',
    };

    let assignedSuccess = false;

    // 1. Try atomic RPC if function is present in database
    try {
      const { data: assigned, error: rpcErr } = await supabaseAdmin.rpc('assign_ticket_atomic', {
        p_ticket_id: ticket_id,
        p_technician_id: techId,
        p_capacity_limit: globalRules.default_capacity_limit,
        p_bypass_capacity: bypassCapacity,
        p_eligible_pool: { tech_ids: candidateTechs },
        p_routing_result: routingResult,
        p_assignment_due_at: slaDeadline?.deadlineAt || null,
        p_assignment_sla_state: slaDeadline ? 'On Track' : null
      });

      if (!rpcErr && assigned) {
        assignedSuccess = true;
      }
    } catch {
      // RPC error fallback
    }

    // 2. Direct atomic-safe fallback if RPC failed or is missing from database
    if (!assignedSuccess) {
      const { data: techCap } = await supabaseAdmin
        .from('technician_capacities')
        .select('capacity_limit')
        .eq('technician_id', techId)
        .maybeSingle();

      const capacityLimit = techCap?.capacity_limit != null
        ? techCap.capacity_limit
        : globalRules.default_capacity_limit;

      if (capacityLimit != null && !bypassCapacity) {
        const { count: activeCount } = await supabaseAdmin
          .from('tickets')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_to', techId)
          .not('status', 'in', '(Resolved,Closed,Cancelled)');

        if ((activeCount || 0) >= capacityLimit) {
          continue; // Technician is at capacity, evaluate next
        }
      }

      const { error: updateErr } = await supabaseAdmin
        .from('tickets')
        .update({
          assigned_to: techId,
          assigned_at: new Date().toISOString(),
          status: 'Assigned',
          eligible_technician_pool: { tech_ids: candidateTechs },
          routing_result: routingResult,
          ...(slaDeadline && {
            assignment_due_at: slaDeadline.deadlineAt,
            assignment_sla_state: 'On Track'
          })
        })
        .eq('id', ticket_id);

      if (!updateErr) {
        assignedSuccess = true;
      } else {
        console.error('[routeTicket] Direct assignment update error:', updateErr);
      }
    }

    if (assignedSuccess) {
      selectedTechId = techId;
      break;
    }
  }

  if (selectedTechId) {
    // Record Event History
    await supabaseAdmin.from('assignment_events').insert([{
      ticket_id: ticket_id,
      routing_rule_id: usedRuleId,
      candidate_technicians: candidateTechs,
      selected_technician_id: selectedTechId,
      assignment_strategy: 'skill_workload',
      workload_snapshot: workloads,
      capacity_override_used: bypassCapacity
    }]);

    await supabaseAdmin.from('ticket_assignment_history').insert([{
      ticket_id: ticket_id,
      new_technician_id: selectedTechId,
      assigned_by: assignedBy,
      reason: usedRuleId ? 'Assigned by routing rule (Auto)' : 'Assigned by workload algorithm (Auto)',
      is_override: false,
      assignment_type: 'auto' 
    }]);
    
    await supabaseAdmin.from('ticket_timeline').insert([{
      ticket_id: ticket_id,
      user_id: assignedBy,
      action_type: 'ASSIGNMENT',
      message: 'Ticket automatically assigned by Availability Engine',
      metadata: { assigned_to: selectedTechId, used_rule_id: usedRuleId }
    }]);

    return selectedTechId;
  }

  return handleNoCandidates(ticket_id, unit_id, category_id, slaDeadline, primaryPool, 'No available technicians (all candidates rejected by atomic capacity check)');
};

const handleNoCandidates = async (
  ticket_id: string, 
  unit_id: string, 
  category_id: string, 
  slaDeadline: any, 
  eligibleTechIds: string[], 
  reason: string
) => {
  await supabaseAdmin
    .from('tickets')
    .update({
      eligible_technician_pool: { tech_ids: eligibleTechIds },
      routing_result: {
        routed_at: new Date().toISOString(),
        unit_id,
        category_id,
        eligible_count: 0,
        auto_assignment: false,
        reason,
        pool_strategy: 'auto',
      },
      ...(slaDeadline && {
        assignment_due_at: slaDeadline.deadlineAt,
        assignment_sla_state: 'On Track',
      }),
    })
    .eq('id', ticket_id);
  return null;
};

/**
 * Automatically find and assign pending unassigned tickets belonging to the technician's unit(s)
 * when that technician checks in.
 */
export const routeUnassignedTicketsForTechnician = async (technicianId: string) => {
  try {
    // 1. Fetch technician's profile and unit assignments
    const [{ data: profile }, { data: unitAssignments }] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('id, unit_id, is_active')
        .eq('id', technicianId)
        .single(),
      supabaseAdmin
        .from('technician_unit_assignments')
        .select('unit_id')
        .eq('technician_id', technicianId)
    ]);

    if (!profile || !profile.is_active) {
      return { assignedCount: 0, tickets: [] };
    }

    const unitIds = Array.from(new Set([
      ...(profile.unit_id ? [profile.unit_id] : []),
      ...(unitAssignments?.map((u: any) => u.unit_id) || [])
    ])).filter(Boolean);

    if (unitIds.length === 0) {
      return { assignedCount: 0, tickets: [] };
    }

    // 2. Fetch all unassigned open tickets for these units
    const { data: unassignedTickets, error } = await supabaseAdmin
      .from('tickets')
      .select('*')
      .is('assigned_to', null)
      .in('unit_id', unitIds)
      .not('status', 'in', '(Resolved,Closed,Cancelled)')
      .order('created_at', { ascending: true });

    if (error || !unassignedTickets || unassignedTickets.length === 0) {
      return { assignedCount: 0, tickets: [] };
    }

    console.log(`[routeUnassignedTickets] Found ${unassignedTickets.length} unassigned ticket(s) for unit(s) [${unitIds.join(', ')}] on technician check-in.`);

    let assignedCount = 0;
    const assignedTickets: string[] = [];

    for (const ticket of unassignedTickets) {
      const assignedTechId = await routeTicket(ticket, technicianId);
      if (assignedTechId) {
        assignedCount++;
        assignedTickets.push(ticket.id);
      }
    }

    return { assignedCount, tickets: assignedTickets };
  } catch (err) {
    console.error('[routeUnassignedTicketsForTechnician] Error:', err);
    return { assignedCount: 0, tickets: [] };
  }
};

