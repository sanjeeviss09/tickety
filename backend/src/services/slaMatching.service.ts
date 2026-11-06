import { supabaseAdmin } from '../config/supabase';

// Helper to check specificity weight of a policy (higher is more specific)
function getSpecificityWeight(policy: any) {
  let weight = 0;
  if (policy.unit_id) weight += 100;
  if (policy.category_id) weight += 10;
  if (policy.priority) weight += 1;
  return weight;
}

/**
 * Finds the most specific active SLA policy matching the ticket's unit, category, and priority.
 */
export async function matchSlaPolicy(unitId: string | null, categoryId: string | null, priority: string) {
  // Fetch all active policies
  const { data: policies, error } = await supabaseAdmin
    .from('sla_policies')
    .select('*')
    .eq('is_active', true);

  if (error || !policies) {
    console.error('Error fetching SLA policies', error);
    return null;
  }

  // Filter policies that match the ticket's criteria
  const matched = policies.filter((p) => {
    const unitMatch = !p.unit_id || p.unit_id === unitId;
    const categoryMatch = !p.category_id || p.category_id === categoryId;
    const priorityMatch = !p.priority || p.priority === priority;
    return unitMatch && categoryMatch && priorityMatch;
  });

  if (matched.length === 0) return null;

  // Sort by specificity weight descending
  matched.sort((a, b) => getSpecificityWeight(b) - getSpecificityWeight(a));

  return matched[0]; // Most specific wins
}

/**
 * Adds business hours to a starting date, skipping outside hours, weekends, and holidays.
 */
function addBusinessHours(startDate: Date, hoursToAdd: number, profile: any): Date {
  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const workDays = profile.work_days || [];
  const startParts = profile.start_time.split(':');
  const endParts = profile.end_time.split(':');
  
  const startHour = parseInt(startParts[0], 10);
  const startMin = parseInt(startParts[1] || '0', 10);
  const endHour = parseInt(endParts[0], 10);
  const endMin = parseInt(endParts[1] || '0', 10);

  const holidays = profile.exclude_holidays ? (profile.holidays || []) : [];
  
  let current = new Date(startDate.getTime());
  let remainingMs = hoursToAdd * 60 * 60 * 1000;

  // Safety net to prevent infinite loops
  let iterations = 0;

  while (remainingMs > 0 && iterations < 1000) {
    iterations++;
    const dayName = daysOfWeek[current.getUTCDay()];
    const dateString = current.toISOString().split('T')[0];
    
    const isWorkDay = workDays.includes(dayName) && !holidays.includes(dateString);

    if (isWorkDay) {
      const dayStart = new Date(current);
      dayStart.setUTCHours(startHour, startMin, 0, 0);
      
      const dayEnd = new Date(current);
      dayEnd.setUTCHours(endHour, endMin, 0, 0);

      // If current is before day start, move to day start
      if (current < dayStart) {
        current = dayStart;
      }

      // If current is within working hours
      if (current < dayEnd) {
        const msUntilEndOfDay = dayEnd.getTime() - current.getTime();
        
        if (remainingMs <= msUntilEndOfDay) {
          current = new Date(current.getTime() + remainingMs);
          remainingMs = 0;
          break;
        } else {
          remainingMs -= msUntilEndOfDay;
          // Move to end of day, then tomorrow
          current = dayEnd;
        }
      }
    }
    
    // Move to next day at 00:00:00
    current.setUTCDate(current.getUTCDate() + 1);
    current.setUTCHours(0, 0, 0, 0);
  }

  return current;
}

/**
 * Computes exact dates for first response and resolution based on policy and business hours.
 */
export async function calculateSlaDeadlines(policyId: string, createdAt: Date) {
  const { data: policy } = await supabaseAdmin
    .from('sla_policies')
    .select('*, business_hours_profiles(*)')
    .eq('id', policyId)
    .single();

  if (!policy || !policy.business_hours_profiles) {
    // Fallback to simple 24/7 calculation
    return {
      firstResponseDueAt: new Date(createdAt.getTime() + (policy?.first_response_hours || 4) * 3600000),
      resolutionDueAt: new Date(createdAt.getTime() + (policy?.resolution_hours || 24) * 3600000)
    };
  }

  const profile = policy.business_hours_profiles;
  
  const firstResponseDueAt = addBusinessHours(createdAt, Number(policy.first_response_hours), profile);
  const resolutionDueAt = addBusinessHours(createdAt, Number(policy.resolution_hours), profile);

  return {
    firstResponseDueAt,
    resolutionDueAt
  };
}
