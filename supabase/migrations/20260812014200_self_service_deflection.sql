-- Self Service Deflection Schema

-- Update ticket_categories
ALTER TABLE public.ticket_categories 
  ADD COLUMN IF NOT EXISTS self_service_mode text DEFAULT 'Optional',
  ADD COLUMN IF NOT EXISTS guidance_enabled boolean DEFAULT true;

-- Update knowledge_articles to support videos
ALTER TABLE public.knowledge_articles
  ADD COLUMN IF NOT EXISTS self_service_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS troubleshooting_type text,
  ADD COLUMN IF NOT EXISTS estimated_resolution_time integer;

-- Outcome Enum
DO $$ BEGIN
    CREATE TYPE self_service_outcome AS ENUM ('Started', 'Viewed', 'Skipped', 'Solved', 'Not Solved', 'Abandoned', 'Raised Ticket');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Sessions Table
CREATE TABLE IF NOT EXISTS public.self_service_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    unit_id UUID REFERENCES public.units(id),
    department_id UUID REFERENCES public.departments(id),
    category_id UUID REFERENCES public.ticket_categories(id) ON DELETE CASCADE NOT NULL,
    related_asset_id UUID,
    subject TEXT,
    status self_service_outcome NOT NULL DEFAULT 'Started',
    ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

DROP TRIGGER IF EXISTS update_self_service_sessions_modtime ON public.self_service_sessions;
CREATE TRIGGER update_self_service_sessions_modtime BEFORE UPDATE ON public.self_service_sessions FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Interactions Table
CREATE TABLE IF NOT EXISTS public.self_service_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.self_service_sessions(id) ON DELETE CASCADE NOT NULL,
    article_id UUID REFERENCES public.knowledge_articles(id) ON DELETE CASCADE,
    interaction_type TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    feedback_rating INTEGER,
    feedback_comments TEXT
);

-- Link to Tickets
ALTER TABLE public.tickets 
  ADD COLUMN IF NOT EXISTS self_service_session_id UUID REFERENCES public.self_service_sessions(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE public.self_service_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.self_service_interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employees manage own sessions" ON public.self_service_sessions;
CREATE POLICY "Employees manage own sessions" ON public.self_service_sessions FOR ALL TO authenticated 
USING (employee_id IN (SELECT id FROM public.profiles WHERE auth.uid() = id OR auth.uid() = auth_user_id));

DROP POLICY IF EXISTS "Employees manage own interactions" ON public.self_service_interactions;
CREATE POLICY "Employees manage own interactions" ON public.self_service_interactions FOR ALL TO authenticated 
USING (session_id IN (SELECT id FROM public.self_service_sessions WHERE employee_id IN (SELECT id FROM public.profiles WHERE auth.uid() = id OR auth.uid() = auth_user_id)));

DROP POLICY IF EXISTS "Techs and Admins read all sessions" ON public.self_service_sessions;
CREATE POLICY "Techs and Admins read all sessions" ON public.self_service_sessions FOR SELECT TO authenticated USING (public.get_user_role() IN ('Admin', 'Technician'));

DROP POLICY IF EXISTS "Techs and Admins read all interactions" ON public.self_service_interactions;
CREATE POLICY "Techs and Admins read all interactions" ON public.self_service_interactions FOR SELECT TO authenticated USING (public.get_user_role() IN ('Admin', 'Technician'));
