-- =============================================================================
-- Migration: Self-Service Deflection Enhancements
-- Description: Adds configuration fields to ticket_categories and creates the 
--              ticket_self_service_events table for tracking outcomes.
-- =============================================================================

-- 1. Alter ticket_categories
ALTER TABLE public.ticket_categories
  ADD COLUMN IF NOT EXISTS self_service_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS technician_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS self_service_title TEXT,
  ADD COLUMN IF NOT EXISTS self_service_description TEXT,
  ADD COLUMN IF NOT EXISTS troubleshooting_steps TEXT,
  ADD COLUMN IF NOT EXISTS knowledge_article_id UUID REFERENCES public.knowledge_articles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS allow_skip BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS skip_label TEXT DEFAULT 'I Don''t Have Time / Raise Ticket',
  ADD COLUMN IF NOT EXISTS default_priority TEXT DEFAULT 'Low',
  ADD COLUMN IF NOT EXISTS default_sla INTEGER,
  ADD COLUMN IF NOT EXISTS related_asset_required BOOLEAN NOT NULL DEFAULT false;

-- 2. Create ticket_self_service_events table
CREATE TABLE IF NOT EXISTS public.ticket_self_service_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.ticket_categories(id) ON DELETE SET NULL,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  guidance_shown JSONB,
  outcome TEXT NOT NULL CHECK (outcome IN ('solved', 'escalated', 'skipped', 'abandoned')),
  skip_reason TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Link to tickets
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS self_service_event_id UUID REFERENCES public.ticket_self_service_events(id) ON DELETE SET NULL;

-- 4. RLS for ticket_self_service_events
ALTER TABLE public.ticket_self_service_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees insert own self service events"
ON public.ticket_self_service_events FOR INSERT TO authenticated
WITH CHECK (employee_id = (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1));

CREATE POLICY "Employees update own self service events"
ON public.ticket_self_service_events FOR UPDATE TO authenticated
USING (employee_id = (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1));

CREATE POLICY "Employees read own self service events"
ON public.ticket_self_service_events FOR SELECT TO authenticated
USING (employee_id = (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1));

CREATE POLICY "Admin_Tech read all self service events"
ON public.ticket_self_service_events FOR SELECT TO authenticated
USING (public.get_user_role() IN ('Admin', 'Technician'));

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_self_service_events_employee ON public.ticket_self_service_events(employee_id);
CREATE INDEX IF NOT EXISTS idx_self_service_events_ticket ON public.ticket_self_service_events(ticket_id);
CREATE INDEX IF NOT EXISTS idx_self_service_events_category ON public.ticket_self_service_events(category_id);
CREATE INDEX IF NOT EXISTS idx_self_service_events_outcome ON public.ticket_self_service_events(outcome);
