-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Roles Table
CREATE TABLE public.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default roles
INSERT INTO public.roles (name, description) VALUES
    ('Admin', 'System Administrator with full access'),
    ('Technician', 'Help desk technician for resolving tickets'),
    ('Employee', 'Standard user who can create and view own tickets');

-- Units Table
CREATE TABLE public.units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_units_modtime
BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Insert default units
INSERT INTO public.units (name) VALUES
    ('Corporate'),
    ('Sri City'),
    ('R&D');

-- Departments Table
CREATE TABLE public.departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_departments_modtime
BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Insert default departments
INSERT INTO public.departments (name) VALUES
    ('HR'), ('IT'), ('QA'), ('QC'), ('Finance'), 
    ('Production'), ('Warehouse'), ('Engineering'), 
    ('Procurement'), ('Regulatory Affairs'), 
    ('Analytical Development'), ('Packaging Development'), 
    ('Project Management');

-- Profiles Table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    employee_id TEXT UNIQUE,
    full_name TEXT,
    email_address TEXT UNIQUE NOT NULL,
    mobile_number TEXT,
    role_id UUID REFERENCES public.roles(id),
    unit_id UUID REFERENCES public.units(id),
    department_id UUID REFERENCES public.departments(id),
    profile_picture_url TEXT,
    employment_status TEXT NOT NULL DEFAULT 'Active' CHECK (employment_status IN ('Active', 'Inactive', 'Suspended')),
    has_set_password BOOLEAN NOT NULL DEFAULT false,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_profiles_modtime
BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Audit Logs Table
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    old_values JSONB,
    new_values JSONB,
    ip_address TEXT,
    device_info TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- System Settings Table
CREATE TABLE public.system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_system_settings_modtime
BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_role_id UUID;
BEGIN
    SELECT id INTO default_role_id FROM public.roles WHERE name = 'Employee' LIMIT 1;
    
    INSERT INTO public.profiles (id, email_address, full_name, employee_id, role_id)
    VALUES (
      NEW.id, 
      NEW.email, 
      NEW.raw_user_meta_data->>'full_name', 
      COALESCE(NEW.raw_user_meta_data->>'employee_id', split_part(NEW.email, '@', 1)),
      default_role_id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Enable RLS on all tables
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Create policies (Basic setup, Express Backend will bypass using Service Role Key)
-- Only allow authenticated users to read roles, units, departments
CREATE POLICY "Authenticated users can read roles" ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read units" ON public.units FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read departments" ON public.departments FOR SELECT TO authenticated USING (true);

-- Profiles: users can read their own profile, admins can read all
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);

-- We'll rely on the backend API (using service_role key) for most mutating operations.

-- Seed Admin User (AXX09)
DO $$
DECLARE
  admin_uid UUID := uuid_generate_v4();
  admin_role_id UUID;
BEGIN
  -- Check if admin role exists to get its ID
  SELECT id INTO admin_role_id FROM public.roles WHERE name = 'Admin' LIMIT 1;

  -- Insert into auth.users (simulate signup)
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, 
    email_confirmed_at, recovery_sent_at, last_sign_in_at, 
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, 
    confirmation_token, email_change, email_change_token_new, recovery_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000', admin_uid, 'authenticated', 'authenticated', 
    'AXX09@deskpulse.internal', crypt('AXX09', gen_salt('bf')), 
    now(), NULL, NULL, 
    '{"provider":"email","providers":["email"]}', 
    '{"full_name":"System Admin", "employee_id": "AXX09"}', 
    now(), now(), '', '', '', ''
  );

  -- The trigger public.handle_new_user() will automatically create the profile.
  -- We just need to update it to set the role to Admin and has_set_password to true.
  UPDATE public.profiles 
  SET 
    role_id = admin_role_id, 
    has_set_password = true,
    employee_id = 'AXX09'
  WHERE id = admin_uid;
END $$;

