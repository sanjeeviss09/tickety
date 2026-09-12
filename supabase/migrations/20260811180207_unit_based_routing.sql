-- Fix get_user_role to use auth_user_id
CREATE OR REPLACE FUNCTION public.get_user_role() RETURNS text AS $$
  SELECT roles.name FROM public.profiles
  JOIN public.roles ON profiles.role_id = roles.id
  WHERE profiles.auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Fix Tickets relationships to profiles
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_created_by_fkey;
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_assigned_to_fkey;

-- We need to update existing tickets so that created_by and assigned_to are profile IDs, not auth user IDs.
-- For older data where profile.id == auth.users.id, it's already correct.
-- But wait! What if there are tickets created by users where their auth_user_id is in created_by, but their profile.id is DIFFERENT?
-- Let's run a safe update for existing tickets before adding the constraint:
UPDATE public.tickets t
SET created_by = p.id
FROM public.profiles p
WHERE t.created_by = p.auth_user_id AND t.created_by != p.id;

UPDATE public.tickets t
SET assigned_to = p.id
FROM public.profiles p
WHERE t.assigned_to = p.auth_user_id AND t.assigned_to != p.id;

-- Now add the correct constraints
ALTER TABLE public.tickets ADD CONSTRAINT tickets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Same for ticket_comments and ticket_timeline
ALTER TABLE public.ticket_comments DROP CONSTRAINT IF EXISTS ticket_comments_author_id_fkey;
UPDATE public.ticket_comments t SET author_id = p.id FROM public.profiles p WHERE t.author_id = p.auth_user_id AND t.author_id != p.id;
ALTER TABLE public.ticket_comments ADD CONSTRAINT ticket_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.ticket_timeline DROP CONSTRAINT IF EXISTS ticket_timeline_user_id_fkey;
UPDATE public.ticket_timeline t SET user_id = p.id FROM public.profiles p WHERE t.user_id = p.auth_user_id AND t.user_id != p.id;
ALTER TABLE public.ticket_timeline ADD CONSTRAINT ticket_timeline_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Enums
CREATE TYPE assignment_type_enum AS ENUM ('View Only', 'Manual Assignment', 'Automatic Assignment');

-- Technician Unit Assignments (Many-to-Many)
CREATE TABLE public.technician_unit_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    technician_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    unit_id UUID REFERENCES public.units(id) ON DELETE CASCADE NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    assignment_type assignment_type_enum NOT NULL DEFAULT 'Manual Assignment',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (technician_id, unit_id)
);

CREATE TRIGGER update_technician_unit_assignments_modtime BEFORE UPDATE ON public.technician_unit_assignments FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Ticket Routing Rules
CREATE TABLE public.ticket_routing_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID REFERENCES public.units(id) ON DELETE CASCADE NOT NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.ticket_categories(id) ON DELETE CASCADE,
    technician_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    priority INTEGER NOT NULL DEFAULT 0, -- Higher number = higher precedence
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_ticket_routing_rules_modtime BEFORE UPDATE ON public.ticket_routing_rules FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Ticket Assignment History
CREATE TABLE public.ticket_assignment_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL,
    prev_technician_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    new_technician_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reason TEXT,
    is_override BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.technician_unit_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_assignment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage tech unit assignments" ON public.technician_unit_assignments TO authenticated USING (public.get_user_role() = 'Admin');
CREATE POLICY "Users can read tech unit assignments" ON public.technician_unit_assignments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage routing rules" ON public.ticket_routing_rules TO authenticated USING (public.get_user_role() = 'Admin');
CREATE POLICY "Users can read routing rules" ON public.ticket_routing_rules FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can read assignment history" ON public.ticket_assignment_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can insert assignment history" ON public.ticket_assignment_history FOR INSERT TO authenticated WITH CHECK (public.get_user_role() = 'Admin' OR public.get_user_role() = 'Technician');

-- Update Tickets RLS for scoped access
DROP POLICY IF EXISTS "Technicians can read all tickets" ON public.tickets;
CREATE POLICY "Technicians can read unit tickets" ON public.tickets FOR SELECT TO authenticated 
USING (
    public.get_user_role() = 'Technician' AND (
        assigned_to = (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1)
        OR unit_id IN (
            SELECT unit_id FROM public.technician_unit_assignments 
            WHERE technician_id = (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1)
        )
    )
);

-- Note: We also need to make sure Employee can read their own tickets based on profile.id instead of auth.uid()
DROP POLICY IF EXISTS "Employees can read own tickets" ON public.tickets;
CREATE POLICY "Employees can read own tickets" ON public.tickets FOR SELECT TO authenticated 
USING (created_by = (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1));

-- Fix profiles RLS policy so all authenticated users can read profiles without infinite recursion
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;
CREATE POLICY "Authenticated users can read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id OR auth.uid() = auth_user_id);
