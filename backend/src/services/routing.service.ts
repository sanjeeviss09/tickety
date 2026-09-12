import { supabaseAdmin } from '../config/supabase';

// Priority weights
const PRIORITY_WEIGHTS: Record<string, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

export const routeTicket = async (ticket: any, assignedBy: string | null = null) => {
  const { unit_id, department_id, category_id, id: ticket_id } = ticket;
  if (!unit_id) return null;

  // 1. Find all eligible technicians for this unit (from junction table AND profile unit_id)
  const [{ data: eligibleAssignments }, { data: profileTechs }] = await Promise.all([
    supabaseAdmin
      .from('technician_unit_assignments')
      .select('technician_id, profiles!inner(is_active)')
      .eq('unit_id', unit_id)
      .eq('assignment_type', 'Automatic Assignment')
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
  const eligibleTechIds = Array.from(new Set([...techIdsFromJunction, ...techIdsFromProfile]));

  if (eligibleTechIds.length === 0) {
    return null; // Leave unassigned
  }

  // 2. Check explicit routing rules
  const { data: rules, error: rulesErr } = await supabaseAdmin
    .from('ticket_routing_rules')
    .select('*')
    .eq('unit_id', unit_id)
    .eq('is_active', true)
    .in('technician_id', eligibleTechIds) // Must be eligible and active
    .order('priority', { ascending: false });

  let selectedTechId: string | null = null;
  let usedRuleId: string | null = null;

  if (!rulesErr && rules && rules.length > 0) {
    // Evaluate in order of specificity (assuming higher priority = more specific in DB)
    // Or we manually check best match:
    // Best: unit + dept + category
    const bestMatch = rules.find(r => r.department_id === department_id && r.category_id === category_id);
    const deptMatch = rules.find(r => r.department_id === department_id && !r.category_id);
    const catMatch = rules.find(r => r.category_id === category_id && !r.department_id);

    if (bestMatch) {
      selectedTechId = bestMatch.technician_id;
      usedRuleId = bestMatch.id;
    } else if (deptMatch) {
      selectedTechId = deptMatch.technician_id;
      usedRuleId = deptMatch.id;
    } else if (catMatch) {
      selectedTechId = catMatch.technician_id;
      usedRuleId = catMatch.id;
    }
  }

  // 3. If no specific tech selected, use Workload Algorithm
  if (!selectedTechId) {
    const { data: activeTickets, error: ticketsErr } = await supabaseAdmin
      .from('tickets')
      .select('assigned_to, priority, status, due_date, assigned_at')
      .in('assigned_to', eligibleTechIds)
      .not('status', 'in', '("Resolved", "Closed", "Cancelled")');

    const workloads: Record<string, { weight: number, lastAssigned: number }> = {};
    for (const techId of eligibleTechIds) {
      workloads[techId] = { weight: 0, lastAssigned: 0 };
    }

    if (!ticketsErr && activeTickets) {
      const now = new Date().getTime();
      for (const t of activeTickets) {
        if (!t.assigned_to) continue;
        let weight = PRIORITY_WEIGHTS[t.priority] || 1;
        
        if (t.status === 'Waiting for User') {
          weight = 0.5;
        }

        if (t.due_date && new Date(t.due_date).getTime() < now) {
          weight += 2; // Overdue penalty
        }

        workloads[t.assigned_to].weight += weight;
        
        const assignedTime = new Date(t.assigned_at || 0).getTime();
        if (assignedTime > workloads[t.assigned_to].lastAssigned) {
          workloads[t.assigned_to].lastAssigned = assignedTime;
        }
      }
    }

    // Find the one with lowest weight
    let minWeight = Infinity;
    let minTechs: string[] = [];

    for (const techId of eligibleTechIds) {
      const w = workloads[techId].weight;
      if (w < minWeight) {
        minWeight = w;
        minTechs = [techId];
      } else if (w === minWeight) {
        minTechs.push(techId);
      }
    }

    // Tie-breaker: oldest lastAssigned
    if (minTechs.length === 1) {
      selectedTechId = minTechs[0];
    } else {
      selectedTechId = minTechs.sort((a, b) => workloads[a].lastAssigned - workloads[b].lastAssigned)[0];
    }
  }

  // 4. Assign the ticket
  if (selectedTechId) {
    const { error: updateErr } = await supabaseAdmin
      .from('tickets')
      .update({
        assigned_to: selectedTechId,
        assigned_at: new Date().toISOString(),
        status: 'Assigned'
      })
      .eq('id', ticket_id);

    if (!updateErr) {
      await supabaseAdmin.from('ticket_assignment_history').insert([{
        ticket_id: ticket_id,
        new_technician_id: selectedTechId,
        assigned_by: assignedBy,
        reason: usedRuleId ? 'Assigned by routing rule' : 'Assigned by workload algorithm',
        is_override: false
      }]);
      
      // Log timeline
      await supabaseAdmin.from('ticket_timeline').insert([{
        ticket_id: ticket_id,
        user_id: assignedBy,
        action_type: 'ASSIGNMENT',
        message: 'Ticket automatically routed',
        metadata: { assigned_to: selectedTechId, used_rule_id: usedRuleId }
      }]);

      return selectedTechId;
    }
  }

  return null;
};
