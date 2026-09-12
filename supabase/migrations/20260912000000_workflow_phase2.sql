-- =============================================================================
-- Migration: Technician Workflow Phase 2
-- Description: Adds work sessions, SLA pause intervals, technician resolution,
--              employee confirmation/rating, and rating reminder history.
--              Adds "Awaiting Employee Confirmation" to ticket_status ENUM.
-- =============================================================================

-- 1. Extend ticket_status ENUM
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'Awaiting Employee Confirmation'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ticket_status')
  ) THEN
    ALTER TYPE ticket_status ADD VALUE 'Awaiting Employee Confirmation';
  END IF;
END;
$$;

-- 2. New columns on tickets
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS work_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS technician_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS employee_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reopen_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_work_duration_seconds INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active_work_session_id UUID;

-- 3. New columns on ticket_attachments
ALTER TABLE public.ticket_attachments
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS attachment_type TEXT DEFAULT 'evidence';

-- 4. ticket_work_sessions
CREATE TABLE IF NOT EXISTS public.ticket_work_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL,
  technician_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  session_type TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. ticket_sla_pauses
CREATE TABLE IF NOT EXISTS public.ticket_sla_pauses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL,
  paused_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resumed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  pause_reason TEXT NOT NULL DEFAULT 'Waiting for User',
  paused_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resumed_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. ticket_resolution
CREATE TABLE IF NOT EXISTS public.ticket_resolution (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL,
  technician_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  problem_identified TEXT NOT NULL,
  work_performed TEXT NOT NULL,
  resolution_summary TEXT NOT NULL,
  root_cause TEXT,
  preventive_recommendation TEXT,
  total_work_duration_seconds INTEGER NOT NULL DEFAULT 0,
  sla_status_at_completion TEXT NOT NULL DEFAULT 'On Track',
  attempt_number INTEGER NOT NULL DEFAULT 1,
  technician_completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. ticket_resolution_confirmations
CREATE TABLE IF NOT EXISTS public.ticket_resolution_confirmations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL,
  resolution_id UUID REFERENCES public.ticket_resolution(id) ON DELETE SET NULL,
  employee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  technician_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  employee_comment TEXT,
  rejection_reason TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. ticket_ratings
CREATE TABLE IF NOT EXISTS public.ticket_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL,
  confirmation_id UUID REFERENCES public.ticket_resolution_confirmations(id) ON DELETE SET NULL,
  employee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  technician_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback_comment TEXT,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. ticket_rating_reminders
CREATE TABLE IF NOT EXISTS public.ticket_rating_reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL,
  confirmation_id UUID REFERENCES public.ticket_resolution_confirmations(id) ON DELETE SET NULL,
  employee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reminder_number INTEGER NOT NULL DEFAULT 1,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivery_status TEXT NOT NULL DEFAULT 'sent',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ticket_id, reminder_number)
);

-- 10. Enable RLS
ALTER TABLE public.ticket_work_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_sla_pauses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_resolution ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_resolution_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_rating_reminders ENABLE ROW LEVEL SECURITY;

-- 11. RLS: ticket_work_sessions
CREATE POLICY "Admin_Tech read work sessions"
ON public.ticket_work_sessions FOR SELECT TO authenticated
USING (public.get_user_role() IN ('Admin', 'Technician'));

CREATE POLICY "Employee read work sessions for own tickets"
ON public.ticket_work_sessions FOR SELECT TO authenticated
USING (
  public.get_user_role() = 'Employee'
  AND ticket_id IN (
    SELECT id FROM public.tickets
    WHERE created_by = (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1)
  )
);

-- 12. RLS: ticket_sla_pauses
CREATE POLICY "Admin_Tech read SLA pauses"
ON public.ticket_sla_pauses FOR SELECT TO authenticated
USING (public.get_user_role() IN ('Admin', 'Technician'));

CREATE POLICY "Employee read SLA pauses for own tickets"
ON public.ticket_sla_pauses FOR SELECT TO authenticated
USING (
  public.get_user_role() = 'Employee'
  AND ticket_id IN (
    SELECT id FROM public.tickets
    WHERE created_by = (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1)
  )
);

-- 13. RLS: ticket_resolution
CREATE POLICY "Admin_Tech read resolution"
ON public.ticket_resolution FOR SELECT TO authenticated
USING (public.get_user_role() IN ('Admin', 'Technician'));

CREATE POLICY "Employee read resolution for own tickets"
ON public.ticket_resolution FOR SELECT TO authenticated
USING (
  public.get_user_role() = 'Employee'
  AND ticket_id IN (
    SELECT id FROM public.tickets
    WHERE created_by = (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1)
  )
);

-- 14. RLS: ticket_resolution_confirmations
CREATE POLICY "Admin_Tech read confirmations"
ON public.ticket_resolution_confirmations FOR SELECT TO authenticated
USING (public.get_user_role() IN ('Admin', 'Technician'));

CREATE POLICY "Employee read own confirmations"
ON public.ticket_resolution_confirmations FOR SELECT TO authenticated
USING (
  employee_id = (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1)
);

-- 15. RLS: ticket_ratings
CREATE POLICY "Admin read all ratings"
ON public.ticket_ratings FOR SELECT TO authenticated
USING (public.get_user_role() = 'Admin');

CREATE POLICY "Technician read own ticket ratings"
ON public.ticket_ratings FOR SELECT TO authenticated
USING (
  public.get_user_role() = 'Technician'
  AND technician_id = (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1)
);

CREATE POLICY "Employee read own ratings"
ON public.ticket_ratings FOR SELECT TO authenticated
USING (
  public.get_user_role() = 'Employee'
  AND employee_id = (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1)
);

-- 16. RLS: ticket_rating_reminders
CREATE POLICY "Admin read reminders"
ON public.ticket_rating_reminders FOR SELECT TO authenticated
USING (public.get_user_role() = 'Admin');

-- 17. New system settings
INSERT INTO public.system_settings (key, value) VALUES
('rating_config', '{"enabled":true,"mandatory_for_closure":true,"scale":5,"comments_optional":true,"anonymous_in_reports":false,"low_rating_threshold":2,"escalate_on_low_rating":true}'),
('closure_config', '{"auto_close_after_rating":true,"auto_close_days_no_response":3,"reminder_enabled":true,"first_reminder_delay_hours":24,"reminder_frequency_hours":24,"max_reminders":2,"send_reminders_on_weekends":false}'),
('sla_config_extended', '{"warning_threshold_percent":75,"pause_sla_on_waiting_for_user":true,"pause_sla_on_awaiting_confirmation":false,"escalation_recipients":[]}')
ON CONFLICT (key) DO NOTHING;

-- 18. New email templates
INSERT INTO public.email_templates (event_name, subject_template, body_template) VALUES
('Work Started','Ticket #{{ticket_number}} - Work Has Started','<p>Hello {{employee_name}},</p><p>A technician has started working on your ticket.</p><p><b>Ticket:</b> {{ticket_number}} - {{subject}}<br><b>Technician:</b> {{technician_name}}<br><b>Started At:</b> {{work_started_at}}</p><p><a href="{{ticket_url}}">View Ticket</a></p>'),
('Completion Request','Ticket #{{ticket_number}} - Please Review and Confirm Resolution','<p>Hello {{employee_name}},</p><p>{{technician_name}} has completed work on your ticket and is awaiting your confirmation.</p><p><b>Resolution Summary:</b><br>{{resolution_summary}}</p><p><a href="{{ticket_url}}">Review and Confirm</a></p>'),
('Employee Confirmed','Ticket #{{ticket_number}} - Employee Confirmed Resolution (Rating: {{rating}}/5)','<p>Hello {{technician_name}},</p><p>The employee confirmed your resolution for ticket {{ticket_number}}.</p><p><b>Rating:</b> {{rating}}/5<br><b>Feedback:</b> {{feedback}}</p><p><a href="{{ticket_url}}">View Ticket</a></p>'),
('Employee Rejected','Ticket #{{ticket_number}} - Employee Reported Issue Not Resolved','<p>Hello {{technician_name}},</p><p>The employee reported the issue is NOT resolved for ticket {{ticket_number}}.</p><p><b>Reason:</b><br>{{rejection_reason}}</p><p><a href="{{ticket_url}}">Open Ticket</a></p>'),
('Ticket Closed Notification','Ticket #{{ticket_number}} Has Been Closed','<p>Hello {{employee_name}},</p><p>Your ticket has been closed.</p><p><b>Ticket:</b> {{ticket_number}} - {{subject}}<br><b>Technician:</b> {{technician_name}}<br><b>Resolution:</b> {{resolution_summary}}<br><b>Your Rating:</b> {{rating}}/5</p><p><a href="{{ticket_url}}">View Ticket</a></p>'),
('Low Rating Alert','[Alert] Low Rating on Ticket #{{ticket_number}}','<p>A low rating was received for ticket <b>{{ticket_number}}</b>.</p><p><b>Employee:</b> {{employee_name}}<br><b>Technician:</b> {{technician_name}}<br><b>Rating:</b> {{rating}}/5<br><b>Feedback:</b> {{feedback}}</p><p><a href="{{ticket_url}}">Open Ticket</a></p>'),
('Rating Reminder','Reminder: Please Review Your Ticket #{{ticket_number}}','<p>Hello {{employee_name}},</p><p>This is a reminder to review and confirm the resolution for ticket {{ticket_number}}.</p><p><b>Resolution Summary:</b><br>{{resolution_summary}}</p><p><a href="{{ticket_url}}">Review Now</a></p>'),
('SLA Warning','[SLA Warning] Ticket #{{ticket_number}} Approaching Deadline','<p>Hello {{technician_name}},</p><p>Ticket <b>{{ticket_number}}</b> is approaching its SLA deadline.</p><p><b>SLA Due:</b> {{sla_due_date}}<br><b>Remaining:</b> {{sla_remaining}}</p><p><a href="{{ticket_url}}">Open Ticket</a></p>'),
('SLA Breached','[SLA BREACH] Ticket #{{ticket_number}} Exceeded SLA','<p>Hello {{technician_name}},</p><p>Ticket <b>{{ticket_number}}</b> has <b>breached its SLA</b>.</p><p><b>SLA Due:</b> {{sla_due_date}}<br><b>Overdue By:</b> {{sla_overdue}}</p><p><a href="{{ticket_url}}">Open Ticket</a></p>'),
('Ticket Reopened Notification','Ticket #{{ticket_number}} Has Been Reopened','<p>Hello {{technician_name}},</p><p>Ticket <b>{{ticket_number}}</b> has been Reopened by the employee.</p><p><b>Reason:</b><br>{{rejection_reason}}</p><p><a href="{{ticket_url}}">Open Ticket</a></p>')
ON CONFLICT (event_name) DO NOTHING;

-- 19. Performance indexes
CREATE INDEX IF NOT EXISTS idx_work_sessions_ticket ON public.ticket_work_sessions(ticket_id);
CREATE INDEX IF NOT EXISTS idx_work_sessions_technician ON public.ticket_work_sessions(technician_id);
CREATE INDEX IF NOT EXISTS idx_sla_pauses_ticket ON public.ticket_sla_pauses(ticket_id);
CREATE INDEX IF NOT EXISTS idx_resolution_ticket ON public.ticket_resolution(ticket_id);
CREATE INDEX IF NOT EXISTS idx_confirmations_ticket ON public.ticket_resolution_confirmations(ticket_id);
CREATE INDEX IF NOT EXISTS idx_confirmations_status ON public.ticket_resolution_confirmations(status);
CREATE INDEX IF NOT EXISTS idx_ratings_ticket ON public.ticket_ratings(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ratings_technician ON public.ticket_ratings(technician_id);
CREATE INDEX IF NOT EXISTS idx_reminders_ticket ON public.ticket_rating_reminders(ticket_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status_assigned ON public.tickets(status, assigned_to);
