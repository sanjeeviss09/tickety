-- Enums for Status and Priority
CREATE TYPE ticket_priority AS ENUM ('Low', 'Medium', 'High', 'Critical');
CREATE TYPE ticket_status AS ENUM ('Open', 'Assigned', 'Accepted', 'In Progress', 'Waiting for User', 'Resolved', 'Closed', 'Cancelled', 'Reopened');

-- Ticket Categories Table
CREATE TABLE public.ticket_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER update_ticket_categories_modtime BEFORE UPDATE ON public.ticket_categories FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- SLA Configurations Table
CREATE TABLE public.sla_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    priority ticket_priority NOT NULL UNIQUE,
    resolution_hours INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER update_sla_configurations_modtime BEFORE UPDATE ON public.sla_configurations FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Tickets Table
CREATE TABLE public.tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_number TEXT UNIQUE,
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    category_id UUID REFERENCES public.ticket_categories(id),
    priority ticket_priority NOT NULL DEFAULT 'Low',
    status ticket_status NOT NULL DEFAULT 'Open',
    department_id UUID REFERENCES public.departments(id),
    unit_id UUID REFERENCES public.units(id),
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    assigned_to UUID REFERENCES auth.users(id),
    assigned_at TIMESTAMPTZ,
    due_date TIMESTAMPTZ,
    resolution_date TIMESTAMPTZ,
    contact_number TEXT,
    preferred_contact TEXT,
    cc_emails TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER update_tickets_modtime BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Ticket Number Generation Function (Yearly reset format: DSP-YYYY-000001)
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
DECLARE
    current_year text;
    seq_val bigint;
BEGIN
    current_year := to_char(CURRENT_DATE, 'YYYY');
    
    -- Find max sequence for current year. We use a lock on a dummy row or just rely on max to be safe enough for moderate volume.
    -- For enterprise, a sequence table is better, but this works well for standard volume.
    SELECT COALESCE(MAX(NULLIF(regexp_replace(ticket_number, '^DSP-' || current_year || '-', ''), ticket_number)::integer), 0) + 1
    INTO seq_val
    FROM public.tickets
    WHERE ticket_number LIKE 'DSP-' || current_year || '-%';
    
    NEW.ticket_number := 'DSP-' || current_year || '-' || lpad(seq_val::text, 6, '0');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_ticket_number
BEFORE INSERT ON public.tickets
FOR EACH ROW
WHEN (NEW.ticket_number IS NULL)
EXECUTE PROCEDURE generate_ticket_number();

-- SLA Auto-Calculation Trigger
CREATE OR REPLACE FUNCTION calculate_ticket_sla()
RETURNS TRIGGER AS $$
DECLARE
    sla_hours int;
BEGIN
    -- Only calculate on insert or when priority changes
    IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND OLD.priority IS DISTINCT FROM NEW.priority) THEN
        SELECT resolution_hours INTO sla_hours FROM public.sla_configurations WHERE priority = NEW.priority;
        IF sla_hours IS NOT NULL THEN
            -- 24/7 SLA counting
            NEW.due_date := (NEW.created_at + (sla_hours || ' hours')::interval);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_ticket_sla
BEFORE INSERT OR UPDATE ON public.tickets
FOR EACH ROW
EXECUTE PROCEDURE calculate_ticket_sla();

-- Ticket Comments Table
CREATE TABLE public.ticket_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL,
    author_id UUID REFERENCES auth.users(id) NOT NULL,
    content TEXT NOT NULL,
    is_internal BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER update_ticket_comments_modtime BEFORE UPDATE ON public.ticket_comments FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Ticket Attachments Table (Metadata only, files in Storage)
CREATE TABLE public.ticket_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES public.ticket_comments(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_type TEXT NOT NULL,
    storage_path TEXT NOT NULL UNIQUE,
    uploaded_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ticket Timeline (History) Table
CREATE TABLE public.ticket_timeline (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    action_type TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications Table
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed Default Categories
INSERT INTO public.ticket_categories (name, description) VALUES
    ('Hardware', 'Issues with physical devices like laptops, monitors, etc.'),
    ('Software', 'Issues with applications or operating systems.'),
    ('Network', 'Internet or local network connectivity issues.'),
    ('Email', 'Issues with corporate email.'),
    ('ERP', 'Enterprise Resource Planning system issues.'),
    ('Printer', 'Printer or scanner related issues.'),
    ('Security', 'Security incidents or concerns.'),
    ('Access Request', 'Requests for access to systems or facilities.'),
    ('Infrastructure', 'Server or core infrastructure issues.'),
    ('General Support', 'General help and inquiries.'),
    ('Other', 'Miscellaneous issues not fitting other categories.');

-- Seed Default SLAs
INSERT INTO public.sla_configurations (priority, resolution_hours) VALUES
    ('Low', 72),
    ('Medium', 48),
    ('High', 24),
    ('Critical', 4);

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE public.ticket_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Helper function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role() RETURNS text AS $$
  SELECT roles.name FROM public.profiles
  JOIN public.roles ON profiles.role_id = roles.id
  WHERE profiles.id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- RLS: Ticket Categories & SLA (Read-only for all, write for Admin handled by backend)
CREATE POLICY "Anyone can read categories" ON public.ticket_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can read SLA configs" ON public.sla_configurations FOR SELECT TO authenticated USING (true);

-- RLS: Tickets
-- Admin: All
CREATE POLICY "Admin can read all tickets" ON public.tickets FOR SELECT TO authenticated USING (public.get_user_role() = 'Admin');
-- Technician: Assigned to them or unassigned/open (for claiming). We'll let them read all for now, but restrict updates.
CREATE POLICY "Technicians can read all tickets" ON public.tickets FOR SELECT TO authenticated USING (public.get_user_role() = 'Technician');
-- Employee: Only their own tickets
CREATE POLICY "Employees can read own tickets" ON public.tickets FOR SELECT TO authenticated USING (auth.uid() = created_by);

-- Note: In Phase 1, most mutations were routed through the Express backend using service_role to avoid complex RLS logic and handle validation/emails securely. 
-- The backend will validate permissions before updating tickets, comments, etc.
-- We will allow SELECT through RLS for realtime subscriptions, but mutations (INSERT/UPDATE/DELETE) will be restricted mostly to the backend service role.

-- RLS: Comments
CREATE POLICY "Admin/Tech can read all comments" ON public.ticket_comments FOR SELECT TO authenticated USING (public.get_user_role() IN ('Admin', 'Technician'));
CREATE POLICY "Employees can read public comments on own tickets" ON public.ticket_comments FOR SELECT TO authenticated 
USING (public.get_user_role() = 'Employee' AND is_internal = false AND ticket_id IN (SELECT id FROM public.tickets WHERE created_by = auth.uid()));

-- RLS: Attachments
CREATE POLICY "Users can read attachments for tickets they can see" ON public.ticket_attachments FOR SELECT TO authenticated
USING (
    public.get_user_role() IN ('Admin', 'Technician') 
    OR 
    (public.get_user_role() = 'Employee' AND ticket_id IN (SELECT id FROM public.tickets WHERE created_by = auth.uid()))
);

-- RLS: Timeline
CREATE POLICY "Users can read timeline for tickets they can see" ON public.ticket_timeline FOR SELECT TO authenticated
USING (
    public.get_user_role() IN ('Admin', 'Technician') 
    OR 
    (public.get_user_role() = 'Employee' AND ticket_id IN (SELECT id FROM public.tickets WHERE created_by = auth.uid()))
);

-- RLS: Notifications
CREATE POLICY "Users can read own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
-- Users can dismiss their own notifications via direct RLS update (optional, but convenient for UI)
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Storage Bucket for Attachments
-- (Must be executed as superuser/postgres role)
INSERT INTO storage.buckets (id, name, public) VALUES ('ticket_attachments', 'ticket_attachments', false) ON CONFLICT DO NOTHING;

-- Storage RLS
CREATE POLICY "Authenticated users can upload attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ticket_attachments');
CREATE POLICY "Users can view attachments" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'ticket_attachments');
