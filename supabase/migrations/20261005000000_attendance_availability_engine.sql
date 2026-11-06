-- =============================================================================
-- Migration: Technician Attendance, Availability, and Automatic Assignment
-- Description: Adds shift profiles, attendance tracking, leave exceptions,
--              availability rules, modifies routing rules for multi-tech pools,
--              and adds assignment events history.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. shift_profiles
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.shift_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    working_days JSONB NOT NULL DEFAULT '["Mon","Tue","Wed","Thu","Fri"]',
    timezone TEXT NOT NULL DEFAULT 'UTC',
    grace_period_mins INTEGER NOT NULL DEFAULT 15,
    late_threshold_mins INTEGER NOT NULL DEFAULT 30,
    assignment_availability_threshold_mins INTEGER NOT NULL DEFAULT 60,
    break_config JSONB,
    is_overnight BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_shift_profiles_modtime
BEFORE UPDATE ON public.shift_profiles
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. technician_shift_assignments
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.technician_shift_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    technician_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    shift_profile_id UUID NOT NULL REFERENCES public.shift_profiles(id) ON DELETE CASCADE,
    effective_start DATE NOT NULL,
    effective_end DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tech_shift_assign_tech_id ON public.technician_shift_assignments(technician_id);
CREATE INDEX idx_tech_shift_assign_shift_id ON public.technician_shift_assignments(shift_profile_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. technician_attendance
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.technician_attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    technician_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    shift_date DATE NOT NULL,
    shift_profile_id UUID REFERENCES public.shift_profiles(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'Scheduled' 
           CHECK (status IN ('Scheduled', 'Not Checked In', 'Present', 'Late', 'Checked Out', 'Leave', 'Absent', 'Unavailable', 'Exception', 'Off Day')),
    check_in_time TIMESTAMPTZ,
    check_out_time TIMESTAMPTZ,
    total_working_duration_mins INTEGER,
    exception_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (technician_id, shift_date)
);

CREATE TRIGGER update_technician_attendance_modtime
BEFORE UPDATE ON public.technician_attendance
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

CREATE INDEX idx_tech_attendance_tech_id ON public.technician_attendance(technician_id);
CREATE INDEX idx_tech_attendance_date ON public.technician_attendance(shift_date);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. technician_leave_exceptions
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.technician_leave_exceptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    technician_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    exception_type TEXT NOT NULL 
                   CHECK (exception_type IN ('Leave', 'Holiday', 'Training', 'Remote Work', 'Business Travel', 'Temporary Unavailability', 'Other')),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    reason TEXT,
    assignment_impact TEXT NOT NULL DEFAULT 'Unavailable' CHECK (assignment_impact IN ('Unavailable', 'Available')),
    status TEXT NOT NULL DEFAULT 'Approved' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_technician_leave_exceptions_modtime
BEFORE UPDATE ON public.technician_leave_exceptions
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

CREATE INDEX idx_tech_leave_tech_id ON public.technician_leave_exceptions(technician_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Modify ticket_routing_rules & Add routing_rule_technicians
-- ─────────────────────────────────────────────────────────────────────────────
-- Migrate existing rules to a new primary pool first.
CREATE TABLE public.routing_rule_technicians (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    routing_rule_id UUID NOT NULL REFERENCES public.ticket_routing_rules(id) ON DELETE CASCADE,
    technician_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    pool_type TEXT NOT NULL DEFAULT 'Primary' CHECK (pool_type IN ('Primary', 'Backup')),
    priority_order INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (routing_rule_id, technician_id)
);

CREATE INDEX idx_routing_rule_techs_rule_id ON public.routing_rule_technicians(routing_rule_id);
CREATE INDEX idx_routing_rule_techs_tech_id ON public.routing_rule_technicians(technician_id);

-- Migrate old data: For each ticket_routing_rule, if technician_id is not null, create a routing_rule_technicians entry
INSERT INTO public.routing_rule_technicians (routing_rule_id, technician_id, pool_type, priority_order, is_active)
SELECT id, technician_id, 'Primary', 1, true
FROM public.ticket_routing_rules
WHERE technician_id IS NOT NULL;

-- Now safe to drop technician_id from ticket_routing_rules
ALTER TABLE public.ticket_routing_rules DROP COLUMN IF EXISTS technician_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. assignment_events
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.assignment_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    routing_rule_id UUID REFERENCES public.ticket_routing_rules(id) ON DELETE SET NULL,
    candidate_technicians JSONB,
    excluded_technicians JSONB,
    selected_technician_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assignment_strategy TEXT,
    workload_snapshot JSONB,
    capacity_override_used BOOLEAN NOT NULL DEFAULT false,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assignment_events_ticket_id ON public.assignment_events(ticket_id);
CREATE INDEX idx_assignment_events_tech_id ON public.assignment_events(selected_technician_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. assignment_availability_rules (Global Config)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.assignment_availability_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    require_attendance BOOLEAN NOT NULL DEFAULT true,
    default_capacity_limit INTEGER DEFAULT 10,
    critical_tickets_bypass_capacity BOOLEAN NOT NULL DEFAULT true,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert a default row
INSERT INTO public.assignment_availability_rules (require_attendance, default_capacity_limit, critical_tickets_bypass_capacity)
VALUES (true, 10, true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7.5 technician_capacities
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.technician_capacities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    technician_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    capacity_limit INTEGER, -- NULL means unlimited, otherwise explicit limit
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (technician_id)
);

CREATE TRIGGER update_technician_capacities_modtime
BEFORE UPDATE ON public.technician_capacities
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.shift_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technician_shift_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technician_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technician_leave_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routing_rule_technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technician_capacities ENABLE ROW LEVEL SECURITY;

-- Admin Full Access Policies
CREATE POLICY "Admin manage shift profiles" ON public.shift_profiles TO authenticated USING (public.get_user_role() = 'Admin');
CREATE POLICY "Admin manage shift assignments" ON public.technician_shift_assignments TO authenticated USING (public.get_user_role() = 'Admin');
CREATE POLICY "Admin manage attendance" ON public.technician_attendance TO authenticated USING (public.get_user_role() = 'Admin');
CREATE POLICY "Admin manage leaves" ON public.technician_leave_exceptions TO authenticated USING (public.get_user_role() = 'Admin');
CREATE POLICY "Admin manage routing tech pools" ON public.routing_rule_technicians TO authenticated USING (public.get_user_role() = 'Admin');
CREATE POLICY "Admin read assignment events" ON public.assignment_events TO authenticated USING (public.get_user_role() = 'Admin');
CREATE POLICY "Admin manage assignment rules" ON public.assignment_availability_rules TO authenticated USING (public.get_user_role() = 'Admin');
CREATE POLICY "Admin manage tech capacities" ON public.technician_capacities TO authenticated USING (public.get_user_role() = 'Admin');

-- Technician Read Access Policies
CREATE POLICY "Technician read shift profiles" ON public.shift_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Technician read own shift assignments" ON public.technician_shift_assignments FOR SELECT TO authenticated USING (technician_id = (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1));
CREATE POLICY "Technician read own attendance" ON public.technician_attendance FOR SELECT TO authenticated USING (technician_id = (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1));
CREATE POLICY "Technician update own attendance" ON public.technician_attendance FOR UPDATE TO authenticated USING (technician_id = (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1));
CREATE POLICY "Technician read own leaves" ON public.technician_leave_exceptions FOR SELECT TO authenticated USING (technician_id = (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1));
CREATE POLICY "Technician read routing tech pools" ON public.routing_rule_technicians FOR SELECT TO authenticated USING (true);
CREATE POLICY "Technician read assignment rules" ON public.assignment_availability_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Technician read own capacity" ON public.technician_capacities FOR SELECT TO authenticated USING (technician_id = (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1));

-- Allow service role to do everything implicitly by bypassing RLS

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Atomic Assignment RPC
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.assign_ticket_atomic(
  p_ticket_id UUID,
  p_technician_id UUID,
  p_capacity_limit INTEGER,
  p_bypass_capacity BOOLEAN,
  p_eligible_pool JSONB,
  p_routing_result JSONB,
  p_assignment_due_at TIMESTAMPTZ,
  p_assignment_sla_state TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_active_count INTEGER;
  v_tech_capacity INTEGER;
BEGIN
  -- Lock the technician profile to prevent concurrent assignments to the same tech
  PERFORM 1 FROM public.profiles WHERE id = p_technician_id FOR UPDATE;
  
  -- Check explicit technician capacity override
  SELECT capacity_limit INTO v_tech_capacity FROM public.technician_capacities WHERE technician_id = p_technician_id;
  IF v_tech_capacity IS NOT NULL THEN
    p_capacity_limit := v_tech_capacity;
  END IF;
  
  SELECT count(*) INTO v_active_count 
  FROM public.tickets 
  WHERE assigned_to = p_technician_id 
  AND status NOT IN ('Resolved', 'Closed', 'Cancelled');
  
  IF p_capacity_limit IS NOT NULL AND NOT p_bypass_capacity THEN
    IF v_active_count >= p_capacity_limit THEN
      RETURN FALSE; -- Capacity exceeded
    END IF;
  END IF;
  
  -- Perform assignment
  UPDATE public.tickets 
  SET 
    assigned_to = p_technician_id, 
    assigned_at = now(), 
    status = CASE WHEN status = 'Open' THEN 'Assigned' ELSE status END,
    eligible_technician_pool = p_eligible_pool,
    routing_result = p_routing_result,
    assignment_due_at = COALESCE(p_assignment_due_at, assignment_due_at),
    assignment_sla_state = COALESCE(p_assignment_sla_state, assignment_sla_state)
  WHERE id = p_ticket_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
