const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const sql = `
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_role_id UUID;
    v_employee_id TEXT;
    v_existing_profile_id UUID;
BEGIN
    SELECT id INTO default_role_id FROM public.roles WHERE name = 'Employee' LIMIT 1;
    v_employee_id := COALESCE(NEW.raw_user_meta_data->>'employee_id', split_part(NEW.email, '@', 1));
    
    SELECT id INTO v_existing_profile_id FROM public.profiles WHERE employee_id = v_employee_id;
    
    IF v_existing_profile_id IS NOT NULL THEN
        UPDATE public.profiles
        SET auth_user_id = NEW.id
        WHERE id = v_existing_profile_id;
    ELSE
        INSERT INTO public.profiles (id, auth_user_id, email_address, full_name, employee_id, role_id)
        VALUES (
          NEW.id,
          NEW.id,
          NEW.email, 
          NEW.raw_user_meta_data->>'full_name', 
          v_employee_id,
          default_role_id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
  `;
  const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql });
  console.log('Result:', data, 'Error:', error);
}
test();
