import { supabaseAdmin } from '../config/supabase';

export interface TechnicianRecommendation {
  technician_id: string;
  full_name: string;
  email_address: string;
  designation: string | null;
  unit_id: string | null;
  unit_name: string | null;
  availability_status: string;
  active_tickets: number;
  in_progress_tickets: number;
  waiting_tickets: number;
  sla_at_risk: number;
  critical_tickets: number;
  has_category_skill: boolean;
  proficiency: string | null;
  score: number;
  explanation: string[];
  is_recommended: boolean;
}

/**
 * Get scored and ranked technician recommendations for a ticket.
 * All scoring logic runs server-side.
 */
export async function getRecommendedTechnicians(
  ticketId: string,
  unitId: string,
  categoryId: string | null,
  priority: string
): Promise<TechnicianRecommendation[]> {
  // 1. Get pool config for this unit/category
  const { data: poolConfig } = await supabaseAdmin
    .from('technician_pools')
    .select('*')
    .eq('unit_id', unitId)
    .eq('is_active', true)
    .or(categoryId ? `category_id.eq.${categoryId},category_id.is.null` : 'category_id.is.null')
    .order('category_id', { ascending: false }) // category-specific first
    .limit(1)
    .maybeSingle();

  const skillMatchRequired = poolConfig?.skill_match_required ?? true;
  const availabilityCheckEnabled = poolConfig?.availability_check_enabled ?? true;
  const allowBusy = poolConfig?.allow_assign_busy ?? false;
  const allowAtCapacity = poolConfig?.allow_assign_at_capacity ?? false;
  const maxWorkload = poolConfig?.max_workload_per_technician ?? null;

  // 2. Get eligible technician IDs for this unit (from junction + profile)
  const [{ data: junctionTechs }, { data: profileTechs }] = await Promise.all([
    supabaseAdmin
      .from('technician_unit_assignments')
      .select('technician_id')
      .eq('unit_id', unitId),
    supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('unit_id', unitId)
      .eq('employment_status', 'Active')
  ]);

  const junctionIds = junctionTechs?.map(t => t.technician_id) || [];
  const profileIds = profileTechs?.map(p => p.id) || [];
  const allTechIds = Array.from(new Set([...junctionIds, ...profileIds]));

  if (allTechIds.length === 0) return [];

  // 3. Get profiles for these technicians (with role filter)
  const { data: techProfiles } = await supabaseAdmin
    .from('profiles')
    .select(`
      id, full_name, email_address, designation, unit_id,
      employment_status,
      roles!inner(name),
      units(name)
    `)
    .in('id', allTechIds)
    .eq('employment_status', 'Active')
    .eq('roles.name', 'Technician');

  if (!techProfiles || techProfiles.length === 0) return [];

  const techIds = techProfiles.map(p => p.id);

  // 4. Get category skills for these technicians
  const { data: categorySkills } = categoryId
    ? await supabaseAdmin
        .from('technician_category_skills')
        .select('technician_id, proficiency, is_active')
        .in('technician_id', techIds)
        .eq('category_id', categoryId)
        .eq('is_active', true)
    : { data: [] };

  const skillMap = new Map<string, string>(
    (categorySkills || []).map(s => [s.technician_id, s.proficiency])
  );

  // 5. Get current availability (most recent active record)
  const { data: availabilityRecords } = await supabaseAdmin
    .from('technician_availability')
    .select('technician_id, status')
    .in('technician_id', techIds)
    .eq('is_active', true)
    .or('ends_at.is.null,ends_at.gt.' + new Date().toISOString());

  // Build availability map (latest status per technician)
  const availabilityMap = new Map<string, string>();
  for (const rec of availabilityRecords || []) {
    if (!availabilityMap.has(rec.technician_id)) {
      availabilityMap.set(rec.technician_id, rec.status);
    }
  }

  // 6. Get active ticket workload
  const { data: activeTickets } = await supabaseAdmin
    .from('tickets')
    .select('assigned_to, status, priority, due_date')
    .in('assigned_to', techIds)
    .not('status', 'in', '("Resolved","Closed","Cancelled")');

  const workloadMap = new Map<string, {
    active: number;
    inProgress: number;
    waiting: number;
    slaAtRisk: number;
    critical: number;
  }>();

  for (const techId of techIds) {
    workloadMap.set(techId, { active: 0, inProgress: 0, waiting: 0, slaAtRisk: 0, critical: 0 });
  }

  const now = new Date();
  for (const ticket of activeTickets || []) {
    if (!ticket.assigned_to) continue;
    const wl = workloadMap.get(ticket.assigned_to);
    if (!wl) continue;
    wl.active++;
    if (ticket.status === 'In Progress') wl.inProgress++;
    if (ticket.status === 'Waiting for User') wl.waiting++;
    if (ticket.priority === 'Critical') wl.critical++;
    if (ticket.due_date && new Date(ticket.due_date) < now) wl.slaAtRisk++;
  }

  // 7. Build recommendations
  const PRIORITY_WEIGHTS: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
  const priorityWeight = PRIORITY_WEIGHTS[priority] || 1;

  const recommendations: TechnicianRecommendation[] = [];

  for (const tech of techProfiles) {
    const wl = workloadMap.get(tech.id)!;
    const avStatus = availabilityMap.get(tech.id) || 'Available';
    const hasSkill = skillMap.has(tech.id);
    const proficiency = skillMap.get(tech.id) || null;

    const explanation: string[] = [];
    let score = 100;
    let eligible = true;

    // Skill check
    if (skillMatchRequired && categoryId) {
      if (!hasSkill) {
        explanation.push('⚠ No category skill configured');
        score -= 30;
        eligible = false;
      } else {
        explanation.push(`✓ ${proficiency} skill match`);
        if (proficiency === 'Expert') score += 10;
      }
    } else if (hasSkill) {
      explanation.push(`✓ ${proficiency} skill match`);
    }

    // Availability check
    if (availabilityCheckEnabled) {
      if (avStatus === 'On Leave') {
        explanation.push('✗ On Leave');
        score -= 50;
        eligible = false;
      } else if (avStatus === 'Offline') {
        explanation.push('✗ Offline');
        score -= 40;
        eligible = false;
      } else if (avStatus === 'Temporarily Unavailable') {
        explanation.push('⚠ Temporarily Unavailable');
        score -= 30;
        if (!allowBusy) eligible = false;
      } else if (avStatus === 'At Capacity') {
        explanation.push('⚠ At Capacity');
        score -= 25;
        if (!allowAtCapacity) eligible = false;
      } else if (avStatus === 'Busy') {
        explanation.push('⚠ Busy');
        score -= 10;
        if (!allowBusy) eligible = false;
      } else {
        explanation.push('✓ Available');
        score += 15;
      }
    } else {
      explanation.push(`Status: ${avStatus}`);
    }

    // Workload score
    const workloadPenalty = wl.active * 5 + wl.slaAtRisk * 10 + wl.critical * 8;
    score -= workloadPenalty;

    if (maxWorkload !== null && wl.active >= maxWorkload) {
      explanation.push(`✗ At max workload (${wl.active}/${maxWorkload} tickets)`);
      eligible = false;
    } else {
      explanation.push(`${wl.active} active tickets`);
    }

    if (wl.slaAtRisk > 0) explanation.push(`${wl.slaAtRisk} SLA at risk`);
    if (wl.critical > 0) explanation.push(`${wl.critical} critical tickets`);

    // For critical priority tickets, penalize overloaded technicians more
    if (priority === 'Critical' && wl.active > 3) score -= 15;

    recommendations.push({
      technician_id: tech.id,
      full_name: tech.full_name || 'Unknown',
      email_address: tech.email_address,
      designation: tech.designation,
      unit_id: tech.unit_id,
      unit_name: (tech as any).units?.name || null,
      availability_status: avStatus,
      active_tickets: wl.active,
      in_progress_tickets: wl.inProgress,
      waiting_tickets: wl.waiting,
      sla_at_risk: wl.slaAtRisk,
      critical_tickets: wl.critical,
      has_category_skill: hasSkill,
      proficiency,
      score,
      explanation,
      is_recommended: eligible && score >= 50,
    });
  }

  // Sort: recommended first, then by score descending
  recommendations.sort((a, b) => {
    if (a.is_recommended !== b.is_recommended) return a.is_recommended ? -1 : 1;
    return b.score - a.score;
  });

  return recommendations;
}

/**
 * Calculate the assignment SLA deadline for a ticket based on priority/unit/category.
 */
export async function calculateAssignmentSlaDeadline(
  priority: string,
  unitId: string | null,
  categoryId: string | null,
  createdAt: string
): Promise<{ deadlineAt: string; targetMinutes: number } | null> {
  // Try to find most specific SLA config (unit+category+priority, then unit+priority, then priority)
  const queries = [
    unitId && categoryId
      ? { unit_id: unitId, category_id: categoryId, priority }
      : null,
    unitId
      ? { unit_id: unitId, category_id: null, priority }
      : null,
    { unit_id: null, category_id: null, priority },
  ].filter(Boolean);

  let targetMinutes: number | null = null;

  for (const q of queries) {
    let query = supabaseAdmin
      .from('assignment_sla_configs')
      .select('target_minutes')
      .eq('is_active', true)
      .eq('priority', q!.priority);

    if (q!.unit_id) query = query.eq('unit_id', q!.unit_id);
    else query = query.is('unit_id', null);

    if (q!.category_id) query = query.eq('category_id', q!.category_id);
    else query = query.is('category_id', null);

    const { data } = await query.maybeSingle();
    if (data) {
      targetMinutes = data.target_minutes;
      break;
    }
  }

  if (targetMinutes === null) return null;

  const created = new Date(createdAt);
  const deadline = new Date(created.getTime() + targetMinutes * 60 * 1000);
  return { deadlineAt: deadline.toISOString(), targetMinutes };
}

/**
 * Determine current assignment SLA state for a ticket.
 */
export function getAssignmentSlaState(
  assignmentDueAt: string | null,
  warningPercent: number = 75,
  criticalPercent: number = 90
): 'On Track' | 'Approaching' | 'At Risk' | 'Breached' {
  if (!assignmentDueAt) return 'On Track';

  const now = Date.now();
  const due = new Date(assignmentDueAt).getTime();

  if (now >= due) return 'Breached';

  // We'd need the created_at to compute elapsed %, so let's use time remaining
  // For now: Breached if past due, At Risk if < 10min, Approaching if < 30min
  const remainingMs = due - now;
  const remainingMin = remainingMs / 60000;

  if (remainingMin <= 5) return 'At Risk';
  if (remainingMin <= 15) return 'Approaching';
  return 'On Track';
}
