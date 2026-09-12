-- Fix: Ensure the System Admin (AXX09) has the Admin role assigned
-- Run this in your Supabase SQL Editor

UPDATE public.profiles 
SET role_id = (SELECT id FROM public.roles WHERE name = 'Admin' LIMIT 1)
WHERE employee_id = 'AXX09' 
   OR email_address = 'AXX09@deskpulse.internal';

-- Verify the fix
SELECT p.id, p.employee_id, p.full_name, p.email_address, r.name as role_name
FROM public.profiles p
LEFT JOIN public.roles r ON r.id = p.role_id
WHERE p.employee_id = 'AXX09';
