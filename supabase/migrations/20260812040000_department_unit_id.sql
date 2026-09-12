-- Add unit_id to departments table
ALTER TABLE public.departments ADD COLUMN unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL;
