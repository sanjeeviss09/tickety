import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { z } from 'zod';

// ── GET /api/v1/reports/ticket-summary ──────────────────────
export const getTicketSummaryReport = async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo, status, priority, unit_id, department_id, category_id, assigned_to } = req.query;

    let query = supabaseAdmin
      .from('tickets')
      .select(`
        *,
        ticket_categories(name),
        units(name),
        departments(name),
        creator:profiles!tickets_created_by_fkey(full_name, email_address, employee_id),
        assignee:profiles!tickets_assigned_to_fkey(full_name, email_address)
      `)
      .order('created_at', { ascending: false });

    if (dateFrom) query = query.gte('created_at', dateFrom as string);
    if (dateTo) query = query.lte('created_at', dateTo as string);
    if (status) query = query.eq('status', status as string);
    if (priority) query = query.eq('priority', priority as string);
    if (unit_id) query = query.eq('unit_id', unit_id as string);
    if (department_id) query = query.eq('department_id', department_id as string);
    if (category_id) query = query.eq('category_id', category_id as string);
    if (assigned_to) query = query.eq('assigned_to', assigned_to as string);

    const { data, error, count } = await query;
    if (error) throw error;

    // Log execution
    await supabaseAdmin.from('report_execution_logs').insert([{
      report_type: 'ticket_summary',
      filters: req.query,
      row_count: data?.length || 0,
      executed_by: (req as any).user?.id
    }]);

    res.json({ status: 'success', data, count });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// ── GET /api/v1/reports/technician-performance ──────────────
export const getTechnicianReport = async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo, technician_id } = req.query;

    let query = supabaseAdmin
      .from('tickets')
      .select(`
        id, status, priority, created_at, resolution_date, assigned_at,
        assignee:profiles!tickets_assigned_to_fkey(id, full_name, email_address)
      `)
      .not('assigned_to', 'is', null);

    if (dateFrom) query = query.gte('created_at', dateFrom as string);
    if (dateTo) query = query.lte('created_at', dateTo as string);
    if (technician_id) query = query.eq('assigned_to', technician_id as string);

    const { data, error } = await query;
    if (error) throw error;

    // Aggregate by technician
    const techMap: Record<string, any> = {};
    (data || []).forEach(t => {
      const tech = t.assignee as any;
      if (!tech) return;
      if (!techMap[tech.id]) {
        techMap[tech.id] = { id: tech.id, name: tech.full_name, email: tech.email_address, assigned: 0, resolved: 0, pending: 0, resolutionHours: [], slaCompliant: 0 };
      }
      techMap[tech.id].assigned++;
      if (['Resolved', 'Closed'].includes(t.status)) {
        techMap[tech.id].resolved++;
        if (t.resolution_date) {
          const h = (new Date(t.resolution_date).getTime() - new Date(t.created_at).getTime()) / 3600000;
          techMap[tech.id].resolutionHours.push(h);
          if (h <= 72) techMap[tech.id].slaCompliant++;
        }
      } else {
        techMap[tech.id].pending++;
      }
    });

    const result = Object.values(techMap).map((tech: any) => ({
      id: tech.id, name: tech.name, email: tech.email,
      assigned: tech.assigned, resolved: tech.resolved, pending: tech.pending,
      avgResolutionHours: tech.resolutionHours.length > 0 ? Math.round(tech.resolutionHours.reduce((a: number, b: number) => a + b, 0) / tech.resolutionHours.length * 10) / 10 : 0,
      slaCompliance: tech.resolved > 0 ? Math.round((tech.slaCompliant / tech.resolved) * 100) : 100,
    })).sort((a, b) => b.resolved - a.resolved);

    res.json({ status: 'success', data: result });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// ── GET /api/v1/reports/asset-inventory ─────────────────────
export const getAssetInventoryReport = async (req: Request, res: Response) => {
  try {
    const { status, category_id, unit, department } = req.query;

    let query = supabaseAdmin
      .from('assets')
      .select(`
        *,
        category:asset_categories(name),
        warranty:asset_warranty(warranty_end_date, amc_end_date, provider),
        assignments:asset_assignments(assigned_to, status, profiles(full_name))
      `)
      .order('asset_code');

    if (status) query = query.eq('status', status as string);
    if (category_id) query = query.eq('category_id', category_id as string);
    if (unit) query = query.eq('unit', unit as string);
    if (department) query = query.eq('department', department as string);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// ── GET /api/v1/reports/sla-compliance ──────────────────────
export const getSlaComplianceReport = async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo, priority, unit_id } = req.query;
    const { data: slaConfig } = await supabaseAdmin.from('sla_configurations').select('*');

    let query = supabaseAdmin
      .from('tickets')
      .select(`
        id, ticket_number, subject, priority, status, created_at, resolution_date, due_date,
        units(name), departments(name),
        creator:profiles!tickets_created_by_fkey(full_name),
        assignee:profiles!tickets_assigned_to_fkey(full_name)
      `);

    if (dateFrom) query = query.gte('created_at', dateFrom as string);
    if (dateTo) query = query.lte('created_at', dateTo as string);
    if (priority) query = query.eq('priority', priority as string);
    if (unit_id) query = query.eq('unit_id', unit_id as string);

    const { data, error } = await query;
    if (error) throw error;

    const slaMap: Record<string, number> = {};
    (slaConfig || []).forEach(s => { slaMap[s.priority] = s.resolution_hours; });

    const result = (data || []).map(t => {
      const maxHours = slaMap[t.priority] || 72;
      const isResolved = ['Resolved', 'Closed'].includes(t.status);
      let resolutionHours: number | null = null;
      let slaStatus: string;
      const now = new Date();

      if (isResolved && t.resolution_date) {
        resolutionHours = (new Date(t.resolution_date).getTime() - new Date(t.created_at).getTime()) / 3600000;
        slaStatus = resolutionHours <= maxHours ? 'Compliant' : 'Breached';
      } else if (t.due_date && new Date(t.due_date) < now) {
        slaStatus = 'Overdue';
      } else {
        slaStatus = 'On Track';
      }

      return { ...t, slaMaxHours: maxHours, resolutionHours, slaStatus };
    });

    res.json({ status: 'success', data: result });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// ── GET /api/v1/reports/warranty ────────────────────────────
export const getWarrantyReport = async (req: Request, res: Response) => {
  try {
    const { status, unit } = req.query;
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 86400000);
    const ninetyDays = new Date(now.getTime() + 90 * 86400000);

    let query = supabaseAdmin
      .from('asset_warranty')
      .select(`
        *,
        asset:assets(asset_code, name, unit, department, status)
      `)
      .order('warranty_end_date');

    const { data, error } = await query;
    if (error) throw error;

    const enriched = (data || []).map((w: any) => {
      const wEnd = w.warranty_end_date ? new Date(w.warranty_end_date) : null;
      const aEnd = w.amc_end_date ? new Date(w.amc_end_date) : null;

      let warrantyStatus = 'Valid';
      if (!wEnd) warrantyStatus = 'No Warranty';
      else if (wEnd < now) warrantyStatus = 'Expired';
      else if (wEnd < thirtyDays) warrantyStatus = 'Expiring Soon';
      else if (wEnd < ninetyDays) warrantyStatus = 'Expiring (90 days)';

      let amcStatus = 'No AMC';
      if (aEnd) {
        if (aEnd < now) amcStatus = 'Expired';
        else if (aEnd < thirtyDays) amcStatus = 'Expiring Soon';
        else amcStatus = 'Valid';
      }

      return { ...w, warrantyStatus, amcStatus };
    });

    let filtered = enriched;
    if (status) filtered = enriched.filter(w => w.warrantyStatus === status || w.amcStatus === status);
    if (unit) filtered = filtered.filter(w => w.asset?.unit === unit);

    res.json({ status: 'success', data: filtered });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// ── GET /api/v1/reports/templates ───────────────────────────
export const getTemplates = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { data, error } = await supabaseAdmin
      .from('report_templates')
      .select('*')
      .or(`created_by.eq.${userId},is_shared.eq.true`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// ── POST /api/v1/reports/templates ──────────────────────────
const templateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  report_type: z.string(),
  config: z.record(z.any()).default({}),
  is_shared: z.boolean().default(false),
});

export const createTemplate = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const validated = templateSchema.parse(req.body);
    const { data, error } = await supabaseAdmin
      .from('report_templates')
      .insert([{ ...validated, created_by: userId }])
      .select().single();
    if (error) throw error;
    res.status(201).json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// ── GET /api/v1/reports/scheduled ────────────────────────────
export const getScheduledReports = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('scheduled_reports')
      .select('*, template:report_templates(name, report_type)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// ── POST /api/v1/reports/scheduled ───────────────────────────
const scheduledSchema = z.object({
  name: z.string().min(1),
  template_id: z.string().uuid().optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']),
  day_of_week: z.number().min(0).max(6).optional(),
  day_of_month: z.number().min(1).max(31).optional(),
  time_of_day: z.string().default('08:00:00'),
  recipients: z.array(z.string().email()),
  export_format: z.enum(['xlsx', 'pdf', 'csv']).default('xlsx'),
  is_active: z.boolean().default(true),
});

export const createScheduledReport = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const validated = scheduledSchema.parse(req.body);
    const { data, error } = await supabaseAdmin
      .from('scheduled_reports')
      .insert([{ ...validated, created_by: userId }])
      .select().single();
    if (error) throw error;
    res.status(201).json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const updateScheduledReport = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('scheduled_reports').update(req.body).eq('id', id).select().single();
    if (error) throw error;
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const deleteScheduledReport = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from('scheduled_reports').delete().eq('id', id);
    if (error) throw error;
    res.json({ status: 'success', message: 'Deleted' });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// ── GET /api/v1/preferences/dashboard ────────────────────────
export const getDashboardPreferences = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { data } = await supabaseAdmin.from('dashboard_preferences').select('*').eq('user_id', userId).single();
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const saveDashboardPreferences = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { widget_config, layout } = req.body;
    const { data, error } = await supabaseAdmin
      .from('dashboard_preferences')
      .upsert({ user_id: userId, widget_config, layout }, { onConflict: 'user_id' })
      .select().single();
    if (error) throw error;
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};
