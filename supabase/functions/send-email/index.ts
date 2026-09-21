import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function sendPulseEmail({
  to,
  subject,
  html,
  fromName,
  fromEmail,
  apiUserId,
  apiSecret,
}: {
  to: string;
  subject: string;
  html: string;
  fromName: string;
  fromEmail: string;
  apiUserId?: string;
  apiSecret?: string;
}) {
  const userId = apiUserId || Deno.env.get("SENDPULSE_API_USER_ID");
  const secret = apiSecret || Deno.env.get("SENDPULSE_API_SECRET");

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
        "Authorization": `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    return await sendRes.json();
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (resendApiKey) {
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        subject: subject,
        html: html,
      }),
    });
    return await resendRes.json();
  }

  console.log("AVISO: Disparo em modo simulado...");
  return { result: true, message: "Modo simulado: envie as chaves do SendPulse no painel do SuperAdmin" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { tipo, to, cliente_id, variables, empresa_id } = await req.json();

    if (!to) {
      throw new Error("O campo 'to' é obrigatório");
    }

    let targetTipo = tipo || "confirmacao_agendamento";

    // Lógica Inteligente para Agendamentos: 1ª Visita vs Recorrente
    if (tipo === "agendamento" || tipo === "confirmacao_agendamento" || tipo === "primeiro_agendamento") {
      if (cliente_id) {
        const { count } = await supabaseAdmin
          .from("agendamentos")
          .select("id", { count: "exact", head: true })
          .eq("cliente_id", cliente_id);

        // Se for o 1º agendamento da história do cliente (count <= 1)
        if (count !== null && count <= 1) {
          targetTipo = "primeiro_agendamento";
        } else {
          targetTipo = "confirmacao_agendamento";
        }
      }
    }

    // Buscar o template correto no banco
    let template: any = null;
    const { data } = await supabaseAdmin
      .from("email_config")
      .select("*")
      .eq("tipo", targetTipo)
      .eq("ativo", true)
      .is("empresa_id", null)
      .maybeSingle();

    template = data;

    // Fallback se não encontrar o tipo específico
    if (!template && targetTipo === "primeiro_agendamento") {
      const { data: fbData } = await supabaseAdmin
        .from("email_config")
        .select("*")
        .eq("tipo", "confirmacao_agendamento")
        .eq("ativo", true)
        .maybeSingle();
      template = fbData;
    }

    if (!template) {
      throw new Error(`Template de e-mail '${targetTipo}' não encontrado ou desativado`);
    }

    const nomeEmpresa = "Barbearia Hermanos";
    const emailRemetente = Deno.env.get("SENDPULSE_SENDER_EMAIL") || "atendimento@hermanosbarbearia.com.br";

    const allVars: Record<string, string> = {
      nome_empresa: nomeEmpresa,
      nome_usuario: to.split("@")[0],
      nome_cliente: to.split("@")[0],
      ...(variables || {}),
    };

    let assunto = template.assunto;
    let corpo = template.corpo_html;

    for (const [key, value] of Object.entries(allVars)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "gi");
      assunto = assunto.replace(regex, value);
      corpo = corpo.replace(regex, value);
    }

    const emailResponse = await sendPulseEmail({
      to: to,
      subject: assunto,
      html: corpo,
      fromName: nomeEmpresa,
      fromEmail: emailRemetente,
    });

    return new Response(JSON.stringify({ success: true, targetTipo, data: emailResponse }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Erro no envio de e-mail:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
