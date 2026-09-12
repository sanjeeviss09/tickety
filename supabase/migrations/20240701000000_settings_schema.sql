-- Email Templates Table
CREATE TABLE public.email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_name TEXT NOT NULL UNIQUE,
    subject_template TEXT NOT NULL,
    body_template TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_email_templates_modtime 
BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Admins can manage email templates
CREATE POLICY "Admins can manage email templates" 
ON public.email_templates 
FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = auth.uid() AND r.name = 'Admin'
    )
);

-- Everyone can read active email templates (for sending)
CREATE POLICY "Authenticated users can read email templates"
ON public.email_templates
FOR SELECT
TO authenticated
USING (true);

-- Create public_assets bucket for Company Logo and Favicon
INSERT INTO storage.buckets (id, name, public) 
VALUES ('public_assets', 'public_assets', true) 
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies for public_assets
-- 1. Public can read
CREATE POLICY "Public Access to public_assets"
ON storage.objects FOR SELECT
USING ( bucket_id = 'public_assets' );

-- 2. Only Admins can upload/update/delete
CREATE POLICY "Admins can manage public_assets"
ON storage.objects FOR ALL
TO authenticated
USING (
    bucket_id = 'public_assets' AND
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = auth.uid() AND r.name = 'Admin'
    )
);

-- Insert Default System Settings (if they don't exist)
INSERT INTO public.system_settings (key, value) VALUES
('general_config', '{
    "app_name": "DeskPulse",
    "default_language": "en",
    "time_zone": "UTC",
    "date_format": "MM/DD/YYYY",
    "time_format": "24h",
    "currency": "USD",
    "default_landing_page": "/dashboard",
    "default_page_size": 20,
    "default_theme": "light"
}'),
('company_config', '{
    "company_name": "Acme Corp",
    "registered_name": "Acme Corporation Inc.",
    "address": "123 Business Rd",
    "city": "Metropolis",
    "state": "NY",
    "country": "USA",
    "pin_code": "10001",
    "phone": "+1 555-0100",
    "email": "contact@acmecorp.com",
    "website": "https://acmecorp.com",
    "support_email": "support@acmecorp.com",
    "support_phone": "+1 555-0101"
}'),
('ticket_config', '{
    "prefix": "DSP",
    "include_year": true,
    "number_length": 6,
    "starting_number": 1,
    "status_config": {
        "Open": { "color": "blue", "display_name": "Open", "active": true },
        "Assigned": { "color": "indigo", "display_name": "Assigned", "active": true },
        "Accepted": { "color": "purple", "display_name": "Accepted", "active": true },
        "In Progress": { "color": "yellow", "display_name": "In Progress", "active": true },
        "Waiting for User": { "color": "orange", "display_name": "Waiting for User", "active": true },
        "Resolved": { "color": "green", "display_name": "Resolved", "active": true },
        "Closed": { "color": "gray", "display_name": "Closed", "active": true },
        "Cancelled": { "color": "red", "display_name": "Cancelled", "active": true },
        "Reopened": { "color": "pink", "display_name": "Reopened", "active": true }
    },
    "priority_config": {
        "Low": { "color": "gray", "display_name": "Low", "active": true },
        "Medium": { "color": "blue", "display_name": "Medium", "active": true },
        "High": { "color": "orange", "display_name": "High", "active": true },
        "Critical": { "color": "red", "display_name": "Critical", "active": true }
    }
}'),
('notification_config', '{
    "in_app": {
        "ticket_created": true,
        "ticket_assigned": true,
        "ticket_accepted": true,
        "ticket_status_changed": true,
        "new_comment": true,
        "ticket_resolved": true,
        "ticket_closed": true,
        "ticket_reopened": true,
        "sla_warning": true,
        "sla_breach": true,
        "asset_assigned": true,
        "asset_transferred": true,
        "warranty_expiry": true,
        "amc_expiry": true
    },
    "email": {
        "ticket_created": true,
        "ticket_assigned": true,
        "ticket_accepted": true,
        "ticket_status_changed": true,
        "new_comment": true,
        "ticket_resolved": true,
        "ticket_closed": true,
        "ticket_reopened": true,
        "sla_warning": true,
        "sla_breach": true,
        "asset_assigned": true,
        "asset_transferred": true,
        "warranty_expiry": true,
        "amc_expiry": true
    },
    "provider": {
        "from_name": "DeskPulse Support",
        "from_email": "support@deskpulse.internal",
        "reply_to": "support@deskpulse.internal",
        "status": "configured"
    }
}'),
('asset_config', '{
    "prefix": "AST",
    "warranty_warning_days": 60,
    "amc_warning_days": 30
}'),
('kb_config', '{
    "is_enabled": true,
    "require_approval": true,
    "allow_ratings": true,
    "allow_comments": true,
    "require_versioning": true,
    "max_upload_size_mb": 10,
    "allowed_file_types": [".pdf", ".doc", ".docx", ".png", ".jpg"]
}'),
('service_catalog_config', '{
    "require_approval": false,
    "default_sla_hours": 48
}'),
('security_config', '{
    "session_timeout_minutes": 120,
    "max_failed_attempts": 5,
    "lockout_duration_minutes": 30,
    "min_password_length": 8,
    "require_complexity": true
}')
ON CONFLICT (key) DO NOTHING;

-- Insert default email templates
INSERT INTO public.email_templates (event_name, subject_template, body_template) VALUES
('Ticket Created', 'Ticket #{{ticket_number}} Created: {{subject}}', 'Hello {{employee_name}},<br><br>Your ticket #{{ticket_number}} has been created successfully.<br><br><b>Subject:</b> {{subject}}<br><b>Priority:</b> {{priority}}<br><br>View ticket: <a href="{{ticket_url}}">Click here</a><br><br>Regards,<br>{{company_name}}'),
('Ticket Assigned', 'Ticket #{{ticket_number}} Assigned to {{technician_name}}', 'Hello {{employee_name}},<br><br>Your ticket #{{ticket_number}} has been assigned to {{technician_name}}.<br><br>Regards,<br>{{company_name}}'),
('Ticket Resolved', 'Ticket #{{ticket_number}} Resolved', 'Hello {{employee_name}},<br><br>Your ticket #{{ticket_number}} has been resolved.<br><br>View ticket: <a href="{{ticket_url}}">Click here</a><br><br>Regards,<br>{{company_name}}')
ON CONFLICT (event_name) DO NOTHING;
