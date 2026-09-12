-- Master Data Schema Updates for Employees and Assets Bulk Operations

-- 1. Modify Profiles Table to act as Employee Master
-- Drop the strict dependency on auth.users so we can create employees without login access
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Make id auto-generate UUIDs since it will no longer purely copy auth.users.id
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT uuid_generate_v4();

-- Add new Master Data fields
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS designation TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS joining_date DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reporting_manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Migrate existing data (link existing profiles back to their auth user)
UPDATE public.profiles SET auth_user_id = id WHERE auth_user_id IS NULL;

-- Make employee_id truly unique (prevent duplicates during imports)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_employee_id_key;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_employee_id_key UNIQUE (employee_id);

-- Make email truly unique
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_email_address_key;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_email_address_key UNIQUE (email_address);


-- 2. Create Employee Import Tables
CREATE TABLE public.employee_import_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_name TEXT NOT NULL,
    uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    total_records INTEGER NOT NULL DEFAULT 0,
    successful_records INTEGER NOT NULL DEFAULT 0,
    failed_records INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Processing', -- 'Processing', 'Completed', 'Failed'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.employee_import_errors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID NOT NULL REFERENCES public.employee_import_batches(id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL,
    field_name TEXT,
    supplied_value TEXT,
    error_message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- 3. Create Asset Import Tables
CREATE TABLE public.asset_import_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_name TEXT NOT NULL,
    uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    total_records INTEGER NOT NULL DEFAULT 0,
    successful_records INTEGER NOT NULL DEFAULT 0,
    failed_records INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Processing',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.asset_import_errors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID NOT NULL REFERENCES public.asset_import_batches(id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL,
    field_name TEXT,
    supplied_value TEXT,
    error_message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for Import Tables
ALTER TABLE public.employee_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_import_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_import_errors ENABLE ROW LEVEL SECURITY;

-- Admins can read all import data
CREATE POLICY "Admins read import batches" ON public.employee_import_batches FOR SELECT TO authenticated USING (public.get_user_role() = 'Admin');
CREATE POLICY "Admins read import errors" ON public.employee_import_errors FOR SELECT TO authenticated USING (public.get_user_role() = 'Admin');
CREATE POLICY "Admins read asset import batches" ON public.asset_import_batches FOR SELECT TO authenticated USING (public.get_user_role() = 'Admin');
CREATE POLICY "Admins read asset import errors" ON public.asset_import_errors FOR SELECT TO authenticated USING (public.get_user_role() = 'Admin');

-- Add Indexes for Performance as requested
CREATE INDEX IF NOT EXISTS idx_profiles_employee_id ON public.profiles(employee_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email_address);
CREATE INDEX IF NOT EXISTS idx_profiles_unit_id ON public.profiles(unit_id);
CREATE INDEX IF NOT EXISTS idx_profiles_department_id ON public.profiles(department_id);

CREATE INDEX IF NOT EXISTS idx_assets_asset_code ON public.assets(asset_code);
CREATE INDEX IF NOT EXISTS idx_assets_serial_number ON public.assets(serial_number);
CREATE INDEX IF NOT EXISTS idx_assets_status ON public.assets(status);

-- Update the new user trigger to link auth_user_id correctly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_role_id UUID;
BEGIN
    SELECT id INTO default_role_id FROM public.roles WHERE name = 'Employee' LIMIT 1;
    
    INSERT INTO public.profiles (id, auth_user_id, email_address, full_name, employee_id, role_id)
    VALUES (
      NEW.id,
      NEW.id,
      NEW.email, 
      NEW.raw_user_meta_data->>'full_name', 
      COALESCE(NEW.raw_user_meta_data->>'employee_id', split_part(NEW.email, '@', 1)),
      default_role_id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
