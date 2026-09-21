import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");
    const evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL");
    
    if (!resendApiKey) throw new Error("RESEND_API_KEY não configurada");

    const resend = new Resend(resendApiKey);
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Dynamic window: we'll look for appointments in the next 24h (default)
    const now = new Date();
    const reminderStart = new Date(now.getTime() + (24 - 1.5) * 60 * 60 * 1000);
    const reminderEnd = new Date(now.getTime() + (24 + 0.5) * 60 * 60 * 1000);

    const { data: agendamentos, error: agError } = await supabaseAdmin
      .from("agendamentos")
      .select(`
        id, data_hora, status, empresa_id,
        clientes!agendamentos_cliente_id_fkey (id, nome, email, telefone),
        servicos!agendamentos_servico_id_fkey (nome),
        barbeiros!agendamentos_barbeiro_id_fkey (nome),
        unidades!agendamentos_unidade_id_fkey (nome)
      `)
      .eq("status", "agendado")
      .gte("data_hora", reminderStart.toISOString())
      .lte("data_hora", reminderEnd.toISOString());

    if (agError) throw agError;

    if (!agendamentos || agendamentos.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhum agendamento para lembrar", sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sentEmail = 0;
    let sentWhatsapp = 0;
    const errors: string[] = [];

    // Cache for company configs to avoid multiple queries
    const companyConfigs = new Map<string, any>();

    for (const ag of agendamentos) {
      const empresaId = ag.empresa_id;
      if (!empresaId) continue;

      // Ensure we have configs for this company
      if (!companyConfigs.has(empresaId)) {
        const [empRes, emailRes, evoRes] = await Promise.all([
          supabaseAdmin.from("empresa_config").select("*").eq("empresa_id", empresaId).maybeSingle(),
          supabaseAdmin.from("email_config").select("*").eq("empresa_id", empresaId).eq("tipo", "lembrete_agendamento").eq("ativo", true).maybeSingle(),
          supabaseAdmin.from("evolution_config").select("*").eq("empresa_id", empresaId).eq("connected", true).maybeSingle()
        ]);
        
        companyConfigs.set(empresaId, {
          empresa: empRes.data,
          email: emailRes.data,
          evolution: evoRes.data
        });
      }

      const configs = companyConfigs.get(empresaId);
      const cliente = ag.clientes as any;
      const servico = ag.servicos as any;
      const barbeiro = ag.barbeiros as any;
      const unidade = ag.unidades as any;

      const dataHora = new Date(ag.data_hora);
      const dataFormatada = dataHora.toLocaleDateString("pt-BR", { timeZone: 'UTC' }); // Agendamentos are UTC
      const horaFormatada = dataHora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: 'UTC' });

      // Build variables for templates
      const variables: Record<string, string> = {
        nome_empresa: configs.empresa?.nome || "Sistema",
        nome_cliente: cliente?.nome || "Cliente",
        data_agendamento: dataFormatada,
        horario_agendamento: horaFormatada,
        servico: servico?.nome || "Serviço",
        profissional: barbeiro?.nome || "Profissional",
        unidade: unidade?.nome || "Unidade",
      };

      // 1. SEND EMAIL
      if (configs.email && cliente?.email) {
        let assunto = configs.email.assunto;
        let corpo = configs.email.corpo_html;

        for (const [key, value] of Object.entries(variables)) {
          const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
          assunto = assunto.replace(regex, value);
          corpo = corpo.replace(regex, value);
        }

        try {
          await resend.emails.send({
            from: `${variables.nome_empresa} <${configs.empresa?.email || "noreply@resend.dev"}>`,
            to: [cliente.email],
            subject: assunto,
            html: corpo,
          });
          sentEmail++;
        } catch (err: any) {
          errors.push(`Email error ${cliente.email}: ${err.message}`);
        }
      }

      // 2. SEND WHATSAPP
      if (configs.evolution && cliente?.telefone && evolutionApiUrl && evolutionApiKey) {
        const phone = cliente.telefone.replace(/\D/g, "");
        const msg = `⏰ *Lembrete de Agendamento*\n\nOlá *${variables.nome_cliente}*,\n\nPassando para lembrar do seu horário em *${variables.nome_empresa}*:\n\n📅 *Data:* ${dataFormatada}\n⏰ *Hora:* ${horaFormatada}\n📋 *Serviço:* ${variables.servico}\n👤 *Profissional:* ${variables.profissional}\n📍 *Unidade:* ${variables.unidade}\n\nEsperamos por você! 😊`;

        try {
          const res = await fetch(`${evolutionApiUrl.replace(/\/$/, "")}/message/sendText/${configs.evolution.instance_name}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: evolutionApiKey },
            body: JSON.stringify({ number: phone, text: msg }),
          });

          if (res.ok) {
            sentWhatsapp++;
            // Save to logs
            await supabaseAdmin.from("whatsapp_mensagens").insert({
              telefone: phone,
              mensagem: msg,
              direcao: "enviada",
              tipo: "text",
              empresa_id: empresaId,
              cliente_id: cliente?.id
            });
          } else {
            const errData = await res.text();
            errors.push(`WhatsApp error ${phone}: ${errData}`);
          }
        } catch (err: any) {
          errors.push(`WhatsApp fetch error ${phone}: ${err.message}`);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, sentEmail, sentWhatsapp, totalAgendamentos: agendamentos.length }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in reminder service:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function hslToHex(hsl: string): string {
  const parts = hsl.split(" ");
  const h = parseInt(parts[0]) / 360;
  const s = parseInt(parts[1]) / 100;
  const l = parseInt(parts[2]) / 100;

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (c: number) => {
    const hex = Math.round(c * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
