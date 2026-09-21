
-- Step 1: Add empresa_id columns first (tables planos/empresas already created by failed migration partial)
-- Check if tables exist, create only if needed

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'planos') THEN
    CREATE TABLE public.planos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      nome text NOT NULL, slug text NOT NULL UNIQUE, preco numeric NOT NULL DEFAULT 0,
      preco_original numeric, descricao text, ordem integer NOT NULL DEFAULT 0,
      ativo boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'empresas') THEN
    CREATE TABLE public.empresas (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      nome text NOT NULL, slug text UNIQUE, logo_url text, email text, telefone text, cnpj text,
      plano_id uuid REFERENCES public.planos(id), status text NOT NULL DEFAULT 'active',
      onboarding_completo boolean NOT NULL DEFAULT false, cor_primaria text DEFAULT '350 65% 33%',
      cor_nome text DEFAULT 'Vinho', tipo_estabelecimento text DEFAULT 'barbearia',
      permitir_escolha_profissional boolean DEFAULT true, endereco text, instagram text,
      facebook text, whatsapp text, horario_funcionamento text,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'plano_features') THEN
    CREATE TABLE public.plano_features (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      plano_id uuid NOT NULL REFERENCES public.planos(id) ON DELETE CASCADE,
      feature text NOT NULL, habilitado boolean NOT NULL DEFAULT false, limite integer,
      created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(plano_id, feature)
    );
    ALTER TABLE public.plano_features ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Add empresa_id columns to ALL tables FIRST
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.unidades ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.categorias ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.servicos ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.barbeiros ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.agendamento_servicos ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.agenda_bloqueios ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.comandas ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.comanda_itens ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.campanhas ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.campanha_envios ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.cupons ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.planos_fidelidade ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.cliente_pontos ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.horarios_funcionamento ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.crm_funil_estagios ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.crm_funil_clientes ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.crm_interacoes ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.estoque_movimentacoes ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.email_config ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.evolution_config ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.chatbot_fluxos ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.chatbot_flows ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.perfis_acesso ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.perfil_permissoes ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.convites ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.ads_metrics ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.whatsapp_conversas ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.whatsapp_mensagens ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);

-- NOW create helper functions (empresa_id column exists)
CREATE OR REPLACE FUNCTION public.get_user_empresa_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT empresa_id FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin')
$$;

CREATE OR REPLACE FUNCTION public.empresa_has_feature(_empresa_id uuid, _feature text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.plano_features pf
    JOIN public.empresas e ON e.plano_id = pf.plano_id
    WHERE e.id = _empresa_id AND pf.feature = _feature AND pf.habilitado = true
  )
$$;

-- RLS policies for new tables
CREATE POLICY "planos_select" ON public.planos FOR SELECT TO authenticated USING (true);
CREATE POLICY "planos_manage" ON public.planos FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "plano_features_select" ON public.plano_features FOR SELECT TO authenticated USING (true);
CREATE POLICY "plano_features_manage" ON public.plano_features FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "empresas_select" ON public.empresas FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR id IN (SELECT empresa_id FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "empresas_insert" ON public.empresas FOR INSERT TO authenticated WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY "empresas_update" ON public.empresas FOR UPDATE TO authenticated
  USING (is_super_admin(auth.uid()) OR id IN (SELECT empresa_id FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::app_role));
CREATE POLICY "empresas_delete" ON public.empresas FOR DELETE TO authenticated USING (is_super_admin(auth.uid()));

-- Update ALL business table RLS
DROP POLICY IF EXISTS "unidades_select" ON public.unidades;
CREATE POLICY "unidades_select" ON public.unidades FOR SELECT TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "unidades_insert" ON public.unidades;
CREATE POLICY "unidades_insert" ON public.unidades FOR INSERT TO authenticated WITH CHECK (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));
DROP POLICY IF EXISTS "unidades_update" ON public.unidades;
CREATE POLICY "unidades_update" ON public.unidades FOR UPDATE TO authenticated USING (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));
DROP POLICY IF EXISTS "unidades_delete" ON public.unidades;
CREATE POLICY "unidades_delete" ON public.unidades FOR DELETE TO authenticated USING (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));

DROP POLICY IF EXISTS "categorias_select" ON public.categorias;
CREATE POLICY "categorias_select" ON public.categorias FOR SELECT TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "categorias_insert" ON public.categorias;
CREATE POLICY "categorias_insert" ON public.categorias FOR INSERT TO authenticated WITH CHECK (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));
DROP POLICY IF EXISTS "categorias_update" ON public.categorias;
CREATE POLICY "categorias_update" ON public.categorias FOR UPDATE TO authenticated USING (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));
DROP POLICY IF EXISTS "categorias_delete" ON public.categorias;
CREATE POLICY "categorias_delete" ON public.categorias FOR DELETE TO authenticated USING (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));

DROP POLICY IF EXISTS "servicos_select" ON public.servicos;
CREATE POLICY "servicos_select" ON public.servicos FOR SELECT TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "servicos_insert" ON public.servicos;
CREATE POLICY "servicos_insert" ON public.servicos FOR INSERT TO authenticated WITH CHECK (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));
DROP POLICY IF EXISTS "servicos_update" ON public.servicos;
CREATE POLICY "servicos_update" ON public.servicos FOR UPDATE TO authenticated USING (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));
DROP POLICY IF EXISTS "servicos_delete" ON public.servicos;
CREATE POLICY "servicos_delete" ON public.servicos FOR DELETE TO authenticated USING (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));

DROP POLICY IF EXISTS "produtos_select" ON public.produtos;
CREATE POLICY "produtos_select" ON public.produtos FOR SELECT TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "produtos_insert" ON public.produtos;
CREATE POLICY "produtos_insert" ON public.produtos FOR INSERT TO authenticated WITH CHECK (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));
DROP POLICY IF EXISTS "produtos_update" ON public.produtos;
CREATE POLICY "produtos_update" ON public.produtos FOR UPDATE TO authenticated USING (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));
DROP POLICY IF EXISTS "produtos_delete" ON public.produtos;
CREATE POLICY "produtos_delete" ON public.produtos FOR DELETE TO authenticated USING (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));

DROP POLICY IF EXISTS "clientes_select" ON public.clientes;
CREATE POLICY "clientes_select" ON public.clientes FOR SELECT TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "clientes_insert" ON public.clientes;
CREATE POLICY "clientes_insert" ON public.clientes FOR INSERT TO authenticated WITH CHECK (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "clientes_update" ON public.clientes;
CREATE POLICY "clientes_update" ON public.clientes FOR UPDATE TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "clientes_delete" ON public.clientes;
CREATE POLICY "clientes_delete" ON public.clientes FOR DELETE TO authenticated USING (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));

DROP POLICY IF EXISTS "barbeiros_select" ON public.barbeiros;
CREATE POLICY "barbeiros_select" ON public.barbeiros FOR SELECT TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "barbeiros_insert" ON public.barbeiros;
CREATE POLICY "barbeiros_insert" ON public.barbeiros FOR INSERT TO authenticated WITH CHECK (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));
DROP POLICY IF EXISTS "barbeiros_update" ON public.barbeiros;
CREATE POLICY "barbeiros_update" ON public.barbeiros FOR UPDATE TO authenticated USING (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));
DROP POLICY IF EXISTS "barbeiros_delete" ON public.barbeiros;
CREATE POLICY "barbeiros_delete" ON public.barbeiros FOR DELETE TO authenticated USING (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));

DROP POLICY IF EXISTS "agendamentos_select" ON public.agendamentos;
CREATE POLICY "agendamentos_select" ON public.agendamentos FOR SELECT TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "agendamentos_insert" ON public.agendamentos;
CREATE POLICY "agendamentos_insert" ON public.agendamentos FOR INSERT TO authenticated WITH CHECK (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "agendamentos_update" ON public.agendamentos;
CREATE POLICY "agendamentos_update" ON public.agendamentos FOR UPDATE TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "agendamentos_delete" ON public.agendamentos;
CREATE POLICY "agendamentos_delete" ON public.agendamentos FOR DELETE TO authenticated USING (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));

DROP POLICY IF EXISTS "agendamento_servicos_select" ON public.agendamento_servicos;
CREATE POLICY "agendamento_servicos_select" ON public.agendamento_servicos FOR SELECT TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "agendamento_servicos_insert" ON public.agendamento_servicos;
CREATE POLICY "agendamento_servicos_insert" ON public.agendamento_servicos FOR INSERT TO authenticated WITH CHECK (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "agendamento_servicos_update" ON public.agendamento_servicos;
CREATE POLICY "agendamento_servicos_update" ON public.agendamento_servicos FOR UPDATE TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "agendamento_servicos_delete" ON public.agendamento_servicos;
CREATE POLICY "agendamento_servicos_delete" ON public.agendamento_servicos FOR DELETE TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "agenda_bloqueios_select" ON public.agenda_bloqueios;
CREATE POLICY "agenda_bloqueios_select" ON public.agenda_bloqueios FOR SELECT TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "agenda_bloqueios_insert" ON public.agenda_bloqueios;
CREATE POLICY "agenda_bloqueios_insert" ON public.agenda_bloqueios FOR INSERT TO authenticated WITH CHECK (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));
DROP POLICY IF EXISTS "agenda_bloqueios_update" ON public.agenda_bloqueios;
CREATE POLICY "agenda_bloqueios_update" ON public.agenda_bloqueios FOR UPDATE TO authenticated USING (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));
DROP POLICY IF EXISTS "agenda_bloqueios_delete" ON public.agenda_bloqueios;
CREATE POLICY "agenda_bloqueios_delete" ON public.agenda_bloqueios FOR DELETE TO authenticated USING (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));

DROP POLICY IF EXISTS "comandas_select" ON public.comandas;
CREATE POLICY "comandas_select" ON public.comandas FOR SELECT TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "comandas_insert" ON public.comandas;
CREATE POLICY "comandas_insert" ON public.comandas FOR INSERT TO authenticated WITH CHECK (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "comandas_update" ON public.comandas;
CREATE POLICY "comandas_update" ON public.comandas FOR UPDATE TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "comandas_delete" ON public.comandas;
CREATE POLICY "comandas_delete" ON public.comandas FOR DELETE TO authenticated USING (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));

DROP POLICY IF EXISTS "comanda_itens_select" ON public.comanda_itens;
CREATE POLICY "comanda_itens_select" ON public.comanda_itens FOR SELECT TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "comanda_itens_insert" ON public.comanda_itens;
CREATE POLICY "comanda_itens_insert" ON public.comanda_itens FOR INSERT TO authenticated WITH CHECK (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "comanda_itens_update" ON public.comanda_itens;
CREATE POLICY "comanda_itens_update" ON public.comanda_itens FOR UPDATE TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "comanda_itens_delete" ON public.comanda_itens;
CREATE POLICY "comanda_itens_delete" ON public.comanda_itens FOR DELETE TO authenticated USING (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));

DROP POLICY IF EXISTS "campanhas_select" ON public.campanhas;
CREATE POLICY "campanhas_select" ON public.campanhas FOR SELECT TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "campanhas_insert" ON public.campanhas;
CREATE POLICY "campanhas_insert" ON public.campanhas FOR INSERT TO authenticated WITH CHECK (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));
DROP POLICY IF EXISTS "campanhas_update" ON public.campanhas;
CREATE POLICY "campanhas_update" ON public.campanhas FOR UPDATE TO authenticated USING (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));
DROP POLICY IF EXISTS "campanhas_delete" ON public.campanhas;
CREATE POLICY "campanhas_delete" ON public.campanhas FOR DELETE TO authenticated USING (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));

DROP POLICY IF EXISTS "campanha_envios_select" ON public.campanha_envios;
CREATE POLICY "campanha_envios_select" ON public.campanha_envios FOR SELECT TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "campanha_envios_insert" ON public.campanha_envios;
CREATE POLICY "campanha_envios_insert" ON public.campanha_envios FOR INSERT TO authenticated WITH CHECK (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "campanha_envios_delete" ON public.campanha_envios;
CREATE POLICY "campanha_envios_delete" ON public.campanha_envios FOR DELETE TO authenticated USING (is_super_admin(auth.uid()) OR (has_role(auth.uid(), 'admin'::app_role) AND empresa_id = get_user_empresa_id(auth.uid())));

-- Remaining tables with same pattern
DROP POLICY IF EXISTS "cupons_select" ON public.cupons; CREATE POLICY "cupons_select" ON public.cupons FOR SELECT TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "cupons_insert" ON public.cupons; CREATE POLICY "cupons_insert" ON public.cupons FOR INSERT TO authenticated WITH CHECK (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));
DROP POLICY IF EXISTS "cupons_update" ON public.cupons; CREATE POLICY "cupons_update" ON public.cupons FOR UPDATE TO authenticated USING (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));
DROP POLICY IF EXISTS "cupons_delete" ON public.cupons; CREATE POLICY "cupons_delete" ON public.cupons FOR DELETE TO authenticated USING (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));

DROP POLICY IF EXISTS "planos_fidelidade_select" ON public.planos_fidelidade; CREATE POLICY "planos_fidelidade_select" ON public.planos_fidelidade FOR SELECT TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "planos_fidelidade_insert" ON public.planos_fidelidade; CREATE POLICY "planos_fidelidade_insert" ON public.planos_fidelidade FOR INSERT TO authenticated WITH CHECK (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));
DROP POLICY IF EXISTS "planos_fidelidade_update" ON public.planos_fidelidade; CREATE POLICY "planos_fidelidade_update" ON public.planos_fidelidade FOR UPDATE TO authenticated USING (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));
DROP POLICY IF EXISTS "planos_fidelidade_delete" ON public.planos_fidelidade; CREATE POLICY "planos_fidelidade_delete" ON public.planos_fidelidade FOR DELETE TO authenticated USING (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));

DROP POLICY IF EXISTS "cliente_pontos_select" ON public.cliente_pontos; CREATE POLICY "cliente_pontos_select" ON public.cliente_pontos FOR SELECT TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "cliente_pontos_insert" ON public.cliente_pontos; CREATE POLICY "cliente_pontos_insert" ON public.cliente_pontos FOR INSERT TO authenticated WITH CHECK (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "cliente_pontos_update" ON public.cliente_pontos; CREATE POLICY "cliente_pontos_update" ON public.cliente_pontos FOR UPDATE TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "cliente_pontos_delete" ON public.cliente_pontos; CREATE POLICY "cliente_pontos_delete" ON public.cliente_pontos FOR DELETE TO authenticated USING (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));

DROP POLICY IF EXISTS "horarios_funcionamento_select" ON public.horarios_funcionamento; CREATE POLICY "horarios_funcionamento_select" ON public.horarios_funcionamento FOR SELECT TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "horarios_funcionamento_insert" ON public.horarios_funcionamento; CREATE POLICY "horarios_funcionamento_insert" ON public.horarios_funcionamento FOR INSERT TO authenticated WITH CHECK (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));
DROP POLICY IF EXISTS "horarios_funcionamento_update" ON public.horarios_funcionamento; CREATE POLICY "horarios_funcionamento_update" ON public.horarios_funcionamento FOR UPDATE TO authenticated USING (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));
DROP POLICY IF EXISTS "horarios_funcionamento_delete" ON public.horarios_funcionamento; CREATE POLICY "horarios_funcionamento_delete" ON public.horarios_funcionamento FOR DELETE TO authenticated USING (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));

DROP POLICY IF EXISTS "crm_funil_estagios_select" ON public.crm_funil_estagios; CREATE POLICY "crm_funil_estagios_select" ON public.crm_funil_estagios FOR SELECT TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "crm_funil_estagios_insert" ON public.crm_funil_estagios; CREATE POLICY "crm_funil_estagios_insert" ON public.crm_funil_estagios FOR INSERT TO authenticated WITH CHECK (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));
DROP POLICY IF EXISTS "crm_funil_estagios_update" ON public.crm_funil_estagios; CREATE POLICY "crm_funil_estagios_update" ON public.crm_funil_estagios FOR UPDATE TO authenticated USING (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));
DROP POLICY IF EXISTS "crm_funil_estagios_delete" ON public.crm_funil_estagios; CREATE POLICY "crm_funil_estagios_delete" ON public.crm_funil_estagios FOR DELETE TO authenticated USING (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));

DROP POLICY IF EXISTS "crm_funil_clientes_select" ON public.crm_funil_clientes; CREATE POLICY "crm_funil_clientes_select" ON public.crm_funil_clientes FOR SELECT TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "crm_funil_clientes_insert" ON public.crm_funil_clientes; CREATE POLICY "crm_funil_clientes_insert" ON public.crm_funil_clientes FOR INSERT TO authenticated WITH CHECK (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "crm_funil_clientes_update" ON public.crm_funil_clientes; CREATE POLICY "crm_funil_clientes_update" ON public.crm_funil_clientes FOR UPDATE TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "crm_funil_clientes_delete" ON public.crm_funil_clientes; CREATE POLICY "crm_funil_clientes_delete" ON public.crm_funil_clientes FOR DELETE TO authenticated USING (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));

DROP POLICY IF EXISTS "crm_interacoes_select" ON public.crm_interacoes; CREATE POLICY "crm_interacoes_select" ON public.crm_interacoes FOR SELECT TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "crm_interacoes_insert" ON public.crm_interacoes; CREATE POLICY "crm_interacoes_insert" ON public.crm_interacoes FOR INSERT TO authenticated WITH CHECK (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "crm_interacoes_update" ON public.crm_interacoes; CREATE POLICY "crm_interacoes_update" ON public.crm_interacoes FOR UPDATE TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "crm_interacoes_delete" ON public.crm_interacoes; CREATE POLICY "crm_interacoes_delete" ON public.crm_interacoes FOR DELETE TO authenticated USING (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));

DROP POLICY IF EXISTS "estoque_movimentacoes_select" ON public.estoque_movimentacoes; CREATE POLICY "estoque_movimentacoes_select" ON public.estoque_movimentacoes FOR SELECT TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "estoque_movimentacoes_insert" ON public.estoque_movimentacoes; CREATE POLICY "estoque_movimentacoes_insert" ON public.estoque_movimentacoes FOR INSERT TO authenticated WITH CHECK (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "email_config_select" ON public.email_config; CREATE POLICY "email_config_select" ON public.email_config FOR SELECT TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "email_config_insert" ON public.email_config; CREATE POLICY "email_config_insert" ON public.email_config FOR INSERT TO authenticated WITH CHECK (is_super_admin(auth.uid()) OR (has_role(auth.uid(), 'admin'::app_role) AND empresa_id = get_user_empresa_id(auth.uid())));
DROP POLICY IF EXISTS "email_config_update" ON public.email_config; CREATE POLICY "email_config_update" ON public.email_config FOR UPDATE TO authenticated USING (is_super_admin(auth.uid()) OR (has_role(auth.uid(), 'admin'::app_role) AND empresa_id = get_user_empresa_id(auth.uid())));
DROP POLICY IF EXISTS "email_config_delete" ON public.email_config; CREATE POLICY "email_config_delete" ON public.email_config FOR DELETE TO authenticated USING (is_super_admin(auth.uid()) OR (has_role(auth.uid(), 'admin'::app_role) AND empresa_id = get_user_empresa_id(auth.uid())));

DROP POLICY IF EXISTS "evolution_config_select" ON public.evolution_config; CREATE POLICY "evolution_config_select" ON public.evolution_config FOR SELECT TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "evolution_config_insert" ON public.evolution_config; CREATE POLICY "evolution_config_insert" ON public.evolution_config FOR INSERT TO authenticated WITH CHECK (is_super_admin(auth.uid()) OR (has_role(auth.uid(), 'admin'::app_role) AND empresa_id = get_user_empresa_id(auth.uid())));
DROP POLICY IF EXISTS "evolution_config_update" ON public.evolution_config; CREATE POLICY "evolution_config_update" ON public.evolution_config FOR UPDATE TO authenticated USING (is_super_admin(auth.uid()) OR (has_role(auth.uid(), 'admin'::app_role) AND empresa_id = get_user_empresa_id(auth.uid())));
DROP POLICY IF EXISTS "evolution_config_delete" ON public.evolution_config; CREATE POLICY "evolution_config_delete" ON public.evolution_config FOR DELETE TO authenticated USING (is_super_admin(auth.uid()) OR (has_role(auth.uid(), 'admin'::app_role) AND empresa_id = get_user_empresa_id(auth.uid())));

DROP POLICY IF EXISTS "chatbot_fluxos_select" ON public.chatbot_fluxos; CREATE POLICY "chatbot_fluxos_select" ON public.chatbot_fluxos FOR SELECT TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "chatbot_fluxos_insert" ON public.chatbot_fluxos; CREATE POLICY "chatbot_fluxos_insert" ON public.chatbot_fluxos FOR INSERT TO authenticated WITH CHECK (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));
DROP POLICY IF EXISTS "chatbot_fluxos_update" ON public.chatbot_fluxos; CREATE POLICY "chatbot_fluxos_update" ON public.chatbot_fluxos FOR UPDATE TO authenticated USING (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));
DROP POLICY IF EXISTS "chatbot_fluxos_delete" ON public.chatbot_fluxos; CREATE POLICY "chatbot_fluxos_delete" ON public.chatbot_fluxos FOR DELETE TO authenticated USING (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));

DROP POLICY IF EXISTS "chatbot_flows_select" ON public.chatbot_flows; CREATE POLICY "chatbot_flows_select" ON public.chatbot_flows FOR SELECT TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "chatbot_flows_insert" ON public.chatbot_flows; CREATE POLICY "chatbot_flows_insert" ON public.chatbot_flows FOR INSERT TO authenticated WITH CHECK (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));
DROP POLICY IF EXISTS "chatbot_flows_update" ON public.chatbot_flows; CREATE POLICY "chatbot_flows_update" ON public.chatbot_flows FOR UPDATE TO authenticated USING (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));
DROP POLICY IF EXISTS "chatbot_flows_delete" ON public.chatbot_flows; CREATE POLICY "chatbot_flows_delete" ON public.chatbot_flows FOR DELETE TO authenticated USING (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));

DROP POLICY IF EXISTS "perfis_acesso_select" ON public.perfis_acesso; CREATE POLICY "perfis_acesso_select" ON public.perfis_acesso FOR SELECT TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "perfis_acesso_insert" ON public.perfis_acesso; CREATE POLICY "perfis_acesso_insert" ON public.perfis_acesso FOR INSERT TO authenticated WITH CHECK (is_super_admin(auth.uid()) OR (has_role(auth.uid(), 'admin'::app_role) AND empresa_id = get_user_empresa_id(auth.uid())));
DROP POLICY IF EXISTS "perfis_acesso_update" ON public.perfis_acesso; CREATE POLICY "perfis_acesso_update" ON public.perfis_acesso FOR UPDATE TO authenticated USING (is_super_admin(auth.uid()) OR (has_role(auth.uid(), 'admin'::app_role) AND empresa_id = get_user_empresa_id(auth.uid())));
DROP POLICY IF EXISTS "perfis_acesso_delete" ON public.perfis_acesso; CREATE POLICY "perfis_acesso_delete" ON public.perfis_acesso FOR DELETE TO authenticated USING (is_super_admin(auth.uid()) OR (has_role(auth.uid(), 'admin'::app_role) AND empresa_id = get_user_empresa_id(auth.uid())));

DROP POLICY IF EXISTS "perfil_permissoes_select" ON public.perfil_permissoes; CREATE POLICY "perfil_permissoes_select" ON public.perfil_permissoes FOR SELECT TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "perfil_permissoes_insert" ON public.perfil_permissoes; CREATE POLICY "perfil_permissoes_insert" ON public.perfil_permissoes FOR INSERT TO authenticated WITH CHECK (is_super_admin(auth.uid()) OR (has_role(auth.uid(), 'admin'::app_role) AND empresa_id = get_user_empresa_id(auth.uid())));
DROP POLICY IF EXISTS "perfil_permissoes_update" ON public.perfil_permissoes; CREATE POLICY "perfil_permissoes_update" ON public.perfil_permissoes FOR UPDATE TO authenticated USING (is_super_admin(auth.uid()) OR (has_role(auth.uid(), 'admin'::app_role) AND empresa_id = get_user_empresa_id(auth.uid())));
DROP POLICY IF EXISTS "perfil_permissoes_delete" ON public.perfil_permissoes; CREATE POLICY "perfil_permissoes_delete" ON public.perfil_permissoes FOR DELETE TO authenticated USING (is_super_admin(auth.uid()) OR (has_role(auth.uid(), 'admin'::app_role) AND empresa_id = get_user_empresa_id(auth.uid())));

DROP POLICY IF EXISTS "convites_select" ON public.convites; CREATE POLICY "convites_select" ON public.convites FOR SELECT TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "convites_insert" ON public.convites; CREATE POLICY "convites_insert" ON public.convites FOR INSERT TO authenticated WITH CHECK (is_super_admin(auth.uid()) OR (has_role(auth.uid(), 'admin'::app_role) AND empresa_id = get_user_empresa_id(auth.uid())));
DROP POLICY IF EXISTS "convites_update" ON public.convites; CREATE POLICY "convites_update" ON public.convites FOR UPDATE TO authenticated USING (is_super_admin(auth.uid()) OR (has_role(auth.uid(), 'admin'::app_role) AND empresa_id = get_user_empresa_id(auth.uid())));
DROP POLICY IF EXISTS "convites_delete" ON public.convites; CREATE POLICY "convites_delete" ON public.convites FOR DELETE TO authenticated USING (is_super_admin(auth.uid()) OR (has_role(auth.uid(), 'admin'::app_role) AND empresa_id = get_user_empresa_id(auth.uid())));

DROP POLICY IF EXISTS "ads_metrics_select" ON public.ads_metrics; CREATE POLICY "ads_metrics_select" ON public.ads_metrics FOR SELECT TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "ads_metrics_insert" ON public.ads_metrics; CREATE POLICY "ads_metrics_insert" ON public.ads_metrics FOR INSERT TO authenticated WITH CHECK (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "ads_metrics_update" ON public.ads_metrics; CREATE POLICY "ads_metrics_update" ON public.ads_metrics FOR UPDATE TO authenticated USING (is_super_admin(auth.uid()) OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND empresa_id = get_user_empresa_id(auth.uid())));
DROP POLICY IF EXISTS "ads_metrics_delete" ON public.ads_metrics; CREATE POLICY "ads_metrics_delete" ON public.ads_metrics FOR DELETE TO authenticated USING (is_super_admin(auth.uid()) OR (has_role(auth.uid(), 'admin'::app_role) AND empresa_id = get_user_empresa_id(auth.uid())));

DROP POLICY IF EXISTS "whatsapp_conversas_select" ON public.whatsapp_conversas; CREATE POLICY "whatsapp_conversas_select" ON public.whatsapp_conversas FOR SELECT TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "whatsapp_conversas_insert" ON public.whatsapp_conversas; CREATE POLICY "whatsapp_conversas_insert" ON public.whatsapp_conversas FOR INSERT TO authenticated WITH CHECK (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "whatsapp_conversas_update" ON public.whatsapp_conversas; CREATE POLICY "whatsapp_conversas_update" ON public.whatsapp_conversas FOR UPDATE TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "whatsapp_conversas_delete" ON public.whatsapp_conversas; CREATE POLICY "whatsapp_conversas_delete" ON public.whatsapp_conversas FOR DELETE TO authenticated USING (is_super_admin(auth.uid()) OR (has_role(auth.uid(), 'admin'::app_role) AND empresa_id = get_user_empresa_id(auth.uid())));

DROP POLICY IF EXISTS "whatsapp_mensagens_select" ON public.whatsapp_mensagens; CREATE POLICY "whatsapp_mensagens_select" ON public.whatsapp_mensagens FOR SELECT TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "whatsapp_mensagens_insert" ON public.whatsapp_mensagens; CREATE POLICY "whatsapp_mensagens_insert" ON public.whatsapp_mensagens FOR INSERT TO authenticated WITH CHECK (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "whatsapp_mensagens_update" ON public.whatsapp_mensagens; CREATE POLICY "whatsapp_mensagens_update" ON public.whatsapp_mensagens FOR UPDATE TO authenticated USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "whatsapp_mensagens_delete" ON public.whatsapp_mensagens; CREATE POLICY "whatsapp_mensagens_delete" ON public.whatsapp_mensagens FOR DELETE TO authenticated USING (is_super_admin(auth.uid()) OR (has_role(auth.uid(), 'admin'::app_role) AND empresa_id = get_user_empresa_id(auth.uid())));

-- user_roles RLS
DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR user_id = auth.uid() OR (has_role(auth.uid(), 'admin'::app_role) AND empresa_id = get_user_empresa_id(auth.uid())));
DROP POLICY IF EXISTS "user_roles_insert" ON public.user_roles;
CREATE POLICY "user_roles_insert" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (is_super_admin(auth.uid()) OR (has_role(auth.uid(), 'admin'::app_role) AND empresa_id = get_user_empresa_id(auth.uid())));
DROP POLICY IF EXISTS "user_roles_update" ON public.user_roles;
CREATE POLICY "user_roles_update" ON public.user_roles FOR UPDATE TO authenticated
  USING (is_super_admin(auth.uid()) OR (has_role(auth.uid(), 'admin'::app_role) AND empresa_id = get_user_empresa_id(auth.uid())));
DROP POLICY IF EXISTS "user_roles_delete" ON public.user_roles;
CREATE POLICY "user_roles_delete" ON public.user_roles FOR DELETE TO authenticated
  USING (is_super_admin(auth.uid()) OR (has_role(auth.uid(), 'admin'::app_role) AND empresa_id = get_user_empresa_id(auth.uid())));

-- empresa_config + profiles RLS
DROP POLICY IF EXISTS "empresa_config_select" ON public.empresa_config;
CREATE POLICY "empresa_config_select" ON public.empresa_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "empresa_config_insert" ON public.empresa_config;
CREATE POLICY "empresa_config_insert" ON public.empresa_config FOR INSERT TO authenticated WITH CHECK (is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "empresa_config_update" ON public.empresa_config;
CREATE POLICY "empresa_config_update" ON public.empresa_config FOR UPDATE TO authenticated USING (is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- Insert plans
INSERT INTO public.planos (nome, slug, preco, preco_original, descricao, ordem) VALUES
  ('X', 'x', 600, 1200, 'Sistema básico', 1),
  ('X - PRO', 'x-pro', 1200, 2000, 'Sistema PRO', 2),
  ('X - MAX', 'x-max', 3500, 3500, 'Sistema MAX completo', 3);

-- Insert features
DO $$
DECLARE v_x uuid; v_pro uuid; v_max uuid;
BEGIN
  SELECT id INTO v_x FROM public.planos WHERE slug = 'x';
  SELECT id INTO v_pro FROM public.planos WHERE slug = 'x-pro';
  SELECT id INTO v_max FROM public.planos WHERE slug = 'x-max';
  INSERT INTO public.plano_features (plano_id, feature, habilitado) VALUES
    (v_x,'agenda',true),(v_x,'clientes',true),(v_x,'servicos',true),(v_x,'produtos',true),(v_x,'barbeiros',true),(v_x,'checkout',true),(v_x,'whatsapp',true),
    (v_x,'estoque',false),(v_x,'fidelidade',false),(v_x,'campanhas',false),(v_x,'crm',false),(v_x,'anuncios',false),(v_x,'unidades',false),(v_x,'site',false),(v_x,'assistente_ia',false),(v_x,'chatbot',false),(v_x,'relatorios',false),
    (v_pro,'agenda',true),(v_pro,'clientes',true),(v_pro,'servicos',true),(v_pro,'produtos',true),(v_pro,'barbeiros',true),(v_pro,'checkout',true),(v_pro,'whatsapp',true),
    (v_pro,'estoque',true),(v_pro,'fidelidade',true),(v_pro,'campanhas',true),(v_pro,'crm',false),(v_pro,'anuncios',false),(v_pro,'unidades',false),(v_pro,'site',false),(v_pro,'assistente_ia',false),(v_pro,'chatbot',true),(v_pro,'relatorios',true),
    (v_max,'agenda',true),(v_max,'clientes',true),(v_max,'servicos',true),(v_max,'produtos',true),(v_max,'barbeiros',true),(v_max,'checkout',true),(v_max,'whatsapp',true),
    (v_max,'estoque',true),(v_max,'fidelidade',true),(v_max,'campanhas',true),(v_max,'crm',true),(v_max,'anuncios',true),(v_max,'unidades',true),(v_max,'site',true),(v_max,'assistente_ia',true),(v_max,'chatbot',true),(v_max,'relatorios',true);
END $$;

-- Triggers and indexes
CREATE TRIGGER update_planos_updated_at BEFORE UPDATE ON public.planos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_empresas_updated_at BEFORE UPDATE ON public.empresas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_user_roles_empresa ON public.user_roles(empresa_id);
CREATE INDEX IF NOT EXISTS idx_unidades_empresa ON public.unidades(empresa_id);
CREATE INDEX IF NOT EXISTS idx_barbeiros_empresa ON public.barbeiros(empresa_id);
CREATE INDEX IF NOT EXISTS idx_clientes_empresa ON public.clientes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_empresa ON public.agendamentos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_servicos_empresa ON public.servicos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_produtos_empresa ON public.produtos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_comandas_empresa ON public.comandas(empresa_id);
