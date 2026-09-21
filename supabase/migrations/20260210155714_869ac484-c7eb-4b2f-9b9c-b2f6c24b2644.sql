
-- Tabela para configuração de email (templates e lembretes)
CREATE TABLE public.email_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL UNIQUE, -- 'convite_usuario', 'lembrete_agendamento'
  assunto TEXT NOT NULL,
  corpo_html TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  -- Para lembretes: quantas horas antes enviar
  horas_antes INTEGER DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_config ENABLE ROW LEVEL SECURITY;

-- Admins podem ler e editar
CREATE POLICY "Admins can manage email config"
ON public.email_config
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger para updated_at
CREATE TRIGGER update_email_config_updated_at
BEFORE UPDATE ON public.email_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir templates padrão
INSERT INTO public.email_config (tipo, assunto, corpo_html, horas_antes) VALUES
(
  'convite_usuario',
  'Você foi convidado para {{nome_empresa}}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; padding: 30px 0; background: linear-gradient(135deg, {{cor_primaria}}, #1a1a2e); border-radius: 12px;">
      <h1 style="color: white; margin: 0; font-size: 24px;">{{nome_empresa}}</h1>
    </div>
    <div style="padding: 30px 20px;">
      <h2 style="color: #333;">Bem-vindo(a) à equipe!</h2>
      <p style="color: #666; line-height: 1.6;">Você foi convidado(a) para fazer parte da equipe <strong>{{nome_empresa}}</strong>.</p>
      <p style="color: #666; line-height: 1.6;">Clique no botão abaixo para definir sua senha e acessar o sistema:</p>
      <div style="text-align: center; padding: 20px 0;">
        <a href="{{link_acesso}}" style="background: {{cor_primaria}}; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Acessar o Sistema</a>
      </div>
      <p style="color: #999; font-size: 12px;">Se você não esperava este convite, ignore este email.</p>
    </div>
  </div>',
  NULL
),
(
  'lembrete_agendamento',
  'Lembrete: Seu agendamento em {{nome_empresa}} é amanhã!',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; padding: 30px 0; background: linear-gradient(135deg, {{cor_primaria}}, #1a1a2e); border-radius: 12px;">
      <h1 style="color: white; margin: 0; font-size: 24px;">{{nome_empresa}}</h1>
    </div>
    <div style="padding: 30px 20px;">
      <h2 style="color: #333;">Lembrete de Agendamento</h2>
      <p style="color: #666; line-height: 1.6;">Olá <strong>{{nome_cliente}}</strong>,</p>
      <p style="color: #666; line-height: 1.6;">Este é um lembrete do seu agendamento:</p>
      <div style="background: #f8f8f8; border-radius: 8px; padding: 20px; margin: 16px 0;">
        <p style="margin: 4px 0; color: #333;"><strong>📅 Data:</strong> {{data_agendamento}}</p>
        <p style="margin: 4px 0; color: #333;"><strong>⏰ Horário:</strong> {{horario_agendamento}}</p>
        <p style="margin: 4px 0; color: #333;"><strong>✂️ Serviço:</strong> {{servico}}</p>
        <p style="margin: 4px 0; color: #333;"><strong>👤 Profissional:</strong> {{profissional}}</p>
      </div>
      <p style="color: #666; line-height: 1.6;">Esperamos você!</p>
      <p style="color: #999; font-size: 12px; margin-top: 30px;">{{nome_empresa}} - Sistema de Gestão</p>
    </div>
  </div>',
  24
);
