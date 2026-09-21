-- Drop the old unique constraint on tipo alone
ALTER TABLE public.email_config DROP CONSTRAINT IF EXISTS email_config_tipo_key;

-- Add a unique constraint on (empresa_id, tipo) instead
ALTER TABLE public.email_config ADD CONSTRAINT email_config_empresa_tipo_key UNIQUE (empresa_id, tipo);

-- Now insert convite_cliente template for all existing empresas
INSERT INTO public.email_config (empresa_id, tipo, assunto, corpo_html, horas_antes)
SELECT e.id, 'convite_cliente',
  'Bem-vindo(a) à {{nome_empresa}}! 🎉',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; padding: 30px 0; background: linear-gradient(135deg, {{cor_primaria}}, #1a1a2e); border-radius: 12px;">
      <h1 style="color: white; margin: 0; font-size: 24px;">{{nome_empresa}}</h1>
    </div>
    <div style="padding: 30px 20px;">
      <h2 style="color: #333;">Olá, {{nome_cliente}}! 👋</h2>
      <p style="color: #666; line-height: 1.6;">Seja muito bem-vindo(a) à <strong>{{nome_empresa}}</strong>!</p>
      <p style="color: #666; line-height: 1.6;">Estamos felizes em tê-lo(a) como nosso cliente. A partir de agora você terá acesso aos melhores serviços e atendimento personalizado.</p>
      <div style="background: #f8f8f8; border-radius: 8px; padding: 20px; margin: 16px 0; text-align: center;">
        <p style="margin: 0; color: #333; font-size: 16px; font-weight: bold;">📱 Agende seus horários com facilidade!</p>
        <p style="margin: 8px 0 0; color: #666;">Entre em contato conosco para agendar seu próximo atendimento.</p>
      </div>
      <p style="color: #666; line-height: 1.6;">Esperamos vê-lo(a) em breve!</p>
      <p style="color: #999; font-size: 12px; margin-top: 30px;">{{nome_empresa}} - Obrigado pela preferência</p>
    </div>
  </div>',
  NULL
FROM public.empresas e
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_config ec WHERE ec.empresa_id = e.id AND ec.tipo = 'convite_cliente'
);