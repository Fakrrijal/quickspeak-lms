-- S10.2 Student Core Ebook Foundation
-- Heyzine URLs are stored as external viewer/source references only.

CREATE TABLE public.ebooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level_id UUID NOT NULL
        REFERENCES public.levels(id)
        ON DELETE RESTRICT,
    title TEXT NOT NULL,
    heyzine_url TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ebooks_status_check
        CHECK (status IN ('draft', 'published', 'archived'))
);

CREATE UNIQUE INDEX ebooks_one_published_per_level
    ON public.ebooks (level_id)
    WHERE status = 'published';

CREATE TRIGGER ebooks_updated_at
    BEFORE UPDATE ON public.ebooks
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.ebooks ENABLE ROW LEVEL SECURITY;
