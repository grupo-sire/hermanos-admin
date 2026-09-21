
-- 1. Add unidade_id to estoque_movimentacoes for per-unit stock tracking
ALTER TABLE public.estoque_movimentacoes 
ADD COLUMN unidade_id uuid REFERENCES public.unidades(id);

-- 2. Create horarios_funcionamento table for day-by-day schedule per unit
CREATE TABLE public.horarios_funcionamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  dia_semana integer NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6), -- 0=domingo, 6=sábado
  horario_abertura time NOT NULL DEFAULT '09:00',
  horario_fechamento time NOT NULL DEFAULT '20:00',
  aberto boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(unidade_id, dia_semana)
);

ALTER TABLE public.horarios_funcionamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage horarios_funcionamento"
ON public.horarios_funcionamento FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Authenticated users can view horarios_funcionamento"
ON public.horarios_funcionamento FOR SELECT
USING (true);

-- 3. Create agenda_bloqueios table
CREATE TABLE public.agenda_bloqueios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbeiro_id uuid REFERENCES public.barbeiros(id) ON DELETE CASCADE,
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  tipo text NOT NULL, -- 'falta', 'almoco', 'compromisso'
  data_inicio timestamptz NOT NULL,
  data_fim timestamptz NOT NULL,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agenda_bloqueios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage agenda_bloqueios"
ON public.agenda_bloqueios FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Authenticated users can view agenda_bloqueios"
ON public.agenda_bloqueios FOR SELECT
USING (true);

-- 4. Create storage bucket for logos
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true);

CREATE POLICY "Anyone can view logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'logos');

CREATE POLICY "Admins can upload logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'logos' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')));

CREATE POLICY "Admins can update logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'logos' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')));

CREATE POLICY "Admins can delete logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'logos' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')));

-- 5. Add updated_at trigger for horarios_funcionamento
CREATE TRIGGER update_horarios_funcionamento_updated_at
BEFORE UPDATE ON public.horarios_funcionamento
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
