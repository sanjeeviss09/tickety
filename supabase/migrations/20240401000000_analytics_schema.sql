-- ============================================================
-- Phase 4: Analytics, Reporting & Dashboard Schema
-- Run this in Supabase SQL Editor AFTER Phase 3 migration
-- ============================================================

-- Report Templates (saved custom report configs)
CREATE TABLE public.report_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    report_type TEXT NOT NULL, -- 'ticket_summary', 'technician_performance', 'asset_inventory', etc.
    config JSONB NOT NULL DEFAULT '{}', -- columns, filters, grouping, sorting, chart_type
    is_shared BOOLEAN NOT NULL DEFAULT false,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER update_report_templates_modtime BEFORE UPDATE ON public.report_templates FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE INDEX idx_report_templates_created_by ON public.report_templates(created_by);
CREATE INDEX idx_report_templates_type ON public.report_templates(report_type);

-- Scheduled Reports (automated delivery schedules)
CREATE TABLE public.scheduled_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    template_id UUID REFERENCES public.report_templates(id) ON DELETE CASCADE,
    frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
    day_of_week INTEGER, -- 0=Sunday..6=Saturday (for weekly)
    day_of_month INTEGER, -- 1-31 (for monthly/quarterly/yearly)
    time_of_day TIME NOT NULL DEFAULT '08:00:00',
    recipients JSONB NOT NULL DEFAULT '[]', -- array of email addresses
    export_format TEXT NOT NULL DEFAULT 'xlsx' CHECK (export_format IN ('xlsx', 'pdf', 'csv')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER update_scheduled_reports_modtime BEFORE UPDATE ON public.scheduled_reports FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE INDEX idx_scheduled_reports_active ON public.scheduled_reports(is_active);
CREATE INDEX idx_scheduled_reports_next_run ON public.scheduled_reports(next_run_at);

-- Report Exports (job log for generated file downloads)
CREATE TABLE public.report_exports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID REFERENCES public.report_templates(id) ON DELETE SET NULL,
    report_type TEXT NOT NULL,
    export_format TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    file_url TEXT,
    file_size_bytes INTEGER,
    filters JSONB DEFAULT '{}',
    error_message TEXT,
    requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_report_exports_requested_by ON public.report_exports(requested_by);
CREATE INDEX idx_report_exports_status ON public.report_exports(status);
CREATE INDEX idx_report_exports_created_at ON public.report_exports(created_at DESC);

-- Dashboard Preferences (per-user widget config)
CREATE TABLE public.dashboard_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    widget_config JSONB NOT NULL DEFAULT '[]', -- [{id, visible, order}]
    layout TEXT NOT NULL DEFAULT 'default',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER update_dashboard_preferences_modtime BEFORE UPDATE ON public.dashboard_preferences FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE INDEX idx_dashboard_preferences_user ON public.dashboard_preferences(user_id);

-- Analytics Cache (optional shared cache for expensive queries)
CREATE TABLE public.analytics_cache (
    cache_key TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_analytics_cache_expires ON public.analytics_cache(expires_at);

-- Report Execution Logs (audit trail)
CREATE TABLE public.report_execution_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_type TEXT NOT NULL,
    template_id UUID REFERENCES public.report_templates(id) ON DELETE SET NULL,
    filters JSONB DEFAULT '{}',
    execution_time_ms INTEGER,
    row_count INTEGER,
    export_format TEXT,
    executed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_execution_logs_executed_by ON public.report_execution_logs(executed_by);
CREATE INDEX idx_execution_logs_created_at ON public.report_execution_logs(created_at DESC);
CREATE INDEX idx_execution_logs_report_type ON public.report_execution_logs(report_type);

-- ============================================================
-- Row Level Security Policies
-- ============================================================

ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_execution_logs ENABLE ROW LEVEL SECURITY;

-- report_templates: admin can do anything; others can read shared ones
CREATE POLICY "Admin full access on report_templates" ON public.report_templates
    FOR ALL USING (public.get_user_role() = 'Admin');
CREATE POLICY "Read shared report_templates" ON public.report_templates
    FOR SELECT USING (is_shared = true OR created_by = auth.uid());

-- scheduled_reports: admin-only
CREATE POLICY "Admin full access on scheduled_reports" ON public.scheduled_reports
    FOR ALL USING (public.get_user_role() = 'Admin');

-- report_exports: users see only their own; admin sees all
CREATE POLICY "Admin sees all report_exports" ON public.report_exports
    FOR ALL USING (public.get_user_role() = 'Admin');
CREATE POLICY "User sees own report_exports" ON public.report_exports
    FOR SELECT USING (requested_by = auth.uid());
CREATE POLICY "User can create report_exports" ON public.report_exports
    FOR INSERT WITH CHECK (requested_by = auth.uid());

-- dashboard_preferences: each user manages their own row
CREATE POLICY "User manages own dashboard_preferences" ON public.dashboard_preferences
    FOR ALL USING (user_id = auth.uid());

-- analytics_cache: service role only (no direct user access needed)
CREATE POLICY "No direct user access to analytics_cache" ON public.analytics_cache
    FOR ALL USING (false);

-- report_execution_logs: admin sees all; user sees own
CREATE POLICY "Admin sees all execution_logs" ON public.report_execution_logs
    FOR ALL USING (public.get_user_role() = 'Admin');
CREATE POLICY "User sees own execution_logs" ON public.report_execution_logs
    FOR SELECT USING (executed_by = auth.uid());
CREATE POLICY "Authenticated can insert execution_logs" ON public.report_execution_logs
    FOR INSERT WITH CHECK (executed_by = auth.uid());
