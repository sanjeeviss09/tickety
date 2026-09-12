-- Performance Fixes: Indexes and RLS Optimization

-- 1. Add missing indexes for Foreign Keys (Massive performance boost for JOINs and RLS)
CREATE INDEX IF NOT EXISTS profiles_auth_user_id_idx ON public.profiles(auth_user_id);
CREATE INDEX IF NOT EXISTS profiles_role_id_idx ON public.profiles(role_id);
CREATE INDEX IF NOT EXISTS profiles_unit_id_idx ON public.profiles(unit_id);
CREATE INDEX IF NOT EXISTS profiles_department_id_idx ON public.profiles(department_id);
CREATE INDEX IF NOT EXISTS profiles_reporting_manager_id_idx ON public.profiles(reporting_manager_id);

CREATE INDEX IF NOT EXISTS tickets_created_by_idx ON public.tickets(created_by);
CREATE INDEX IF NOT EXISTS tickets_assigned_to_idx ON public.tickets(assigned_to);
CREATE INDEX IF NOT EXISTS tickets_unit_id_idx ON public.tickets(unit_id);
CREATE INDEX IF NOT EXISTS tickets_department_id_idx ON public.tickets(department_id);
CREATE INDEX IF NOT EXISTS tickets_category_id_idx ON public.tickets(category_id);
CREATE INDEX IF NOT EXISTS tickets_self_service_session_id_idx ON public.tickets(self_service_session_id);

CREATE INDEX IF NOT EXISTS self_service_sessions_employee_id_idx ON public.self_service_sessions(employee_id);
CREATE INDEX IF NOT EXISTS self_service_interactions_session_id_idx ON public.self_service_interactions(session_id);

CREATE INDEX IF NOT EXISTS ticket_comments_ticket_id_idx ON public.ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS ticket_comments_author_id_idx ON public.ticket_comments(author_id);

CREATE INDEX IF NOT EXISTS ticket_timeline_ticket_id_idx ON public.ticket_timeline(ticket_id);
CREATE INDEX IF NOT EXISTS ticket_timeline_user_id_idx ON public.ticket_timeline(user_id);

CREATE INDEX IF NOT EXISTS tech_unit_assign_tech_id_idx ON public.technician_unit_assignments(technician_id);
CREATE INDEX IF NOT EXISTS tech_unit_assign_unit_id_idx ON public.technician_unit_assignments(unit_id);

-- 2. Optimize RLS Policies
-- Use (SELECT auth.uid()) and (SELECT public.get_user_role()) to cache results per-query instead of evaluating per-row.

-- Profiles
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles 
FOR UPDATE TO authenticated 
USING ((SELECT auth.uid()) = id OR (SELECT auth.uid()) = auth_user_id);

-- Tickets
DROP POLICY IF EXISTS "Employees can read own tickets" ON public.tickets;
CREATE POLICY "Employees can read own tickets" ON public.tickets 
FOR SELECT TO authenticated 
USING (created_by = (SELECT id FROM public.profiles WHERE auth_user_id = (SELECT auth.uid()) LIMIT 1));

DROP POLICY IF EXISTS "Technicians can read unit tickets" ON public.tickets;
CREATE POLICY "Technicians can read unit tickets" ON public.tickets 
FOR SELECT TO authenticated 
USING (
    (SELECT public.get_user_role()) = 'Technician' AND (
        assigned_to = (SELECT id FROM public.profiles WHERE auth_user_id = (SELECT auth.uid()) LIMIT 1)
        OR unit_id IN (
            SELECT unit_id FROM public.technician_unit_assignments 
            WHERE technician_id = (SELECT id FROM public.profiles WHERE auth_user_id = (SELECT auth.uid()) LIMIT 1)
        )
    )
);

-- Self Service
DROP POLICY IF EXISTS "Employees manage own sessions" ON public.self_service_sessions;
CREATE POLICY "Employees manage own sessions" ON public.self_service_sessions 
FOR ALL TO authenticated 
USING (employee_id = (SELECT id FROM public.profiles WHERE auth_user_id = (SELECT auth.uid()) LIMIT 1));

DROP POLICY IF EXISTS "Employees manage own interactions" ON public.self_service_interactions;
CREATE POLICY "Employees manage own interactions" ON public.self_service_interactions 
FOR ALL TO authenticated 
USING (session_id IN (
    SELECT id FROM public.self_service_sessions WHERE employee_id = (SELECT id FROM public.profiles WHERE auth_user_id = (SELECT auth.uid()) LIMIT 1)
));

DROP POLICY IF EXISTS "Techs and Admins read all sessions" ON public.self_service_sessions;
CREATE POLICY "Techs and Admins read all sessions" ON public.self_service_sessions 
FOR SELECT TO authenticated 
USING ((SELECT public.get_user_role()) IN ('Admin', 'Technician'));

DROP POLICY IF EXISTS "Techs and Admins read all interactions" ON public.self_service_interactions;
CREATE POLICY "Techs and Admins read all interactions" ON public.self_service_interactions 
FOR SELECT TO authenticated 
USING ((SELECT public.get_user_role()) IN ('Admin', 'Technician'));

-- Tech Assignments
DROP POLICY IF EXISTS "Admin can manage tech unit assignments" ON public.technician_unit_assignments;
CREATE POLICY "Admin can manage tech unit assignments" ON public.technician_unit_assignments 
TO authenticated 
USING ((SELECT public.get_user_role()) = 'Admin');

DROP POLICY IF EXISTS "Admin can manage routing rules" ON public.ticket_routing_rules;
CREATE POLICY "Admin can manage routing rules" ON public.ticket_routing_rules 
TO authenticated 
USING ((SELECT public.get_user_role()) = 'Admin');

DROP POLICY IF EXISTS "Admin can insert assignment history" ON public.ticket_assignment_history;
CREATE POLICY "Admin can insert assignment history" ON public.ticket_assignment_history 
FOR INSERT TO authenticated 
WITH CHECK ((SELECT public.get_user_role()) IN ('Admin', 'Technician'));
