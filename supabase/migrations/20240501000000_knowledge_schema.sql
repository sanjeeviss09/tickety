-- Enums
CREATE TYPE article_status AS ENUM ('Draft', 'In Review', 'Published', 'Archived');
CREATE TYPE service_approval_type AS ENUM ('None', 'Manager', 'Department Head', 'IT Admin');
CREATE TYPE sop_status AS ENUM ('Draft', 'Active', 'Expired', 'Retired');

-- Knowledge Categories
CREATE TABLE public.knowledge_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER update_knowledge_categories_modtime BEFORE UPDATE ON public.knowledge_categories FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Knowledge Articles
CREATE TABLE public.knowledge_articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL, -- Rich text HTML
    excerpt TEXT,
    category_id UUID REFERENCES public.knowledge_categories(id) ON DELETE RESTRICT,
    status article_status NOT NULL DEFAULT 'Draft',
    author_id UUID REFERENCES auth.users(id) NOT NULL,
    approver_id UUID REFERENCES auth.users(id),
    published_at TIMESTAMPTZ,
    views_count INTEGER NOT NULL DEFAULT 0,
    helpful_count INTEGER NOT NULL DEFAULT 0,
    not_helpful_count INTEGER NOT NULL DEFAULT 0,
    allow_comments BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER update_knowledge_articles_modtime BEFORE UPDATE ON public.knowledge_articles FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- PostgreSQL Full Text Search Index for Articles
ALTER TABLE public.knowledge_articles ADD COLUMN fts tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'C')
) STORED;
CREATE INDEX knowledge_articles_fts_idx ON public.knowledge_articles USING GIN (fts);

-- Article Versions
CREATE TABLE public.article_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id UUID REFERENCES public.knowledge_articles(id) ON DELETE CASCADE NOT NULL,
    version_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    change_description TEXT,
    editor_id UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Article Tags
CREATE TABLE public.article_tags (
    article_id UUID REFERENCES public.knowledge_articles(id) ON DELETE CASCADE NOT NULL,
    tag TEXT NOT NULL,
    PRIMARY KEY (article_id, tag)
);

-- Article Comments
CREATE TABLE public.article_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id UUID REFERENCES public.knowledge_articles(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    content TEXT NOT NULL,
    parent_id UUID REFERENCES public.article_comments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER update_article_comments_modtime BEFORE UPDATE ON public.article_comments FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Article Ratings
CREATE TABLE public.article_ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id UUID REFERENCES public.knowledge_articles(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    is_helpful BOOLEAN NOT NULL,
    feedback TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(article_id, user_id)
);

-- Knowledge Search History
CREATE TABLE public.knowledge_search_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    search_query TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    results_count INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Service Catalog
CREATE TABLE public.service_catalog (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,
    category TEXT,
    approval_type service_approval_type NOT NULL DEFAULT 'None',
    sla_hours INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER update_service_catalog_modtime BEFORE UPDATE ON public.service_catalog FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Dynamic Form Fields for Services
CREATE TABLE public.dynamic_form_fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID REFERENCES public.service_catalog(id) ON DELETE CASCADE NOT NULL,
    field_name TEXT NOT NULL,
    field_label TEXT NOT NULL,
    field_type TEXT NOT NULL, -- 'Text', 'Number', 'Date', 'Dropdown', 'Checkbox', 'File', etc.
    is_required BOOLEAN NOT NULL DEFAULT false,
    options JSONB, -- For Dropdowns/Radios
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Service Requests (Extends tickets)
CREATE TABLE public.service_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL,
    service_id UUID REFERENCES public.service_catalog(id) ON DELETE RESTRICT NOT NULL,
    form_data JSONB NOT NULL,
    approval_status TEXT NOT NULL DEFAULT 'Pending',
    approver_id UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- FAQ Categories
CREATE TABLE public.faq_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- FAQs
CREATE TABLE public.faqs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES public.faq_categories(id) ON DELETE RESTRICT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    is_published BOOLEAN NOT NULL DEFAULT true,
    popularity_score INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER update_faqs_modtime BEFORE UPDATE ON public.faqs FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- SOP Documents
CREATE TABLE public.sop_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    department_id UUID REFERENCES public.departments(id),
    status sop_status NOT NULL DEFAULT 'Draft',
    storage_path TEXT NOT NULL,
    expiry_date TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER update_sop_documents_modtime BEFORE UPDATE ON public.sop_documents FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- SOP Download History
CREATE TABLE public.download_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_type TEXT NOT NULL, -- 'SOP' or 'ArticleAttachment'
    document_id UUID NOT NULL,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    downloaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Alter Tickets Table to support article references
ALTER TABLE public.tickets ADD COLUMN resolved_by_article_id UUID REFERENCES public.knowledge_articles(id) ON DELETE SET NULL;

-- Seed Default Knowledge Categories
INSERT INTO public.knowledge_categories (name, description, icon) VALUES
    ('Hardware', 'Desktop, Laptop, Monitors, and Accessories', 'Monitor'),
    ('Software', 'Application installations and troubleshooting', 'AppWindow'),
    ('Network & VPN', 'Connectivity and Remote Access', 'Wifi'),
    ('Email', 'Outlook, Exchange, and Mailing Lists', 'Mail'),
    ('Security', 'Passwords, 2FA, and Policies', 'ShieldCheck'),
    ('HR & Finance Systems', 'ERP, Payroll, and Leave Management', 'Briefcase'),
    ('General Policies', 'IT Guidelines and Company Policies', 'FileText');

-- Seed FAQ Categories
INSERT INTO public.faq_categories (name, order_index) VALUES
    ('Account & Login', 1),
    ('Hardware Support', 2),
    ('Software & Apps', 3),
    ('Network & WiFi', 4);

-- RLS Policies
ALTER TABLE public.knowledge_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynamic_form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sop_documents ENABLE ROW LEVEL SECURITY;

-- Employee Access (Read Published Content)
CREATE POLICY "Employees can read active categories" ON public.knowledge_categories FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Employees can read published articles" ON public.knowledge_articles FOR SELECT TO authenticated USING (status = 'Published');
CREATE POLICY "Employees can read article tags" ON public.article_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Employees can read active services" ON public.service_catalog FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Employees can read form fields" ON public.dynamic_form_fields FOR SELECT TO authenticated USING (true);
CREATE POLICY "Employees can read faq categories" ON public.faq_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Employees can read published faqs" ON public.faqs FOR SELECT TO authenticated USING (is_published = true);
CREATE POLICY "Employees can read active sops" ON public.sop_documents FOR SELECT TO authenticated USING (status = 'Active');
CREATE POLICY "Employees can read article comments" ON public.article_comments FOR SELECT TO authenticated USING (true);

-- Employee Interactions
CREATE POLICY "Employees can insert comments" ON public.article_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Employees can update own comments" ON public.article_comments FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Employees can delete own comments" ON public.article_comments FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Employees can insert ratings" ON public.article_ratings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Employees can update own ratings" ON public.article_ratings FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Admin / Tech Access
CREATE POLICY "Techs and Admins have full access to articles" ON public.knowledge_articles FOR ALL TO authenticated USING (public.get_user_role() IN ('Admin', 'Technician'));
CREATE POLICY "Admins have full access to categories" ON public.knowledge_categories FOR ALL TO authenticated USING (public.get_user_role() = 'Admin');
CREATE POLICY "Techs and Admins can see versions" ON public.article_versions FOR ALL TO authenticated USING (public.get_user_role() IN ('Admin', 'Technician'));
CREATE POLICY "Admins have full access to services" ON public.service_catalog FOR ALL TO authenticated USING (public.get_user_role() = 'Admin');
CREATE POLICY "Admins have full access to form fields" ON public.dynamic_form_fields FOR ALL TO authenticated USING (public.get_user_role() = 'Admin');
CREATE POLICY "Admins have full access to faqs" ON public.faqs FOR ALL TO authenticated USING (public.get_user_role() = 'Admin');
CREATE POLICY "Admins have full access to faq categories" ON public.faq_categories FOR ALL TO authenticated USING (public.get_user_role() = 'Admin');
CREATE POLICY "Admins have full access to sops" ON public.sop_documents FOR ALL TO authenticated USING (public.get_user_role() = 'Admin');

-- Storage Buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('knowledge_attachments', 'knowledge_attachments', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('sop_documents', 'sop_documents', false) ON CONFLICT DO NOTHING;

CREATE POLICY "Authenticated users can read knowledge attachments" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'knowledge_attachments');
CREATE POLICY "Admins and Techs can upload knowledge attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'knowledge_attachments' AND public.get_user_role() IN ('Admin', 'Technician'));

CREATE POLICY "Authenticated users can read sop documents" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'sop_documents');
CREATE POLICY "Admins can upload sop documents" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'sop_documents' AND public.get_user_role() = 'Admin');
