
-- Fix ALL RLS policies: change from RESTRICTIVE to PERMISSIVE
-- Drop all existing restrictive policies and recreate as permissive

-- ===================== profiles =====================
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- ===================== empresa_config =====================
DROP POLICY IF EXISTS "empresa_config_select" ON public.empresa_config;
DROP POLICY IF EXISTS "empresa_config_insert" ON public.empresa_config;
DROP POLICY IF EXISTS "empresa_config_update" ON public.empresa_config;

CREATE POLICY "empresa_config_select" ON public.empresa_config FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "empresa_config_insert" ON public.empresa_config FOR INSERT TO authenticated
  WITH CHECK (NOT EXISTS (SELECT 1 FROM empresa_config));
CREATE POLICY "empresa_config_update" ON public.empresa_config FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ===================== user_roles =====================
DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_insert" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_update" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_delete" ON public.user_roles;

CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "user_roles_insert" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "user_roles_update" ON public.user_roles FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "user_roles_delete" ON public.user_roles FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ===================== unidades =====================
DROP POLICY IF EXISTS "unidades_select" ON public.unidades;
DROP POLICY IF EXISTS "unidades_insert" ON public.unidades;
DROP POLICY IF EXISTS "unidades_update" ON public.unidades;
DROP POLICY IF EXISTS "unidades_delete" ON public.unidades;

CREATE POLICY "unidades_select" ON public.unidades FOR SELECT TO authenticated USING (true);
CREATE POLICY "unidades_insert" ON public.unidades FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "unidades_update" ON public.unidades FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "unidades_delete" ON public.unidades FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ===================== categorias =====================
DROP POLICY IF EXISTS "categorias_select" ON public.categorias;
DROP POLICY IF EXISTS "categorias_insert" ON public.categorias;
DROP POLICY IF EXISTS "categorias_update" ON public.categorias;
DROP POLICY IF EXISTS "categorias_delete" ON public.categorias;

CREATE POLICY "categorias_select" ON public.categorias FOR SELECT TO authenticated USING (true);
CREATE POLICY "categorias_insert" ON public.categorias FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "categorias_update" ON public.categorias FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "categorias_delete" ON public.categorias FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ===================== servicos =====================
DROP POLICY IF EXISTS "servicos_select" ON public.servicos;
DROP POLICY IF EXISTS "servicos_insert" ON public.servicos;
DROP POLICY IF EXISTS "servicos_update" ON public.servicos;
DROP POLICY IF EXISTS "servicos_delete" ON public.servicos;

CREATE POLICY "servicos_select" ON public.servicos FOR SELECT TO authenticated USING (true);
CREATE POLICY "servicos_insert" ON public.servicos FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "servicos_update" ON public.servicos FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "servicos_delete" ON public.servicos FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ===================== produtos =====================
DROP POLICY IF EXISTS "produtos_select" ON public.produtos;
DROP POLICY IF EXISTS "produtos_insert" ON public.produtos;
DROP POLICY IF EXISTS "produtos_update" ON public.produtos;
DROP POLICY IF EXISTS "produtos_delete" ON public.produtos;

CREATE POLICY "produtos_select" ON public.produtos FOR SELECT TO authenticated USING (true);
CREATE POLICY "produtos_insert" ON public.produtos FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "produtos_update" ON public.produtos FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "produtos_delete" ON public.produtos FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ===================== clientes =====================
DROP POLICY IF EXISTS "clientes_select" ON public.clientes;
DROP POLICY IF EXISTS "clientes_insert" ON public.clientes;
DROP POLICY IF EXISTS "clientes_update" ON public.clientes;
DROP POLICY IF EXISTS "clientes_delete" ON public.clientes;

CREATE POLICY "clientes_select" ON public.clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "clientes_insert" ON public.clientes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "clientes_update" ON public.clientes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "clientes_delete" ON public.clientes FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ===================== barbeiros =====================
DROP POLICY IF EXISTS "barbeiros_select" ON public.barbeiros;
DROP POLICY IF EXISTS "barbeiros_insert" ON public.barbeiros;
DROP POLICY IF EXISTS "barbeiros_update" ON public.barbeiros;
DROP POLICY IF EXISTS "barbeiros_delete" ON public.barbeiros;

CREATE POLICY "barbeiros_select" ON public.barbeiros FOR SELECT TO authenticated USING (true);
CREATE POLICY "barbeiros_insert" ON public.barbeiros FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "barbeiros_update" ON public.barbeiros FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "barbeiros_delete" ON public.barbeiros FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ===================== agendamentos =====================
DROP POLICY IF EXISTS "agendamentos_select" ON public.agendamentos;
DROP POLICY IF EXISTS "agendamentos_insert" ON public.agendamentos;
DROP POLICY IF EXISTS "agendamentos_update" ON public.agendamentos;
DROP POLICY IF EXISTS "agendamentos_delete" ON public.agendamentos;

CREATE POLICY "agendamentos_select" ON public.agendamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "agendamentos_insert" ON public.agendamentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "agendamentos_update" ON public.agendamentos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "agendamentos_delete" ON public.agendamentos FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ===================== agendamento_servicos =====================
DROP POLICY IF EXISTS "agendamento_servicos_select" ON public.agendamento_servicos;
DROP POLICY IF EXISTS "agendamento_servicos_insert" ON public.agendamento_servicos;
DROP POLICY IF EXISTS "agendamento_servicos_update" ON public.agendamento_servicos;
DROP POLICY IF EXISTS "agendamento_servicos_delete" ON public.agendamento_servicos;
DROP POLICY IF EXISTS "Users can view agendamento_servicos" ON public.agendamento_servicos;
DROP POLICY IF EXISTS "Users can insert agendamento_servicos" ON public.agendamento_servicos;
DROP POLICY IF EXISTS "Users can update agendamento_servicos" ON public.agendamento_servicos;
DROP POLICY IF EXISTS "Users can delete agendamento_servicos" ON public.agendamento_servicos;

CREATE POLICY "agendamento_servicos_select" ON public.agendamento_servicos FOR SELECT TO authenticated USING (true);
CREATE POLICY "agendamento_servicos_insert" ON public.agendamento_servicos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "agendamento_servicos_update" ON public.agendamento_servicos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "agendamento_servicos_delete" ON public.agendamento_servicos FOR DELETE TO authenticated USING (true);

-- ===================== agenda_bloqueios =====================
DROP POLICY IF EXISTS "agenda_bloqueios_select" ON public.agenda_bloqueios;
DROP POLICY IF EXISTS "agenda_bloqueios_insert" ON public.agenda_bloqueios;
DROP POLICY IF EXISTS "agenda_bloqueios_update" ON public.agenda_bloqueios;
DROP POLICY IF EXISTS "agenda_bloqueios_delete" ON public.agenda_bloqueios;

CREATE POLICY "agenda_bloqueios_select" ON public.agenda_bloqueios FOR SELECT TO authenticated USING (true);
CREATE POLICY "agenda_bloqueios_insert" ON public.agenda_bloqueios FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "agenda_bloqueios_update" ON public.agenda_bloqueios FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "agenda_bloqueios_delete" ON public.agenda_bloqueios FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ===================== comandas =====================
DROP POLICY IF EXISTS "comandas_select" ON public.comandas;
DROP POLICY IF EXISTS "comandas_insert" ON public.comandas;
DROP POLICY IF EXISTS "comandas_update" ON public.comandas;
DROP POLICY IF EXISTS "comandas_delete" ON public.comandas;

CREATE POLICY "comandas_select" ON public.comandas FOR SELECT TO authenticated USING (true);
CREATE POLICY "comandas_insert" ON public.comandas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "comandas_update" ON public.comandas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "comandas_delete" ON public.comandas FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ===================== comanda_itens =====================
DROP POLICY IF EXISTS "comanda_itens_select" ON public.comanda_itens;
DROP POLICY IF EXISTS "comanda_itens_insert" ON public.comanda_itens;
DROP POLICY IF EXISTS "comanda_itens_update" ON public.comanda_itens;
DROP POLICY IF EXISTS "comanda_itens_delete" ON public.comanda_itens;

CREATE POLICY "comanda_itens_select" ON public.comanda_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "comanda_itens_insert" ON public.comanda_itens FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "comanda_itens_update" ON public.comanda_itens FOR UPDATE TO authenticated USING (true);
CREATE POLICY "comanda_itens_delete" ON public.comanda_itens FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ===================== campanhas =====================
DROP POLICY IF EXISTS "campanhas_select" ON public.campanhas;
DROP POLICY IF EXISTS "campanhas_insert" ON public.campanhas;
DROP POLICY IF EXISTS "campanhas_update" ON public.campanhas;
DROP POLICY IF EXISTS "campanhas_delete" ON public.campanhas;

CREATE POLICY "campanhas_select" ON public.campanhas FOR SELECT TO authenticated USING (true);
CREATE POLICY "campanhas_insert" ON public.campanhas FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "campanhas_update" ON public.campanhas FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "campanhas_delete" ON public.campanhas FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ===================== campanha_envios =====================
DROP POLICY IF EXISTS "campanha_envios_select" ON public.campanha_envios;
DROP POLICY IF EXISTS "campanha_envios_insert" ON public.campanha_envios;
DROP POLICY IF EXISTS "campanha_envios_delete" ON public.campanha_envios;

CREATE POLICY "campanha_envios_select" ON public.campanha_envios FOR SELECT TO authenticated USING (true);
CREATE POLICY "campanha_envios_insert" ON public.campanha_envios FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "campanha_envios_delete" ON public.campanha_envios FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ===================== cupons =====================
DROP POLICY IF EXISTS "cupons_select" ON public.cupons;
DROP POLICY IF EXISTS "cupons_insert" ON public.cupons;
DROP POLICY IF EXISTS "cupons_update" ON public.cupons;
DROP POLICY IF EXISTS "cupons_delete" ON public.cupons;

CREATE POLICY "cupons_select" ON public.cupons FOR SELECT TO authenticated USING (true);
CREATE POLICY "cupons_insert" ON public.cupons FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "cupons_update" ON public.cupons FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "cupons_delete" ON public.cupons FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ===================== planos_fidelidade =====================
DROP POLICY IF EXISTS "planos_fidelidade_select" ON public.planos_fidelidade;
DROP POLICY IF EXISTS "planos_fidelidade_insert" ON public.planos_fidelidade;
DROP POLICY IF EXISTS "planos_fidelidade_update" ON public.planos_fidelidade;
DROP POLICY IF EXISTS "planos_fidelidade_delete" ON public.planos_fidelidade;

CREATE POLICY "planos_fidelidade_select" ON public.planos_fidelidade FOR SELECT TO authenticated USING (true);
CREATE POLICY "planos_fidelidade_insert" ON public.planos_fidelidade FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "planos_fidelidade_update" ON public.planos_fidelidade FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "planos_fidelidade_delete" ON public.planos_fidelidade FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ===================== cliente_pontos =====================
DROP POLICY IF EXISTS "cliente_pontos_select" ON public.cliente_pontos;
DROP POLICY IF EXISTS "cliente_pontos_insert" ON public.cliente_pontos;
DROP POLICY IF EXISTS "cliente_pontos_update" ON public.cliente_pontos;
DROP POLICY IF EXISTS "cliente_pontos_delete" ON public.cliente_pontos;

CREATE POLICY "cliente_pontos_select" ON public.cliente_pontos FOR SELECT TO authenticated USING (true);
CREATE POLICY "cliente_pontos_insert" ON public.cliente_pontos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cliente_pontos_update" ON public.cliente_pontos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "cliente_pontos_delete" ON public.cliente_pontos FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ===================== horarios_funcionamento =====================
DROP POLICY IF EXISTS "horarios_funcionamento_select" ON public.horarios_funcionamento;
DROP POLICY IF EXISTS "horarios_funcionamento_insert" ON public.horarios_funcionamento;
DROP POLICY IF EXISTS "horarios_funcionamento_update" ON public.horarios_funcionamento;
DROP POLICY IF EXISTS "horarios_funcionamento_delete" ON public.horarios_funcionamento;

CREATE POLICY "horarios_funcionamento_select" ON public.horarios_funcionamento FOR SELECT TO authenticated USING (true);
CREATE POLICY "horarios_funcionamento_insert" ON public.horarios_funcionamento FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "horarios_funcionamento_update" ON public.horarios_funcionamento FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "horarios_funcionamento_delete" ON public.horarios_funcionamento FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ===================== crm_funil_estagios =====================
DROP POLICY IF EXISTS "crm_funil_estagios_select" ON public.crm_funil_estagios;
DROP POLICY IF EXISTS "crm_funil_estagios_insert" ON public.crm_funil_estagios;
DROP POLICY IF EXISTS "crm_funil_estagios_update" ON public.crm_funil_estagios;
DROP POLICY IF EXISTS "crm_funil_estagios_delete" ON public.crm_funil_estagios;

CREATE POLICY "crm_funil_estagios_select" ON public.crm_funil_estagios FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_funil_estagios_insert" ON public.crm_funil_estagios FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "crm_funil_estagios_update" ON public.crm_funil_estagios FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "crm_funil_estagios_delete" ON public.crm_funil_estagios FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ===================== crm_funil_clientes =====================
DROP POLICY IF EXISTS "crm_funil_clientes_select" ON public.crm_funil_clientes;
DROP POLICY IF EXISTS "crm_funil_clientes_insert" ON public.crm_funil_clientes;
DROP POLICY IF EXISTS "crm_funil_clientes_update" ON public.crm_funil_clientes;
DROP POLICY IF EXISTS "crm_funil_clientes_delete" ON public.crm_funil_clientes;

CREATE POLICY "crm_funil_clientes_select" ON public.crm_funil_clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_funil_clientes_insert" ON public.crm_funil_clientes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "crm_funil_clientes_update" ON public.crm_funil_clientes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "crm_funil_clientes_delete" ON public.crm_funil_clientes FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ===================== crm_interacoes =====================
DROP POLICY IF EXISTS "crm_interacoes_select" ON public.crm_interacoes;
DROP POLICY IF EXISTS "crm_interacoes_insert" ON public.crm_interacoes;
DROP POLICY IF EXISTS "crm_interacoes_update" ON public.crm_interacoes;
DROP POLICY IF EXISTS "crm_interacoes_delete" ON public.crm_interacoes;

CREATE POLICY "crm_interacoes_select" ON public.crm_interacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_interacoes_insert" ON public.crm_interacoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "crm_interacoes_update" ON public.crm_interacoes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "crm_interacoes_delete" ON public.crm_interacoes FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ===================== estoque_movimentacoes =====================
DROP POLICY IF EXISTS "estoque_movimentacoes_select" ON public.estoque_movimentacoes;
DROP POLICY IF EXISTS "estoque_movimentacoes_insert" ON public.estoque_movimentacoes;

CREATE POLICY "estoque_movimentacoes_select" ON public.estoque_movimentacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "estoque_movimentacoes_insert" ON public.estoque_movimentacoes FOR INSERT TO authenticated WITH CHECK (true);

-- ===================== email_config =====================
DROP POLICY IF EXISTS "Admins can manage email config" ON public.email_config;
DROP POLICY IF EXISTS "email_config_all" ON public.email_config;

CREATE POLICY "email_config_select" ON public.email_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "email_config_insert" ON public.email_config FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "email_config_update" ON public.email_config FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "email_config_delete" ON public.email_config FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ===================== evolution_config =====================
DROP POLICY IF EXISTS "evolution_config_select" ON public.evolution_config;
DROP POLICY IF EXISTS "evolution_config_insert" ON public.evolution_config;
DROP POLICY IF EXISTS "evolution_config_update" ON public.evolution_config;
DROP POLICY IF EXISTS "evolution_config_delete" ON public.evolution_config;

CREATE POLICY "evolution_config_select" ON public.evolution_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "evolution_config_insert" ON public.evolution_config FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "evolution_config_update" ON public.evolution_config FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "evolution_config_delete" ON public.evolution_config FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ===================== chatbot_fluxos =====================
DROP POLICY IF EXISTS "chatbot_fluxos_select" ON public.chatbot_fluxos;
DROP POLICY IF EXISTS "chatbot_fluxos_insert" ON public.chatbot_fluxos;
DROP POLICY IF EXISTS "chatbot_fluxos_update" ON public.chatbot_fluxos;
DROP POLICY IF EXISTS "chatbot_fluxos_delete" ON public.chatbot_fluxos;

CREATE POLICY "chatbot_fluxos_select" ON public.chatbot_fluxos FOR SELECT TO authenticated USING (true);
CREATE POLICY "chatbot_fluxos_insert" ON public.chatbot_fluxos FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "chatbot_fluxos_update" ON public.chatbot_fluxos FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "chatbot_fluxos_delete" ON public.chatbot_fluxos FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ===================== chatbot_flows =====================
DROP POLICY IF EXISTS "chatbot_flows_select" ON public.chatbot_flows;
DROP POLICY IF EXISTS "chatbot_flows_insert" ON public.chatbot_flows;
DROP POLICY IF EXISTS "chatbot_flows_update" ON public.chatbot_flows;
DROP POLICY IF EXISTS "chatbot_flows_delete" ON public.chatbot_flows;

CREATE POLICY "chatbot_flows_select" ON public.chatbot_flows FOR SELECT TO authenticated USING (true);
CREATE POLICY "chatbot_flows_insert" ON public.chatbot_flows FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "chatbot_flows_update" ON public.chatbot_flows FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "chatbot_flows_delete" ON public.chatbot_flows FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ===================== perfis_acesso =====================
DROP POLICY IF EXISTS "perfis_acesso_select" ON public.perfis_acesso;
DROP POLICY IF EXISTS "perfis_acesso_insert" ON public.perfis_acesso;
DROP POLICY IF EXISTS "perfis_acesso_update" ON public.perfis_acesso;
DROP POLICY IF EXISTS "perfis_acesso_delete" ON public.perfis_acesso;

CREATE POLICY "perfis_acesso_select" ON public.perfis_acesso FOR SELECT TO authenticated USING (true);
CREATE POLICY "perfis_acesso_insert" ON public.perfis_acesso FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "perfis_acesso_update" ON public.perfis_acesso FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "perfis_acesso_delete" ON public.perfis_acesso FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ===================== perfil_permissoes =====================
DROP POLICY IF EXISTS "perfil_permissoes_select" ON public.perfil_permissoes;
DROP POLICY IF EXISTS "perfil_permissoes_insert" ON public.perfil_permissoes;
DROP POLICY IF EXISTS "perfil_permissoes_update" ON public.perfil_permissoes;
DROP POLICY IF EXISTS "perfil_permissoes_delete" ON public.perfil_permissoes;

CREATE POLICY "perfil_permissoes_select" ON public.perfil_permissoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "perfil_permissoes_insert" ON public.perfil_permissoes FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "perfil_permissoes_update" ON public.perfil_permissoes FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "perfil_permissoes_delete" ON public.perfil_permissoes FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ===================== convites =====================
DROP POLICY IF EXISTS "convites_select" ON public.convites;
DROP POLICY IF EXISTS "convites_insert" ON public.convites;
DROP POLICY IF EXISTS "convites_update" ON public.convites;
DROP POLICY IF EXISTS "convites_delete" ON public.convites;

CREATE POLICY "convites_select" ON public.convites FOR SELECT TO authenticated USING (true);
CREATE POLICY "convites_insert" ON public.convites FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "convites_update" ON public.convites FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "convites_delete" ON public.convites FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ===================== ads_metrics =====================
DROP POLICY IF EXISTS "ads_metrics_select" ON public.ads_metrics;
DROP POLICY IF EXISTS "ads_metrics_insert" ON public.ads_metrics;
DROP POLICY IF EXISTS "ads_metrics_update" ON public.ads_metrics;
DROP POLICY IF EXISTS "ads_metrics_delete" ON public.ads_metrics;

CREATE POLICY "ads_metrics_select" ON public.ads_metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY "ads_metrics_insert" ON public.ads_metrics FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ads_metrics_update" ON public.ads_metrics FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "ads_metrics_delete" ON public.ads_metrics FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ===================== whatsapp_conversas =====================
DROP POLICY IF EXISTS "whatsapp_conversas_select" ON public.whatsapp_conversas;
DROP POLICY IF EXISTS "whatsapp_conversas_insert" ON public.whatsapp_conversas;
DROP POLICY IF EXISTS "whatsapp_conversas_update" ON public.whatsapp_conversas;
DROP POLICY IF EXISTS "whatsapp_conversas_delete" ON public.whatsapp_conversas;

CREATE POLICY "whatsapp_conversas_select" ON public.whatsapp_conversas FOR SELECT TO authenticated USING (true);
CREATE POLICY "whatsapp_conversas_insert" ON public.whatsapp_conversas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "whatsapp_conversas_update" ON public.whatsapp_conversas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "whatsapp_conversas_delete" ON public.whatsapp_conversas FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ===================== whatsapp_mensagens =====================
DROP POLICY IF EXISTS "whatsapp_mensagens_select" ON public.whatsapp_mensagens;
DROP POLICY IF EXISTS "whatsapp_mensagens_insert" ON public.whatsapp_mensagens;
DROP POLICY IF EXISTS "whatsapp_mensagens_update" ON public.whatsapp_mensagens;
DROP POLICY IF EXISTS "whatsapp_mensagens_delete" ON public.whatsapp_mensagens;

CREATE POLICY "whatsapp_mensagens_select" ON public.whatsapp_mensagens FOR SELECT TO authenticated USING (true);
CREATE POLICY "whatsapp_mensagens_insert" ON public.whatsapp_mensagens FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "whatsapp_mensagens_update" ON public.whatsapp_mensagens FOR UPDATE TO authenticated USING (true);
CREATE POLICY "whatsapp_mensagens_delete" ON public.whatsapp_mensagens FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
