-- Migration: Add modo_v01_booksy and prompt_v01_booksy to public.agentes_ia
ALTER TABLE public.agentes_ia ADD COLUMN IF NOT EXISTS modo_v01_booksy boolean DEFAULT false;
ALTER TABLE public.agentes_ia ADD COLUMN IF NOT EXISTS prompt_v01_booksy text;

