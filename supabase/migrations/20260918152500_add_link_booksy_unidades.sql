-- Migration: Add link_booksy to public.unidades
ALTER TABLE public.unidades ADD COLUMN IF NOT EXISTS link_booksy text;
