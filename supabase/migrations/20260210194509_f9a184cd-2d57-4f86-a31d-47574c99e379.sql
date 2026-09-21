
-- Junction table for multiple services per appointment
CREATE TABLE public.agendamento_servicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agendamento_id UUID NOT NULL REFERENCES public.agendamentos(id) ON DELETE CASCADE,
  servico_id UUID NOT NULL REFERENCES public.servicos(id),
  nome TEXT NOT NULL,
  preco NUMERIC NOT NULL,
  duracao_minutos INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.agendamento_servicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view agendamento_servicos" ON public.agendamento_servicos FOR SELECT USING (true);
CREATE POLICY "Users can insert agendamento_servicos" ON public.agendamento_servicos FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update agendamento_servicos" ON public.agendamento_servicos FOR UPDATE USING (true);
CREATE POLICY "Users can delete agendamento_servicos" ON public.agendamento_servicos FOR DELETE USING (true);

CREATE INDEX idx_agendamento_servicos_agendamento_id ON public.agendamento_servicos(agendamento_id);
