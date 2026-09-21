
-- Add billing/subscription fields to empresas
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS acesso_liberado boolean NOT NULL DEFAULT false;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS asaas_customer_id text;

-- Subscription tracking table
CREATE TABLE public.empresa_assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
  asaas_subscription_id text,
  asaas_payment_id text,
  status text NOT NULL DEFAULT 'pending',
  valor numeric NOT NULL DEFAULT 0,
  data_vencimento date,
  data_pagamento timestamp with time zone,
  data_inadimplencia timestamp with time zone,
  dias_inadimplente integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.empresa_assinaturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assinaturas_select" ON public.empresa_assinaturas
  FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "assinaturas_insert" ON public.empresa_assinaturas
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "assinaturas_update" ON public.empresa_assinaturas
  FOR UPDATE TO authenticated
  USING (is_super_admin(auth.uid()));

CREATE POLICY "assinaturas_delete" ON public.empresa_assinaturas
  FOR DELETE TO authenticated
  USING (is_super_admin(auth.uid()));

-- Allow anon to insert (for webhook from Asaas)
CREATE POLICY "assinaturas_anon_insert" ON public.empresa_assinaturas
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "assinaturas_anon_update" ON public.empresa_assinaturas
  FOR UPDATE TO anon
  USING (true);
