
-- =============================================
-- DROP ALL EXISTING POLICIES (all are RESTRICTIVE, which blocks everything)
-- =============================================

-- agenda_bloqueios
DROP POLICY IF EXISTS "Admins can manage agenda_bloqueios" ON public.agenda_bloqueios;
DROP POLICY IF EXISTS "Authenticated users can view agenda_bloqueios" ON public.agenda_bloqueios;

-- agendamentos
DROP POLICY IF EXISTS "Authenticated users can manage agendamentos" ON public.agendamentos;
DROP POLICY IF EXISTS "Authenticated users can view agendamentos" ON public.agendamentos;

-- barbeiros
DROP POLICY IF EXISTS "Admins can manage barbeiros" ON public.barbeiros;
DROP POLICY IF EXISTS "Authenticated users can view barbeiros" ON public.barbeiros;

-- campanhas
DROP POLICY IF EXISTS "Admins can manage campanhas" ON public.campanhas;
DROP POLICY IF EXISTS "Authenticated users can view campanhas" ON public.campanhas;

-- categorias
DROP POLICY IF EXISTS "Admins can manage categorias" ON public.categorias;
DROP POLICY IF EXISTS "Authenticated users can view categorias" ON public.categorias;

-- cliente_pontos
DROP POLICY IF EXISTS "Authenticated users can manage cliente_pontos" ON public.cliente_pontos;
DROP POLICY IF EXISTS "Authenticated users can view cliente_pontos" ON public.cliente_pontos;

-- clientes
DROP POLICY IF EXISTS "Authenticated users can manage clientes" ON public.clientes;
DROP POLICY IF EXISTS "Authenticated users can view clientes" ON public.clientes;

-- comanda_itens
DROP POLICY IF EXISTS "Authenticated users can manage comanda_itens" ON public.comanda_itens;
DROP POLICY IF EXISTS "Authenticated users can view comanda_itens" ON public.comanda_itens;

-- comandas
DROP POLICY IF EXISTS "Authenticated users can manage comandas" ON public.comandas;
DROP POLICY IF EXISTS "Authenticated users can view comandas" ON public.comandas;

-- convites
DROP POLICY IF EXISTS "Admins can manage convites" ON public.convites;
DROP POLICY IF EXISTS "Authenticated users can view convites" ON public.convites;

-- crm_interacoes
DROP POLICY IF EXISTS "Authenticated users can manage crm_interacoes" ON public.crm_interacoes;
DROP POLICY IF EXISTS "Authenticated users can view crm_interacoes" ON public.crm_interacoes;

-- cupons
DROP POLICY IF EXISTS "Admins can manage cupons" ON public.cupons;
DROP POLICY IF EXISTS "Authenticated users can view cupons" ON public.cupons;

-- empresa_config
DROP POLICY IF EXISTS "Admins can manage empresa_config" ON public.empresa_config;
DROP POLICY IF EXISTS "Authenticated users can insert empresa_config" ON public.empresa_config;
DROP POLICY IF EXISTS "Authenticated users can update empresa_config" ON public.empresa_config;
DROP POLICY IF EXISTS "Authenticated users can view empresa_config" ON public.empresa_config;

-- estoque_movimentacoes
DROP POLICY IF EXISTS "Authenticated users can insert movimentacoes" ON public.estoque_movimentacoes;
DROP POLICY IF EXISTS "Authenticated users can view movimentacoes" ON public.estoque_movimentacoes;

-- horarios_funcionamento
DROP POLICY IF EXISTS "Admins can manage horarios_funcionamento" ON public.horarios_funcionamento;
DROP POLICY IF EXISTS "Authenticated users can view horarios_funcionamento" ON public.horarios_funcionamento;

-- perfil_permissoes
DROP POLICY IF EXISTS "Admins can manage perfil_permissoes" ON public.perfil_permissoes;
DROP POLICY IF EXISTS "Authenticated users can view perfil_permissoes" ON public.perfil_permissoes;

-- perfis_acesso
DROP POLICY IF EXISTS "Admins can manage perfis_acesso" ON public.perfis_acesso;
DROP POLICY IF EXISTS "Authenticated users can view perfis_acesso" ON public.perfis_acesso;

-- planos_fidelidade
DROP POLICY IF EXISTS "Admins can manage planos_fidelidade" ON public.planos_fidelidade;
DROP POLICY IF EXISTS "Authenticated users can view planos_fidelidade" ON public.planos_fidelidade;

-- produtos
DROP POLICY IF EXISTS "Admins can manage produtos" ON public.produtos;
DROP POLICY IF EXISTS "Authenticated users can view produtos" ON public.produtos;

-- profiles
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- servicos
DROP POLICY IF EXISTS "Admins can manage servicos" ON public.servicos;
DROP POLICY IF EXISTS "Authenticated users can view servicos" ON public.servicos;

-- unidades
DROP POLICY IF EXISTS "Admins can manage unidades" ON public.unidades;
DROP POLICY IF EXISTS "Authenticated users can view unidades" ON public.unidades;

-- user_roles
DROP POLICY IF EXISTS "Admins can manage user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

-- =============================================
-- RECREATE ALL POLICIES AS PERMISSIVE (default)
-- With proper security: admin/manager for writes, authenticated for reads
-- =============================================

-- === agenda_bloqueios ===
CREATE POLICY "agenda_bloqueios_select" ON public.agenda_bloqueios
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "agenda_bloqueios_insert" ON public.agenda_bloqueios
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "agenda_bloqueios_update" ON public.agenda_bloqueios
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "agenda_bloqueios_delete" ON public.agenda_bloqueios
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- === agendamentos ===
CREATE POLICY "agendamentos_select" ON public.agendamentos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "agendamentos_insert" ON public.agendamentos
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "agendamentos_update" ON public.agendamentos
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "agendamentos_delete" ON public.agendamentos
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- === barbeiros ===
CREATE POLICY "barbeiros_select" ON public.barbeiros
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "barbeiros_insert" ON public.barbeiros
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "barbeiros_update" ON public.barbeiros
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "barbeiros_delete" ON public.barbeiros
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- === campanhas ===
CREATE POLICY "campanhas_select" ON public.campanhas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "campanhas_insert" ON public.campanhas
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "campanhas_update" ON public.campanhas
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "campanhas_delete" ON public.campanhas
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- === categorias ===
CREATE POLICY "categorias_select" ON public.categorias
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "categorias_insert" ON public.categorias
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "categorias_update" ON public.categorias
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "categorias_delete" ON public.categorias
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- === cliente_pontos ===
CREATE POLICY "cliente_pontos_select" ON public.cliente_pontos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "cliente_pontos_insert" ON public.cliente_pontos
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "cliente_pontos_update" ON public.cliente_pontos
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "cliente_pontos_delete" ON public.cliente_pontos
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- === clientes ===
CREATE POLICY "clientes_select" ON public.clientes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "clientes_insert" ON public.clientes
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "clientes_update" ON public.clientes
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "clientes_delete" ON public.clientes
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- === comanda_itens ===
CREATE POLICY "comanda_itens_select" ON public.comanda_itens
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "comanda_itens_insert" ON public.comanda_itens
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "comanda_itens_update" ON public.comanda_itens
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "comanda_itens_delete" ON public.comanda_itens
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- === comandas ===
CREATE POLICY "comandas_select" ON public.comandas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "comandas_insert" ON public.comandas
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "comandas_update" ON public.comandas
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "comandas_delete" ON public.comandas
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- === convites ===
CREATE POLICY "convites_select" ON public.convites
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "convites_insert" ON public.convites
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "convites_update" ON public.convites
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "convites_delete" ON public.convites
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- === crm_interacoes ===
CREATE POLICY "crm_interacoes_select" ON public.crm_interacoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "crm_interacoes_insert" ON public.crm_interacoes
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "crm_interacoes_update" ON public.crm_interacoes
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "crm_interacoes_delete" ON public.crm_interacoes
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- === cupons ===
CREATE POLICY "cupons_select" ON public.cupons
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "cupons_insert" ON public.cupons
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "cupons_update" ON public.cupons
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "cupons_delete" ON public.cupons
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- === empresa_config ===
CREATE POLICY "empresa_config_select" ON public.empresa_config
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "empresa_config_insert" ON public.empresa_config
  FOR INSERT TO authenticated
  WITH CHECK (NOT EXISTS (SELECT 1 FROM empresa_config));

CREATE POLICY "empresa_config_update" ON public.empresa_config
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- === estoque_movimentacoes ===
CREATE POLICY "estoque_movimentacoes_select" ON public.estoque_movimentacoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "estoque_movimentacoes_insert" ON public.estoque_movimentacoes
  FOR INSERT TO authenticated WITH CHECK (true);

-- === horarios_funcionamento ===
CREATE POLICY "horarios_funcionamento_select" ON public.horarios_funcionamento
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "horarios_funcionamento_insert" ON public.horarios_funcionamento
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "horarios_funcionamento_update" ON public.horarios_funcionamento
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "horarios_funcionamento_delete" ON public.horarios_funcionamento
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- === perfil_permissoes ===
CREATE POLICY "perfil_permissoes_select" ON public.perfil_permissoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "perfil_permissoes_insert" ON public.perfil_permissoes
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "perfil_permissoes_update" ON public.perfil_permissoes
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "perfil_permissoes_delete" ON public.perfil_permissoes
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- === perfis_acesso ===
CREATE POLICY "perfis_acesso_select" ON public.perfis_acesso
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "perfis_acesso_insert" ON public.perfis_acesso
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "perfis_acesso_update" ON public.perfis_acesso
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "perfis_acesso_delete" ON public.perfis_acesso
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- === planos_fidelidade ===
CREATE POLICY "planos_fidelidade_select" ON public.planos_fidelidade
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "planos_fidelidade_insert" ON public.planos_fidelidade
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "planos_fidelidade_update" ON public.planos_fidelidade
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "planos_fidelidade_delete" ON public.planos_fidelidade
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- === produtos ===
CREATE POLICY "produtos_select" ON public.produtos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "produtos_insert" ON public.produtos
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "produtos_update" ON public.produtos
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "produtos_delete" ON public.produtos
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- === profiles ===
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- === servicos ===
CREATE POLICY "servicos_select" ON public.servicos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "servicos_insert" ON public.servicos
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "servicos_update" ON public.servicos
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "servicos_delete" ON public.servicos
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- === unidades ===
CREATE POLICY "unidades_select" ON public.unidades
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "unidades_insert" ON public.unidades
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "unidades_update" ON public.unidades
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "unidades_delete" ON public.unidades
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- === user_roles ===
CREATE POLICY "user_roles_select" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "user_roles_insert" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "user_roles_update" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "user_roles_delete" ON public.user_roles
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));
