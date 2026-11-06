-- Migration: ticket_on_behalf_assets_attachments

-- 1. tickets: Add requester_id, affected_employee_id, related_asset_id
ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS requester_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS affected_employee_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS related_asset_id UUID REFERENCES public.assets(id);

-- Initialize
UPDATE public.tickets SET requester_id = created_by WHERE requester_id IS NULL;
UPDATE public.tickets SET affected_employee_id = created_by WHERE affected_employee_id IS NULL;

-- 2. Update tickets RLS for Employees
DROP POLICY IF EXISTS "Employees can read own tickets" ON public.tickets;
CREATE POLICY "Employees can read own tickets" ON public.tickets FOR SELECT TO authenticated
USING (auth.uid() = created_by OR auth.uid() = requester_id OR auth.uid() = affected_employee_id);

-- 3. asset_assignments: Add is_default and unique constraint
ALTER TABLE public.asset_assignments
ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

DO $$ BEGIN
  CREATE UNIQUE INDEX one_default_asset_per_employee ON public.asset_assignments (assigned_to) WHERE is_default = true AND status = 'Active';
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

-- 4. ticket_attachments: Add original_filename (visibility already added in previous migration)
ALTER TABLE public.ticket_attachments
ADD COLUMN IF NOT EXISTS original_filename TEXT;

-- 5. Secure storage policy for ticket_attachments
DROP POLICY IF EXISTS "Users can view attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view authorized ticket attachments" ON storage.objects;

CREATE POLICY "Users can view authorized ticket attachments" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'ticket_attachments' AND 
  (
    -- User is the uploader
    auth.uid() = owner OR
    -- Check if user can view the related ticket via metadata (assuming we store ticket_id in storage object metadata if possible, but actually we can check public.ticket_attachments table)
    EXISTS (
      SELECT 1 FROM public.ticket_attachments ta
      JOIN public.tickets t ON t.id = ta.ticket_id
      WHERE ta.storage_path = storage.objects.name
      AND (
        t.created_by = auth.uid() OR
        t.requester_id = auth.uid() OR
        t.affected_employee_id = auth.uid() OR
        t.assigned_to = auth.uid() OR
        public.get_user_role() = 'Admin' OR
        (public.get_user_role() = 'Technician' AND t.unit_id IN (SELECT unit_id FROM public.technician_unit_assignments WHERE technician_id = auth.uid()))
      )
    )
  )
);
