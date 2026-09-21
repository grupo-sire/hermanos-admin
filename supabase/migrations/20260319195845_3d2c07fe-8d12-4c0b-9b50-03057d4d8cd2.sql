UPDATE public.email_config
SET corpo_html = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; padding: 30px 0; background: linear-gradient(135deg, {{cor_primaria}}, #1a1a2e); border-radius: 12px;">
      <h1 style="color: white; margin: 0; font-size: 24px;">{{nome_empresa}}</h1>
    </div>
    <div style="padding: 30px 20px;">
      <h2 style="color: #333;">Olá, {{nome_cliente}}! 👋</h2>
      <p style="color: #666; line-height: 1.6;">Seja muito bem-vindo(a) à <strong>{{nome_empresa}}</strong>!</p>
      <p style="color: #666; line-height: 1.6;">Estamos felizes em tê-lo(a) como nosso(a) novo(a) assinante. A partir de agora você terá acesso aos melhores serviços e atendimento personalizado.</p>
      <div style="text-align: center; padding: 20px 0;">
        <a href="{{link_login}}" style="background: {{cor_primaria}}; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Acessar o Sistema</a>
      </div>
      <div style="text-align: center; padding: 0 0 20px;">
        <a href="{{link_definir_senha}}" style="background: transparent; color: {{cor_primaria}}; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block; border: 2px solid {{cor_primaria}};">Definir Minha Senha</a>
      </div>
      <div style="background: #f8f8f8; border-radius: 8px; padding: 20px; margin: 16px 0; text-align: center;">
        <p style="margin: 0; color: #333; font-size: 16px; font-weight: bold;">📱 Agende seus horários com facilidade!</p>
        <p style="margin: 8px 0 0; color: #666;">Use os botões acima para acessar e começar a agendar.</p>
      </div>
      <p style="color: #666; line-height: 1.6;">Esperamos vê-lo(a) em breve!</p>
      <p style="color: #999; font-size: 12px; margin-top: 30px;">{{nome_empresa}} - Obrigado pela preferência</p>
    </div>
  </div>'
WHERE tipo = 'convite_cliente';