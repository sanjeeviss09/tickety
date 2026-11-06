-- 1. business_hours_profiles
CREATE TABLE IF NOT EXISTS public.business_hours_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    work_days JSONB NOT NULL DEFAULT '["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]',
    start_time TIME NOT NULL DEFAULT '09:00:00',
    end_time TIME NOT NULL DEFAULT '17:00:00',
    holidays JSONB NOT NULL DEFAULT '[]',
    exclude_holidays BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. sla_policies
CREATE TABLE IF NOT EXISTS public.sla_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
    category_id UUID REFERENCES public.ticket_categories(id) ON DELETE SET NULL,
    priority ticket_priority, -- Null means all priorities
    first_response_hours NUMERIC NOT NULL,
    resolution_hours NUMERIC NOT NULL,
    warning_threshold_percent NUMERIC NOT NULL DEFAULT 75,
    critical_threshold_percent NUMERIC NOT NULL DEFAULT 90,
    business_hours_id UUID REFERENCES public.business_hours_profiles(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 3. sla_escalation_rules
CREATE TABLE IF NOT EXISTS public.sla_escalation_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    policy_id UUID NOT NULL REFERENCES public.sla_policies(id) ON DELETE CASCADE,
    threshold_percent NUMERIC NOT NULL, -- e.g. 75, 90, 100
    recipient_type TEXT NOT NULL, -- 'Role', 'User', 'Manager'
    recipient_id UUID, -- UUID of Role or User (null if Manager)
    action TEXT NOT NULL DEFAULT 'Notify',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. ticket_escalation_events
CREATE TABLE IF NOT EXISTS public.ticket_escalation_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    policy_id UUID NOT NULL REFERENCES public.sla_policies(id) ON DELETE CASCADE,
    rule_id UUID NOT NULL REFERENCES public.sla_escalation_rules(id) ON DELETE CASCADE,
    threshold_percent NUMERIC NOT NULL,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    action_taken TEXT NOT NULL
);

-- 5. Alter tickets
ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS sla_policy_id UUID REFERENCES public.sla_policies(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS first_response_due_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS resolution_due_at TIMESTAMPTZ;

-- 6. Disable old trigger
DROP TRIGGER IF EXISTS trigger_calculate_ticket_sla ON public.tickets;
-- Don't drop calculate_ticket_sla function just yet, but the trigger is removed so it won't fire.

-- 7. Triggers for updated_at
CREATE TRIGGER update_business_hours_profiles_modtime BEFORE UPDATE ON public.business_hours_profiles FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_sla_policies_modtime BEFORE UPDATE ON public.sla_policies FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- 8. Seed Default Data
INSERT INTO public.business_hours_profiles (name, description, timezone, work_days, start_time, end_time, holidays, exclude_holidays)
VALUES ('Default 24/7', '24/7 support', 'UTC', '["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]', '00:00:00', '23:59:59', '[]', false);

-- 9. Setup RLS
ALTER TABLE public.business_hours_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_escalation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_escalation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read business hours" ON public.business_hours_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage business hours" ON public.business_hours_profiles FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name = 'Admin')
);

CREATE POLICY "Anyone can read sla policies" ON public.sla_policies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage sla policies" ON public.sla_policies FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name = 'Admin')
);

CREATE POLICY "Anyone can read escalation rules" ON public.sla_escalation_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage escalation rules" ON public.sla_escalation_rules FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name = 'Admin')
);

CREATE POLICY "Admins can read escalation events" ON public.ticket_escalation_events FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name = 'Admin')
);
