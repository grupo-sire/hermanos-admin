import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Disparo de E-mail via SendPulse REST API
async function enviarEmailSendPulse({
  to,
  subject,
  html,
  fromName,
  fromEmail,
}: {
  to: string;
  subject: string;
  html: string;
  fromName: string;
  fromEmail: string;
}) {
  const userId = Deno.env.get("SENDPULSE_API_USER_ID") || Deno.env.get("SENDPULSE_CLIENT_ID");
  const secret = Deno.env.get("SENDPULSE_API_SECRET") || Deno.env.get("SENDPULSE_CLIENT_SECRET");

  if (userId && secret) {
    const tokenRes = await fetch("https://api.sendpulse.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: userId,
        client_secret: secret,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      throw new Error(`Autenticação SendPulse Falhou: ${JSON.stringify(tokenData)}`);
    }

    const encoder = new TextEncoder();
    const bytes = encoder.encode(html);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const htmlBase64 = btoa(binary);

    const emailPayload = {
      email: {
        html: htmlBase64,
        text: subject,
        subject: subject,
        from: {
          name: fromName,
          email: fromEmail,
        },
        to: [
          {
            name: to.split("@")[0],
            email: to,
          },
        ],
      },
    };

    const sendRes = await fetch("https://api.sendpulse.com/smtp/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    return await sendRes.json();
  }

  // Fallback se chaves SendPulse ainda não configuradas na nuvem
  console.log(`[SENDPULSE FALLBACK] Chaves SendPulse não detectadas. E-mail simulado para: ${to}`);
  return { success: true, simulated: true };
}

// Template HTML de Luxo Hermanos para o Código OTP
function gerarHtmlOtp(codigo: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Código de Acesso - Barbearia Hermanos</title>
</head>
<body style="margin: 0; padding: 0; background-color: #080304; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #080304; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 500px; background: linear-gradient(180deg, #16070a 0%, #0d0406 100%); border: 1px solid #3b1016; border-radius: 24px; padding: 40px 30px; box-shadow: 0 20px 50px rgba(0,0,0,0.8);">
          
          <!-- Logo & Header -->
          <tr>
            <td align="center" style="padding-bottom: 25px;">
              <div style="display: inline-block; width: 64px; height: 64px; background: linear-gradient(135deg, #dc2626, #7f1d1d); border-radius: 20px; line-height: 64px; font-size: 32px; text-align: center; border: 1px solid rgba(251, 191, 36, 0.4);">
                💈
              </div>
              <h1 style="margin: 15px 0 5px 0; font-size: 24px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">
                BARBEARIA HERMANOS
              </h1>
              <span style="font-size: 11px; font-weight: 700; color: #f59e0b; text-transform: uppercase; letter-spacing: 2px;">
                Área Exclusiva do Cliente
              </span>
            </td>
          </tr>

          <!-- Mensagem -->
          <tr>
            <td align="center" style="padding-bottom: 25px;">
              <p style="margin: 0 0 10px 0; font-size: 15px; color: #cbd5e1; line-height: 1.5;">
                Use o código de verificação abaixo para acessar sua conta no nosso aplicativo:
              </p>
            </td>
          </tr>

          <!-- Box do Código OTP -->
          <tr>
            <td align="center" style="padding-bottom: 30px;">
              <div style="background-color: #050102; border: 2px dashed #f59e0b; border-radius: 16px; padding: 18px 30px; display: inline-block;">
                <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 900; color: #f59e0b; letter-spacing: 10px; display: block; text-shadow: 0 0 20px rgba(245, 158, 11, 0.3);">
                  ${codigo}
                </span>
              </div>
              <p style="margin: 12px 0 0 0; font-size: 12px; color: #94a3b8;">
                ⏱️ Este código expira em <strong>10 minutos</strong>.
              </p>
            </td>
          </tr>

          <!-- Aviso de Segurança -->
          <tr>
            <td style="border-top: 1px solid #260a0e; padding-top: 25px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b; line-height: 1.4;">
                Se você não solicitou este acesso, pode ignorar este e-mail com segurança.
              </p>
              <p style="margin: 0; font-size: 11px; color: #475569;">
                © 2026 Barbearia Hermanos • Todos os direitos reservados.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { action } = body;

    // ====================================================================
    // AÇÃO 1: ENVIAR CÓDIGO OTP POR E-MAIL
    // ====================================================================
    if (action === "enviar_otp") {
      const email = (body.email || "").trim().toLowerCase();
      const empresaId = body.empresa_id;

      if (!email || !email.includes("@")) {
        return new Response(
          JSON.stringify({ error: "Informe um e-mail válido para receber o código." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Invalida OTPs antigos não usados para este e-mail
      await supabase
        .from("cliente_otps")
        .update({ usado: true })
        .eq("email", email)
        .eq("usado", false);

      // Gera código de 6 dígitos aleatório
      const codigo = Math.floor(100000 + Math.random() * 900000).toString();
      const expiraEm = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutos

      const { error: insertErr } = await supabase.from("cliente_otps").insert({
        email,
        codigo,
        expira_em: expiraEm,
        usado: false,
        tentativas: 0,
      });

      if (insertErr) {
        console.error("Erro ao salvar OTP:", insertErr);
        return new Response(
          JSON.stringify({ error: "Erro ao gerar código de acesso. Tente novamente." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Dispara E-mail com SendPulse
      const fromEmail = Deno.env.get("SENDPULSE_FROM_EMAIL") || "relacionamento@barbeariahermanos.com.br";
      const fromName = Deno.env.get("SENDPULSE_FROM_NAME") || "Barbearia Hermanos";
      const subject = `${codigo} é o seu código de acesso à Barbearia Hermanos 💈`;
      const html = gerarHtmlOtp(codigo);

      try {
        await enviarEmailSendPulse({
          to: email,
          subject,
          html,
          fromName,
          fromEmail,
        });
      } catch (emailErr: any) {
        console.error("Erro ao disparar e-mail via SendPulse:", emailErr.message);
      }

      console.log(`[CLIENTE OTP] Código gerado para ${email}: ${codigo} (Expira: ${expiraEm})`);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Código de verificação enviado para o seu e-mail!",
          expira_em: expiraEm,
          dev_hint: Deno.env.get("SENDPULSE_API_USER_ID") ? undefined : codigo,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ====================================================================
    // AÇÃO 2: VERIFICAR CÓDIGO OTP
    // ====================================================================
    if (action === "verificar_otp") {
      const email = (body.email || "").trim().toLowerCase();
      const codigo = (body.codigo || "").trim();
      const empresaId = body.empresa_id;

      if (!email || !codigo) {
        return new Response(
          JSON.stringify({ error: "E-mail e código são obrigatórios." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Buscar o último OTP ativo deste e-mail
      const { data: otpRecord, error: otpErr } = await supabase
        .from("cliente_otps")
        .select("*")
        .eq("email", email)
        .eq("usado", false)
        .gt("expira_em", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (otpErr || !otpRecord) {
        return new Response(
          JSON.stringify({ error: "Código expirado ou inválido. Solicite um novo código." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (otpRecord.tentativas >= 3) {
        await supabase.from("cliente_otps").update({ usado: true }).eq("id", otpRecord.id);
        return new Response(
          JSON.stringify({ error: "Código bloqueado por excesso de tentativas incorretas. Solicite um novo." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (otpRecord.codigo !== codigo) {
        await supabase
          .from("cliente_otps")
          .update({ tentativas: (otpRecord.tentativas || 0) + 1 })
          .eq("id", otpRecord.id);

        const restantes = 3 - ((otpRecord.tentativas || 0) + 1);
        return new Response(
          JSON.stringify({
            error: `Código incorreto. Você tem mais ${restantes} tentativa(s).`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Código Correto! Marca como usado
      await supabase.from("cliente_otps").update({ usado: true }).eq("id", otpRecord.id);

      // Localizar cliente na tabela clientes ou criar novo perfil
      let { data: cliente } = await supabase
        .from("clientes")
        .select("*")
        .ilike("email", email)
        .maybeSingle();

      if (!cliente && empresaId) {
        const nomeSugerido = email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
        const { data: newCli } = await supabase
          .from("clientes")
          .insert({
            empresa_id: empresaId,
            nome: nomeSugerido,
            email,
          })
          .select("*")
          .single();

        cliente = newCli;
      }

      return new Response(
        JSON.stringify({
          success: true,
          cliente,
          message: "Autenticação realizada com sucesso!",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ====================================================================
    // AÇÃO 3: GERAR MAGIC LINK (Chamado pela Heloísa dentro da Janela 24h)
    // ====================================================================
    if (action === "gerar_magic_link") {
      const clienteId = body.cliente_id;
      if (!clienteId) {
        return new Response(JSON.stringify({ error: "cliente_id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Gerar token de 32 caracteres
      const randomArr = new Uint8Array(16);
      crypto.getRandomValues(randomArr);
      const token = Array.from(randomArr, (b) => b.toString(16).padStart(2, "0")).join("");

      const expiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 horas

      await supabase.from("cliente_magic_links").insert({
        token,
        cliente_id: clienteId,
        expira_em: expiraEm,
        usado: false,
      });

      const url = `https://barbeariahermanos.com.br/hermanos/cliente?auth=${token}`;

      return new Response(JSON.stringify({ success: true, token, url }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ====================================================================
    // AÇÃO 4: VERIFICAR MAGIC LINK (Ao abrir o link no navegador)
    // ====================================================================
    if (action === "verificar_magic_link") {
      const token = (body.token || "").trim();
      if (!token) {
        return new Response(JSON.stringify({ error: "Token inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: linkRecord } = await supabase
        .from("cliente_magic_links")
        .select("*, clientes(*)")
        .eq("token", token)
        .gt("expira_em", new Date().toISOString())
        .maybeSingle();

      if (!linkRecord || !linkRecord.clientes) {
        return new Response(
          JSON.stringify({ error: "Link de acesso expirado ou inválido." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Marca como usado
      await supabase.from("cliente_magic_links").update({ usado: true }).eq("token", token);

      return new Response(
        JSON.stringify({
          success: true,
          cliente: linkRecord.clientes,
          message: "Autenticado com sucesso via Magic Link!",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Ação não reconhecida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Erro na Edge Function cliente-auth:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
