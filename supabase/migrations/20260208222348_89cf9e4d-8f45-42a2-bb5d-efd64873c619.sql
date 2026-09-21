
-- 1. Tabela de Categorias personalizáveis (para produtos e serviços)
CREATE TABLE public.categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL, -- 'produto' ou 'servico'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(nome, tipo)
);

ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage categorias"
ON public.categorias FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Authenticated users can view categorias"
ON public.categorias FOR SELECT
USING (true);

-- 2. Perfis de Acesso (ex: Recepcionista, Barbeiro, Gerente)
CREATE TABLE public.perfis_acesso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.perfis_acesso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage perfis_acesso"
ON public.perfis_acesso FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view perfis_acesso"
ON public.perfis_acesso FOR SELECT
USING (true);

-- Trigger updated_at
CREATE TRIGGER update_perfis_acesso_updated_at
BEFORE UPDATE ON public.perfis_acesso
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Permissões granulares por perfil
CREATE TABLE public.perfil_permissoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id UUID NOT NULL REFERENCES public.perfis_acesso(id) ON DELETE CASCADE,
  permissao TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(perfil_id, permissao)
);

ALTER TABLE public.perfil_permissoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage perfil_permissoes"
ON public.perfil_permissoes FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view perfil_permissoes"
ON public.perfil_permissoes FOR SELECT
USING (true);

-- 4. Vincular usuários a perfis de acesso
ALTER TABLE public.user_roles ADD COLUMN perfil_acesso_id UUID REFERENCES public.perfis_acesso(id);

-- 5. Tabela de convites pendentes
CREATE TABLE public.convites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  perfil_acesso_id UUID REFERENCES public.perfis_acesso(id),
  convidado_por UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.convites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage convites"
ON public.convites FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view convites"
ON public.convites FOR SELECT
USING (true);

-- 6. Função auxiliar para verificar permissão do usuário logado
CREATE OR REPLACE FUNCTION public.user_has_permission(_user_id UUID, _permissao TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.perfil_permissoes pp ON pp.perfil_id = ur.perfil_acesso_id
    WHERE ur.user_id = _user_id
      AND pp.permissao = _permissao
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
  )
$$;
