-- =============================================================================
-- Migration: Assigner Role
-- Description: Adds Assigner role, technician pools, category skills,
--              assignment SLA, technician availability, and extends
--              ticket_assignment_history. Modifies routing engine to support
--              manual assignment mode.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Insert Assigner role
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.roles (name, description)
VALUES ('Assigner', 'Operational role for reviewing and assigning tickets to technicians within authorized units')
ON CONFLICT (name) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. assigner_unit_assignments (Many-to-Many: Assigner ↔ Units)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.assigner_unit_assignments (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assigner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    unit_id     UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    is_primary  BOOLEAN NOT NULL DEFAULT true,
    is_backup   BOOLEAN NOT NULL DEFAULT false,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (assigner_id, unit_id)
);

CREATE TRIGGER update_assigner_unit_assignments_modtime
BEFORE UPDATE ON public.assigner_unit_assignments
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. technician_category_skills (Many-to-Many: Technician ↔ Categories)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.technician_category_skills (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    technician_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    category_id    UUID NOT NULL REFERENCES public.ticket_categories(id) ON DELETE CASCADE,
    proficiency    TEXT NOT NULL DEFAULT 'Intermediate'
                   CHECK (proficiency IN ('Beginner', 'Intermediate', 'Expert')),
    is_active      BOOLEAN NOT NULL DEFAULT true,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (technician_id, category_id)
);

CREATE TRIGGER update_technician_category_skills_modtime
BEFORE UPDATE ON public.technician_category_skills
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. technician_pools (Unit + Category → pool of eligible technicians)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.technician_pools (
    id                              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                            TEXT NOT NULL,
    unit_id                         UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    category_id                     UUID REFERENCES public.ticket_categories(id) ON DELETE SET NULL,
    primary_assigner_id             UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    backup_assigner_id              UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    auto_assignment_enabled         BOOLEAN NOT NULL DEFAULT false,
    assignment_strategy             TEXT NOT NULL DEFAULT 'lowest_workload'
                                    CHECK (assignment_strategy IN ('lowest_workload', 'round_robin', 'skill_workload', 'manual')),
    max_workload_per_technician     INTEGER,          -- null = unlimited
    skill_match_required            BOOLEAN NOT NULL DEFAULT true,
    unit_match_required             BOOLEAN NOT NULL DEFAULT true,
    availability_check_enabled      BOOLEAN NOT NULL DEFAULT true,
    allow_assign_busy               BOOLEAN NOT NULL DEFAULT false,
    allow_assign_at_capacity        BOOLEAN NOT NULL DEFAULT false,
    allow_reassign_in_progress      BOOLEAN NOT NULL DEFAULT true,
    require_reassignment_reason     BOOLEAN NOT NULL DEFAULT true,
    is_active                       BOOLEAN NOT NULL DEFAULT true,
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_technician_pools_modtime
BEFORE UPDATE ON public.technician_pools
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Junction table: which technicians belong to which pool
CREATE TABLE IF NOT EXISTS public.technician_pool_members (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pool_id        UUID NOT NULL REFERENCES public.technician_pools(id) ON DELETE CASCADE,
    technician_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_active      BOOLEAN NOT NULL DEFAULT true,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (pool_id, technician_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. assignment_sla_configs (separate from resolution SLA)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.assignment_sla_configs (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id          UUID REFERENCES public.units(id) ON DELETE CASCADE,
    category_id      UUID REFERENCES public.ticket_categories(id) ON DELETE CASCADE,
    priority         ticket_priority,        -- NULL = applies to all priorities
    target_minutes   INTEGER NOT NULL,
    warning_percent  INTEGER NOT NULL DEFAULT 75,
    critical_percent INTEGER NOT NULL DEFAULT 90,
    is_active        BOOLEAN NOT NULL DEFAULT true,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_assignment_sla_configs_modtime
BEFORE UPDATE ON public.assignment_sla_configs
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Default assignment SLA thresholds (configurable, not hard-coded)
INSERT INTO public.assignment_sla_configs (priority, target_minutes, unit_id, category_id)
VALUES
    ('Critical', 10,  NULL, NULL),
    ('High',     30,  NULL, NULL),
    ('Medium',   120, NULL, NULL),
    ('Low',      240, NULL, NULL)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. technician_availability
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.technician_availability (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    technician_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status         TEXT NOT NULL DEFAULT 'Available'
                   CHECK (status IN ('Available', 'Busy', 'At Capacity', 'On Leave', 'Offline', 'Temporarily Unavailable')),
    reason         TEXT,
    starts_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    ends_at        TIMESTAMPTZ,    -- NULL = indefinite
    set_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_active      BOOLEAN NOT NULL DEFAULT true,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_technician_availability_modtime
BEFORE UPDATE ON public.technician_availability
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Extend ticket_assignment_history with Assigner metadata
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.ticket_assignment_history
    ADD COLUMN IF NOT EXISTS assignment_type     TEXT NOT NULL DEFAULT 'initial'
        CHECK (assignment_type IN ('initial', 'manual', 'auto', 'reassignment', 'escalation', 'system')),
    ADD COLUMN IF NOT EXISTS assigner_id         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS routing_rule_id     UUID REFERENCES public.ticket_routing_rules(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS unit_context        UUID REFERENCES public.units(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS category_context    UUID REFERENCES public.ticket_categories(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS priority_context    ticket_priority,
    ADD COLUMN IF NOT EXISTS notes               TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Extend tickets with assignment SLA tracking
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.tickets
    ADD COLUMN IF NOT EXISTS assignment_due_at         TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS assignment_notified_at    TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS assignment_sla_state      TEXT NOT NULL DEFAULT 'On Track'
        CHECK (assignment_sla_state IN ('On Track', 'Approaching', 'At Risk', 'Breached')),
    ADD COLUMN IF NOT EXISTS eligible_technician_pool  JSONB,
    ADD COLUMN IF NOT EXISTS routing_result            JSONB;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. assignment_sla_events (idempotency — prevent duplicate notifications)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.assignment_sla_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id       UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    threshold_type  TEXT NOT NULL CHECK (threshold_type IN ('approaching', 'at_risk', 'breached')),
    notified_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    recipient_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (ticket_id, threshold_type)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Helper function: get current Assigner's authorized unit IDs
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_assigner_unit_ids()
RETURNS UUID[] AS $$
    SELECT ARRAY(
        SELECT unit_id
        FROM public.assigner_unit_assignments aua
        JOIN public.profiles p ON p.id = aua.assigner_id
        WHERE p.auth_user_id = auth.uid()
          AND aua.is_active = true
    );
$$ LANGUAGE sql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. Enable RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.assigner_unit_assignments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technician_category_skills     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technician_pools               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technician_pool_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_sla_configs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technician_availability        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_sla_events          ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. RLS Policies
-- ─────────────────────────────────────────────────────────────────────────────

-- assigner_unit_assignments
CREATE POLICY "Admin can manage assigner units"
ON public.assigner_unit_assignments TO authenticated
USING (public.get_user_role() = 'Admin');

CREATE POLICY "Assigners can read own unit assignments"
ON public.assigner_unit_assignments FOR SELECT TO authenticated
USING (
    public.get_user_role() IN ('Admin', 'Assigner', 'Technician')
);

-- technician_category_skills
CREATE POLICY "Admin can manage category skills"
ON public.technician_category_skills TO authenticated
USING (public.get_user_role() = 'Admin');

CREATE POLICY "Assigner Technician can read category skills"
ON public.technician_category_skills FOR SELECT TO authenticated
USING (public.get_user_role() IN ('Admin', 'Assigner', 'Technician'));

-- technician_pools
CREATE POLICY "Admin can manage technician pools"
ON public.technician_pools TO authenticated
USING (public.get_user_role() = 'Admin');

CREATE POLICY "Assigner can read pools for authorized units"
ON public.technician_pools FOR SELECT TO authenticated
USING (
    public.get_user_role() IN ('Admin', 'Assigner', 'Technician')
    AND (
        public.get_user_role() = 'Admin'
        OR unit_id = ANY(public.get_assigner_unit_ids())
    )
);

-- technician_pool_members
CREATE POLICY "Admin can manage pool members"
ON public.technician_pool_members TO authenticated
USING (public.get_user_role() = 'Admin');

CREATE POLICY "Assigner Technician can read pool members"
ON public.technician_pool_members FOR SELECT TO authenticated
USING (public.get_user_role() IN ('Admin', 'Assigner', 'Technician'));

-- assignment_sla_configs
CREATE POLICY "Admin can manage assignment SLA configs"
ON public.assignment_sla_configs TO authenticated
USING (public.get_user_role() = 'Admin');

CREATE POLICY "Anyone can read assignment SLA configs"
ON public.assignment_sla_configs FOR SELECT TO authenticated
USING (true);

-- technician_availability
CREATE POLICY "Admin Assigner can manage availability"
ON public.technician_availability TO authenticated
USING (public.get_user_role() IN ('Admin', 'Assigner'));

CREATE POLICY "Technician can read own availability"
ON public.technician_availability FOR SELECT TO authenticated
USING (
    public.get_user_role() IN ('Admin', 'Assigner')
    OR technician_id = (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1)
);

-- assignment_sla_events
CREATE POLICY "Admin Assigner can read assignment SLA events"
ON public.assignment_sla_events FOR SELECT TO authenticated
USING (public.get_user_role() IN ('Admin', 'Assigner'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. Update tickets RLS for Assigner role
-- ─────────────────────────────────────────────────────────────────────────────
-- Assigner can read tickets in their authorized units
CREATE POLICY "Assigners can read unit tickets"
ON public.tickets FOR SELECT TO authenticated
USING (
    public.get_user_role() = 'Assigner'
    AND unit_id = ANY(public.get_assigner_unit_ids())
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. Update ticket_assignment_history RLS for Assigner
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin can insert assignment history" ON public.ticket_assignment_history;
CREATE POLICY "Admin Assigner Technician can insert assignment history"
ON public.ticket_assignment_history FOR INSERT TO authenticated
WITH CHECK (public.get_user_role() IN ('Admin', 'Assigner', 'Technician'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 15. Performance indexes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_assigner_unit_assignments_assigner
    ON public.assigner_unit_assignments(assigner_id);
CREATE INDEX IF NOT EXISTS idx_assigner_unit_assignments_unit
    ON public.assigner_unit_assignments(unit_id);
CREATE INDEX IF NOT EXISTS idx_tech_category_skills_tech
    ON public.technician_category_skills(technician_id);
CREATE INDEX IF NOT EXISTS idx_tech_category_skills_cat
    ON public.technician_category_skills(category_id);
CREATE INDEX IF NOT EXISTS idx_technician_pools_unit
    ON public.technician_pools(unit_id);
CREATE INDEX IF NOT EXISTS idx_technician_pools_category
    ON public.technician_pools(category_id);
CREATE INDEX IF NOT EXISTS idx_pool_members_pool
    ON public.technician_pool_members(pool_id);
CREATE INDEX IF NOT EXISTS idx_pool_members_technician
    ON public.technician_pool_members(technician_id);
CREATE INDEX IF NOT EXISTS idx_availability_technician
    ON public.technician_availability(technician_id, is_active);
CREATE INDEX IF NOT EXISTS idx_assignment_sla_events_ticket
    ON public.assignment_sla_events(ticket_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assignment_due_at
    ON public.tickets(assignment_due_at) WHERE assignment_due_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_assignment_sla_state
    ON public.tickets(assignment_sla_state, status) WHERE assigned_to IS NULL;
CREATE INDEX IF NOT EXISTS idx_assignment_history_assigner
    ON public.ticket_assignment_history(assigner_id);
