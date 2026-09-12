-- 1. Update ticket_categories to support Self-Service Guidance
ALTER TABLE public.ticket_categories 
ADD COLUMN IF NOT EXISTS self_service_mode TEXT DEFAULT 'Optional',
ADD COLUMN IF NOT EXISTS guidance_enabled BOOLEAN DEFAULT true;

-- 2. Create Self-Service Sessions Table
CREATE TABLE IF NOT EXISTS public.self_service_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    category_id UUID REFERENCES public.ticket_categories(id) ON DELETE SET NULL,
    related_asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
    subject TEXT,
    status TEXT DEFAULT 'Started', -- 'Started', 'Solved', 'Not Solved', 'Raised Ticket'
    ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create Self-Service Interactions Table
CREATE TABLE IF NOT EXISTS public.self_service_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES public.self_service_sessions(id) ON DELETE CASCADE,
    article_id UUID REFERENCES public.knowledge_articles(id) ON DELETE SET NULL,
    interaction_type TEXT, -- 'VIEW_ARTICLE', 'PLAY_VIDEO'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Alter knowledge_articles to support Self-Service attributes
ALTER TABLE public.knowledge_articles
ADD COLUMN IF NOT EXISTS troubleshooting_type TEXT,
ADD COLUMN IF NOT EXISTS estimated_resolution_time INTEGER,
ADD COLUMN IF NOT EXISTS video_url TEXT,
ADD COLUMN IF NOT EXISTS self_service_enabled BOOLEAN DEFAULT true;

-- 5. Alter tickets to link to self_service_session_id
ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS self_service_session_id UUID REFERENCES public.self_service_sessions(id) ON DELETE SET NULL;

-- 6. Enable RLS
ALTER TABLE public.self_service_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.self_service_interactions ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies
CREATE POLICY "Employees manage own sessions" ON public.self_service_sessions FOR ALL TO authenticated 
USING (employee_id IN (SELECT id FROM public.profiles WHERE auth.uid() = id OR auth.uid() = auth_user_id));

CREATE POLICY "Admins/Techs read all sessions" ON public.self_service_sessions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.auth_user_id = auth.uid() AND r.name IN ('Admin', 'Technician')
  )
);

CREATE POLICY "Employees manage own interactions" ON public.self_service_interactions FOR ALL TO authenticated 
USING (
  session_id IN (
    SELECT id FROM public.self_service_sessions WHERE employee_id IN (
      SELECT id FROM public.profiles WHERE auth.uid() = id OR auth.uid() = auth_user_id
    )
  )
);

CREATE POLICY "Admins/Techs read all interactions" ON public.self_service_interactions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.auth_user_id = auth.uid() AND r.name IN ('Admin', 'Technician')
  )
);
