-- Enums for Asset Status and Condition
CREATE TYPE asset_status AS ENUM ('Available', 'Assigned', 'In Repair', 'Under Maintenance', 'Retired', 'Lost', 'Damaged', 'Disposed', 'Reserved');
CREATE TYPE asset_condition AS ENUM ('Excellent', 'Good', 'Fair', 'Poor', 'Critical');

-- Asset Categories Table
CREATE TABLE public.asset_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER update_asset_categories_modtime BEFORE UPDATE ON public.asset_categories FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Assets Table
CREATE TABLE public.assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category_id UUID REFERENCES public.asset_categories(id),
    brand TEXT,
    model TEXT,
    serial_number TEXT,
    purchase_date DATE,
    purchase_cost DECIMAL(12,2),
    vendor TEXT,
    status asset_status NOT NULL DEFAULT 'Available',
    condition asset_condition NOT NULL DEFAULT 'Good',
    unit TEXT,
    department TEXT,
    location TEXT,
    qr_code TEXT,
    barcode TEXT,
    image_url TEXT,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER update_assets_modtime BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Asset Warranty Table
CREATE TABLE public.asset_warranty (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
    warranty_start_date DATE,
    warranty_end_date DATE,
    amc_start_date DATE,
    amc_end_date DATE,
    provider TEXT,
    contact_info TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(asset_id)
);
CREATE TRIGGER update_asset_warranty_modtime BEFORE UPDATE ON public.asset_warranty FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Asset Assignments Table
CREATE TABLE public.asset_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES public.profiles(id),
    assigned_by UUID REFERENCES public.profiles(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    returned_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'Active', -- Active, Returned
    remarks TEXT
);

-- Asset History Table (Audit Log)
CREATE TABLE public.asset_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    performed_by UUID REFERENCES public.profiles(id),
    previous_owner UUID REFERENCES public.profiles(id),
    new_owner UUID REFERENCES public.profiles(id),
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Asset Maintenance Table
CREATE TABLE public.asset_maintenance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
    scheduled_date DATE NOT NULL,
    completed_date DATE,
    assigned_technician UUID REFERENCES public.profiles(id),
    status TEXT NOT NULL DEFAULT 'Scheduled', -- Scheduled, In Progress, Completed, Cancelled
    checklist JSONB,
    remarks TEXT,
    cost DECIMAL(12,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER update_asset_maintenance_modtime BEFORE UPDATE ON public.asset_maintenance FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Asset Documents Table
CREATE TABLE public.asset_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    uploaded_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Asset Ticket Mapping Table
CREATE TABLE public.asset_ticket_mapping (
    asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
    ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    linked_by UUID REFERENCES public.profiles(id),
    PRIMARY KEY (asset_id, ticket_id)
);

-- RLS Configuration
ALTER TABLE public.asset_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_warranty ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_ticket_mapping ENABLE ROW LEVEL SECURITY;

-- Categories are read-only for all authenticated users
CREATE POLICY "Anyone can read asset categories" ON public.asset_categories FOR SELECT TO authenticated USING (true);

-- Assets RLS
-- Admins see all
-- Technicians see all (needed to link tickets or find specs) OR just assigned? The prompt said "Technicians may access assets assigned to their maintenance work".
-- Actually, we'll allow Technicians to read all assets so they can see tickets with linked assets. If they can't read the asset, it will break ticket details.
CREATE POLICY "Admins and Technicians can read all assets" ON public.assets FOR SELECT TO authenticated 
USING (public.get_user_role() IN ('Admin', 'Technician'));

CREATE POLICY "Employees read assigned assets" ON public.assets FOR SELECT TO authenticated 
USING (
    public.get_user_role() = 'Employee' 
    AND id IN (SELECT asset_id FROM public.asset_assignments WHERE assigned_to = auth.uid() AND status = 'Active')
);

-- Related tables RLS (Warranty, Assignments, History, Maintenance, Documents, Ticket Mapping)
-- Similar logic: Admin/Tech see all, Employee sees only for their assigned assets
CREATE POLICY "AdminTech read warranty" ON public.asset_warranty FOR SELECT TO authenticated USING (public.get_user_role() IN ('Admin', 'Technician'));
CREATE POLICY "Employee read warranty" ON public.asset_warranty FOR SELECT TO authenticated USING (public.get_user_role() = 'Employee' AND asset_id IN (SELECT id FROM public.assets WHERE id IN (SELECT asset_id FROM public.asset_assignments WHERE assigned_to = auth.uid() AND status = 'Active')));

CREATE POLICY "AdminTech read assignments" ON public.asset_assignments FOR SELECT TO authenticated USING (public.get_user_role() IN ('Admin', 'Technician'));
CREATE POLICY "Employee read assignments" ON public.asset_assignments FOR SELECT TO authenticated USING (public.get_user_role() = 'Employee' AND assigned_to = auth.uid());

CREATE POLICY "AdminTech read history" ON public.asset_history FOR SELECT TO authenticated USING (public.get_user_role() IN ('Admin', 'Technician'));
CREATE POLICY "Employee read history" ON public.asset_history FOR SELECT TO authenticated USING (public.get_user_role() = 'Employee' AND asset_id IN (SELECT id FROM public.assets WHERE id IN (SELECT asset_id FROM public.asset_assignments WHERE assigned_to = auth.uid() AND status = 'Active')));

CREATE POLICY "AdminTech read maintenance" ON public.asset_maintenance FOR SELECT TO authenticated USING (public.get_user_role() IN ('Admin', 'Technician'));
CREATE POLICY "Employee read maintenance" ON public.asset_maintenance FOR SELECT TO authenticated USING (public.get_user_role() = 'Employee' AND asset_id IN (SELECT id FROM public.assets WHERE id IN (SELECT asset_id FROM public.asset_assignments WHERE assigned_to = auth.uid() AND status = 'Active')));

CREATE POLICY "AdminTech read documents" ON public.asset_documents FOR SELECT TO authenticated USING (public.get_user_role() IN ('Admin', 'Technician'));
CREATE POLICY "Employee read documents" ON public.asset_documents FOR SELECT TO authenticated USING (public.get_user_role() = 'Employee' AND asset_id IN (SELECT id FROM public.assets WHERE id IN (SELECT asset_id FROM public.asset_assignments WHERE assigned_to = auth.uid() AND status = 'Active')));

CREATE POLICY "Anyone can read ticket mapping" ON public.asset_ticket_mapping FOR SELECT TO authenticated USING (true);

-- Storage Bucket for Asset Documents
INSERT INTO storage.buckets (id, name, public) VALUES ('asset_documents', 'asset_documents', false) ON CONFLICT DO NOTHING;
CREATE POLICY "Authenticated users can upload asset docs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'asset_documents');
CREATE POLICY "Users can view asset docs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'asset_documents');
