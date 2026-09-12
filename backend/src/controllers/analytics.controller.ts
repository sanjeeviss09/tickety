import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

// Simple in-memory cache
const cache = new Map<string, { data: any; expiresAt: number }>();
function getCache(key: string) {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.data;
  return null;
}
function setCache(key: string, data: any, ttlSeconds = 300) {
  cache.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
}

// ── GET /api/v1/analytics/summary ───────────────────────────
export const getSummary = async (req: Request, res: Response) => {
  try {
    const cacheKey = 'analytics:summary';
    const cached = getCache(cacheKey);
    if (cached) return res.json({ status: 'success', data: cached, fromCache: true });

    // Ticket counts by status
    const { data: tickets } = await supabaseAdmin.from('tickets').select('status, priority, created_at, resolution_date, due_date');
    const { data: assets } = await supabaseAdmin.from('assets').select('status');
    const { data: profiles } = await supabaseAdmin.from('profiles').select('id').eq('is_active', true);
    const { data: warranty } = await supabaseAdmin.from('asset_warranty').select('warranty_end_date, amc_end_date');
    const { data: slaConfig } = await supabaseAdmin.from('sla_configurations').select('priority, resolution_hours');

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const summary = {
      totalTickets: tickets?.length || 0,
      openTickets: tickets?.filter(t => t.status === 'Open').length || 0,
      inProgressTickets: tickets?.filter(t => t.status === 'In Progress').length || 0,
      resolvedTickets: tickets?.filter(t => t.status === 'Resolved').length || 0,
      closedTickets: tickets?.filter(t => t.status === 'Closed').length || 0,
      criticalTickets: tickets?.filter(t => t.priority === 'Critical').length || 0,
      overdueTickets: tickets?.filter(t => t.due_date && new Date(t.due_date) < now && !['Resolved', 'Closed'].includes(t.status)).length || 0,
      // SLA compliance (tickets resolved within SLA)
      slaCompliance: calculateSlaCompliance(tickets || [], slaConfig || []),
      slaBreaches: tickets?.filter(t => t.due_date && new Date(t.due_date) < now && !['Resolved', 'Closed'].includes(t.status)).length || 0,
      avgResolutionHours: calculateAvgResolution(tickets || []),
      activeAssets: assets?.filter(a => a.status === 'Assigned').length || 0,
      totalAssets: assets?.length || 0,
      assetsUnderMaintenance: assets?.filter(a => a.status === 'Under Maintenance').length || 0,
      activeEmployees: profiles?.length || 0,
      warrantyExpiringSoon: warranty?.filter(w => w.warranty_end_date && new Date(w.warranty_end_date) <= thirtyDaysFromNow && new Date(w.warranty_end_date) > now).length || 0,
      amcExpiringSoon: warranty?.filter(w => w.amc_end_date && new Date(w.amc_end_date) <= thirtyDaysFromNow && new Date(w.amc_end_date) > now).length || 0,
    };

    setCache(cacheKey, summary, 300);
    res.json({ status: 'success', data: summary });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

function calculateSlaCompliance(tickets: any[], slaConfig: any[]) {
  const resolved = tickets.filter(t => ['Resolved', 'Closed'].includes(t.status) && t.resolution_date);
  if (!resolved.length) return 100;
  const slaMap: Record<string, number> = {};
  slaConfig.forEach(s => { slaMap[s.priority] = s.resolution_hours; });

  const compliant = resolved.filter(t => {
    const maxHours = slaMap[t.priority] || 72;
    const createdAt = new Date(t.created_at);
    const resolvedAt = new Date(t.resolution_date);
    const hours = (resolvedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    return hours <= maxHours;
  });
  return Math.round((compliant.length / resolved.length) * 100);
}

function calculateAvgResolution(tickets: any[]) {
  const resolved = tickets.filter(t => ['Resolved', 'Closed'].includes(t.status) && t.resolution_date);
  if (!resolved.length) return 0;
  const totalHours = resolved.reduce((sum, t) => {
    const hours = (new Date(t.resolution_date).getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60);
    return sum + hours;
  }, 0);
  return Math.round(totalHours / resolved.length * 10) / 10;
}

// ── GET /api/v1/analytics/ticket-trends ─────────────────────
export const getTicketTrends = async (req: Request, res: Response) => {
  try {
    const { period = 'month', unit, department } = req.query;
    const cacheKey = `analytics:ticket-trends:${period}:${unit}:${department}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json({ status: 'success', data: cached, fromCache: true });

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    let groupFormat: string;

    switch (period) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000 * 30); // last 30 days hourly
        groupFormat = 'YYYY-MM-DD HH24';
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 * 12); // last 12 weeks
        groupFormat = 'IYYY-IW';
        break;
      case 'year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000 * 3); // last 3 years
        groupFormat = 'YYYY';
        break;
      default: // month
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000 * 12); // last 12 months
        groupFormat = 'YYYY-MM';
    }

    let query = supabaseAdmin
      .from('tickets')
      .select('created_at, status, priority, unit_id, department_id, units(name), departments(name)')
      .gte('created_at', startDate.toISOString());

    const { data: rawTickets, error } = await query;
    if (error) throw error;

    // Group in-memory for flexibility
    const grouped: Record<string, { created: number; resolved: number; critical: number }> = {};

    (rawTickets || []).forEach(t => {
      let key: string;
      const d = new Date(t.created_at);
      switch (period) {
        case 'day': key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; break;
        case 'week': key = getISOWeekLabel(d); break;
        case 'year': key = `${d.getFullYear()}`; break;
        default: key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      }
      if (!grouped[key]) grouped[key] = { created: 0, resolved: 0, critical: 0 };
      grouped[key].created++;
      if (['Resolved', 'Closed'].includes(t.status)) grouped[key].resolved++;
      if (t.priority === 'Critical') grouped[key].critical++;
    });

    const trends = Object.keys(grouped).sort().map(k => ({
      period: k,
      created: grouped[k].created,
      resolved: grouped[k].resolved,
      critical: grouped[k].critical,
    }));

    setCache(cacheKey, trends, 300);
    res.json({ status: 'success', data: trends });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

function getISOWeekLabel(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// ── GET /api/v1/analytics/ticket-distribution ───────────────
export const getTicketDistribution = async (req: Request, res: Response) => {
  try {
    const { groupBy = 'status' } = req.query;

    const { data: tickets, error } = await supabaseAdmin
      .from('tickets')
      .select(`
        status, priority,
        ticket_categories(name),
        units(name),
        departments(name),
        assignee:profiles!tickets_assigned_to_fkey(full_name)
      `);
    if (error) throw error;

    const counted: Record<string, number> = {};
    (tickets || []).forEach(t => {
      let key: string;
      switch (groupBy) {
        case 'category': key = (t.ticket_categories as any)?.name || 'Uncategorized'; break;
        case 'unit': key = (t.units as any)?.name || 'Unassigned'; break;
        case 'department': key = (t.departments as any)?.name || 'Unassigned'; break;
        case 'technician': key = (t.assignee as any)?.full_name || 'Unassigned'; break;
        case 'priority': key = t.priority || 'Unknown'; break;
        default: key = t.status || 'Unknown';
      }
      counted[key] = (counted[key] || 0) + 1;
    });

    const data = Object.entries(counted).map(([name, value]) => ({ name, value }));
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// ── GET /api/v1/analytics/asset-distribution ────────────────
export const getAssetDistribution = async (req: Request, res: Response) => {
  try {
    const { groupBy = 'status' } = req.query;

    const { data: assets, error } = await supabaseAdmin
      .from('assets')
      .select('status, unit, department, asset_categories(name)');
    if (error) throw error;

    const counted: Record<string, number> = {};
    (assets || []).forEach(a => {
      let key: string;
      switch (groupBy) {
        case 'category': key = (a.asset_categories as any)?.name || 'Uncategorized'; break;
        case 'unit': key = (a as any).unit || 'Unassigned'; break;
        case 'department': key = (a as any).department || 'Unassigned'; break;
        default: key = a.status || 'Unknown';
      }
      counted[key] = (counted[key] || 0) + 1;
    });

    const data = Object.entries(counted).map(([name, value]) => ({ name, value }));
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// ── GET /api/v1/analytics/technician-performance ────────────
export const getTechnicianPerformance = async (req: Request, res: Response) => {
  try {
    const cacheKey = 'analytics:technician-performance';
    const cached = getCache(cacheKey);
    if (cached) return res.json({ status: 'success', data: cached, fromCache: true });

    const { data: tickets, error } = await supabaseAdmin
      .from('tickets')
      .select('assigned_to, status, priority, created_at, resolution_date, assignee:profiles!tickets_assigned_to_fkey(full_name, email_address)')
      .not('assigned_to', 'is', null);
    if (error) throw error;

    const techMap: Record<string, any> = {};
    (tickets || []).forEach(t => {
      const id = t.assigned_to as string;
      if (!id) return;
      if (!techMap[id]) {
        techMap[id] = {
          id,
          name: (t.assignee as any)?.full_name || 'Unknown',
          email: (t.assignee as any)?.email_address || '',
          assigned: 0, resolved: 0, pending: 0, totalResolutionHours: 0, slaCompliant: 0
        };
      }
      techMap[id].assigned++;
      if (['Resolved', 'Closed'].includes(t.status)) {
        techMap[id].resolved++;
        if (t.resolution_date) {
          const hours = (new Date(t.resolution_date).getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60);
          techMap[id].totalResolutionHours += hours;
          if (hours <= 72) techMap[id].slaCompliant++;
        }
      } else {
        techMap[id].pending++;
      }
    });

    const data = Object.values(techMap).map(tech => ({
      ...tech,
      avgResolutionHours: tech.resolved > 0 ? Math.round(tech.totalResolutionHours / tech.resolved * 10) / 10 : 0,
      slaCompliance: tech.resolved > 0 ? Math.round((tech.slaCompliant / tech.resolved) * 100) : 100,
    })).sort((a, b) => b.resolved - a.resolved);

    setCache(cacheKey, data, 300);
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// ── GET /api/v1/analytics/department-stats ──────────────────
export const getDepartmentStats = async (req: Request, res: Response) => {
  try {
    const { data: tickets } = await supabaseAdmin
      .from('tickets')
      .select('department_id, status, created_at, resolution_date, departments(name)');
    const { data: assets } = await supabaseAdmin
      .from('assets')
      .select('status, department');

    const deptMap: Record<string, any> = {};
    (tickets || []).forEach(t => {
      const deptName = (t.departments as any)?.name || 'Unassigned';
      if (!deptMap[deptName]) deptMap[deptName] = { name: deptName, totalTickets: 0, openTickets: 0, resolvedTickets: 0, totalAssets: 0 };
      deptMap[deptName].totalTickets++;
      if (['Open', 'In Progress', 'Assigned'].includes(t.status)) deptMap[deptName].openTickets++;
      if (['Resolved', 'Closed'].includes(t.status)) deptMap[deptName].resolvedTickets++;
    });
    (assets || []).forEach(a => {
      const dept = (a as any).department || 'Unassigned';
      if (!deptMap[dept]) deptMap[dept] = { name: dept, totalTickets: 0, openTickets: 0, resolvedTickets: 0, totalAssets: 0 };
      deptMap[dept].totalAssets++;
    });

    const data = Object.values(deptMap);
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// ── GET /api/v1/analytics/kpis ──────────────────────────────
export const getKpis = async (req: Request, res: Response) => {
  try {
    const cacheKey = 'analytics:kpis';
    const cached = getCache(cacheKey);
    if (cached) return res.json({ status: 'success', data: cached, fromCache: true });

    const { data: tickets } = await supabaseAdmin
      .from('tickets')
      .select('status, priority, created_at, resolution_date, assigned_at, due_date');
    const { data: assets } = await supabaseAdmin.from('assets').select('status');

    const now = Date.now();
    const resolved = (tickets || []).filter(t => ['Resolved', 'Closed'].includes(t.status));
    const totalTickets = tickets?.length || 0;

    // MTTR (Mean Time to Respond — time from created to assigned)
    const responded = (tickets || []).filter(t => t.assigned_at);
    const mttr = responded.length > 0
      ? Math.round(responded.reduce((sum, t) => sum + (new Date(t.assigned_at).getTime() - new Date(t.created_at).getTime()), 0) / responded.length / (1000 * 60 * 60) * 10) / 10
      : 0;

    // MTTR (Mean Time to Resolve)
    const mttResolve = resolved.length > 0
      ? Math.round(resolved.reduce((sum, t) => sum + (new Date(t.resolution_date!).getTime() - new Date(t.created_at).getTime()), 0) / resolved.length / (1000 * 60 * 60) * 10) / 10
      : 0;

    // Closure rate
    const closureRate = totalTickets > 0 ? Math.round((resolved.length / totalTickets) * 100) : 0;

    // Overdue
    const overdue = (tickets || []).filter(t => t.due_date && new Date(t.due_date).getTime() < now && !['Resolved', 'Closed'].includes(t.status));

    // Asset utilization
    const totalAssets = assets?.length || 0;
    const assignedAssets = assets?.filter(a => a.status === 'Assigned').length || 0;
    const assetUtilization = totalAssets > 0 ? Math.round((assignedAssets / totalAssets) * 100) : 0;

    const kpis = {
      mttr,
      mttResolve,
      closureRate,
      overdueCount: overdue.length,
      assetUtilization,
      totalTickets,
      resolvedTickets: resolved.length,
      openTickets: (tickets || []).filter(t => ['Open', 'In Progress', 'Assigned'].includes(t.status)).length,
    };

    setCache(cacheKey, kpis, 300);
    res.json({ status: 'success', data: kpis });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// ── GET /api/v1/analytics/technician-dashboard ───────────────
// Personal metrics for the currently authenticated Technician.
// Scoped entirely to req.user.id — never leaks other technicians' data.
export const getTechnicianDashboard = async (req: Request, res: Response) => {
  try {
    const techId = req.user?.id;
    if (!techId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

    // All assigned tickets for this technician
    const { data: tickets, error } = await supabaseAdmin
      .from('tickets')
      .select('id, status, priority, due_date, created_at, resolution_date, assigned_at, updated_at')
      .eq('assigned_to', techId);

    if (error) throw error;

    const activeStatuses = ['Open', 'Assigned', 'Accepted', 'In Progress', 'Waiting for User', 'Reopened'];

    const summary = {
      totalAssigned: tickets?.length ?? 0,
      unaccepted: tickets?.filter(t => t.status === 'Assigned').length ?? 0,
      inProgress: tickets?.filter(t => t.status === 'In Progress').length ?? 0,
      waitingForUser: tickets?.filter(t => t.status === 'Waiting for User').length ?? 0,
      resolvedToday: tickets?.filter(t =>
        t.status === 'Resolved' &&
        t.resolution_date &&
        t.resolution_date >= todayStart &&
        t.resolution_date < tomorrowStart
      ).length ?? 0,
      closedToday: tickets?.filter(t =>
        t.status === 'Closed' &&
        t.resolution_date &&
        t.resolution_date >= todayStart &&
        t.resolution_date < tomorrowStart
      ).length ?? 0,
      overdue: tickets?.filter(t =>
        activeStatuses.includes(t.status) &&
        t.due_date &&
        new Date(t.due_date) < now
      ).length ?? 0,
      critical: tickets?.filter(t =>
        t.priority === 'Critical' &&
        activeStatuses.includes(t.status)
      ).length ?? 0,
    };

    // Personal performance — all resolved tickets
    const resolved = (tickets ?? []).filter(t => ['Resolved', 'Closed'].includes(t.status) && t.resolution_date);
    const totalResolutionHours = resolved.reduce((sum, t) => {
      const h = (new Date(t.resolution_date!).getTime() - new Date(t.created_at).getTime()) / 3_600_000;
      return sum + h;
    }, 0);

    const slaConfig = [
      { priority: 'Low', resolution_hours: 72 },
      { priority: 'Medium', resolution_hours: 48 },
      { priority: 'High', resolution_hours: 24 },
      { priority: 'Critical', resolution_hours: 4 },
    ];
    const slaMap: Record<string, number> = {};
    slaConfig.forEach(s => { slaMap[s.priority] = s.resolution_hours; });

    const slaCompliant = resolved.filter(t => {
      const maxH = slaMap[t.priority as string] ?? 72;
      const h = (new Date(t.resolution_date!).getTime() - new Date(t.created_at).getTime()) / 3_600_000;
      return h <= maxH;
    });

    // Workload trend — last 30 days, grouped by day
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3_600_000).toISOString();
    const { data: trendTickets } = await supabaseAdmin
      .from('tickets')
      .select('created_at, resolution_date, status, assigned_at')
      .eq('assigned_to', techId)
      .gte('created_at', thirtyDaysAgo);

    const trendMap: Record<string, { assigned: number; resolved: number; pending: number }> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(now.getTime() - (29 - i) * 24 * 3_600_000);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      trendMap[key] = { assigned: 0, resolved: 0, pending: 0 };
    }

    (trendTickets ?? []).forEach(t => {
      const d = new Date(t.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (trendMap[key]) {
        trendMap[key].assigned++;
        if (['Resolved', 'Closed'].includes(t.status)) trendMap[key].resolved++;
        else trendMap[key].pending++;
      }
    });

    const trend = Object.entries(trendMap).map(([period, counts]) => ({
      period: period.slice(5), // MM-DD
      ...counts,
    }));

    const performance = {
      totalAssigned: tickets?.length ?? 0,
      totalResolved: resolved.length,
      avgResolutionHours: resolved.length > 0 ? Math.round(totalResolutionHours / resolved.length * 10) / 10 : 0,
      slaCompliance: resolved.length > 0 ? Math.round((slaCompliant.length / resolved.length) * 100) : 100,
      reopened: tickets?.filter(t => t.status === 'Reopened').length ?? 0,
      closed: tickets?.filter(t => t.status === 'Closed').length ?? 0,
      pendingActive: tickets?.filter(t => activeStatuses.includes(t.status)).length ?? 0,
    };

    res.json({ status: 'success', data: { summary, performance, trend } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};
