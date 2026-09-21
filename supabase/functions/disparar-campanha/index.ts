import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { campanha_id, canal } = await req.json();

    if (!campanha_id) throw new Error("campanha_id é obrigatório");

    // Fetch campaign
    const { data: campanha, error: campErr } = await supabase
      .from("campanhas")
      .select("*")
      .eq("id", campanha_id)
      .single();

    if (campErr || !campanha) throw new Error("Campanha não encontrada");

    // Determine target clients based on campaign type
    let clientesQuery = supabase.from("clientes").select("id, nome, telefone, email, data_nascimento, ultima_visita");

    if (campanha.tipo === "lembrete") {
      // Clients inactive for X days
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - (campanha.dias_inatividade || 30));
      clientesQuery = clientesQuery.or(`ultima_visita.lt.${cutoff.toISOString()},ultima_visita.is.null`);
    } else if (campanha.tipo === "aniversario") {
      // Clients with birthday in next X days
      const today = new Date();
      const dias = campanha.dias_antecedencia || 7;
      // We'll filter in JS since SQL date part comparison is complex
    }

    const { data: clientes, error: cliErr } = await clientesQuery;
    if (cliErr) throw new Error("Erro ao buscar clientes: " + cliErr.message);

    let targetClientes = clientes || [];

    // Filter for birthday campaigns in JS
    if (campanha.tipo === "aniversario") {
      const today = new Date();
      const dias = campanha.dias_antecedencia || 7;
      targetClientes = targetClientes.filter(c => {
        if (!c.data_nascimento) return false;
        const birth = new Date(c.data_nascimento);
        const thisYearBirthday = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
        const diffDays = Math.ceil((thisYearBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= dias;
      });
    }

    // Check which clients already received this campaign today (avoid duplicates)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data: jaEnviados } = await supabase
      .from("campanha_envios")
      .select("cliente_id")
      .eq("campanha_id", campanha_id)
      .gte("created_at", todayStart.toISOString());

    const jaEnviadosIds = new Set((jaEnviados || []).map(e => e.cliente_id));
    targetClientes = targetClientes.filter(c => !jaEnviadosIds.has(c.id));

    if (targetClientes.length === 0) {
      return new Response(JSON.stringify({ success: true, enviados: 0, message: "Nenhum cliente elegível ou todos já receberam hoje" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Evolution instance for WhatsApp
    let evolutionInstance: string | null = null;
    let evolutionApiUrl: string | null = null;
    if (canal === "whatsapp" && EVOLUTION_API_URL && EVOLUTION_API_KEY) {
      const { data: evoConfig } = await supabase
        .from("evolution_config")
        .select("*")
        .eq("empresa_id", campanha.empresa_id)
        .eq("connected", true)
        .maybeSingle();
      
      if (evoConfig) {
        evolutionInstance = evoConfig.instance_name;
        evolutionApiUrl = EVOLUTION_API_URL.replace(/\/$/, "");
      }
    }

    // Get empresa config for branding
    const { data: empresa } = await supabase
      .from("empresa_config")
      .select("nome, cor_primaria, logo_url")
      .eq("empresa_id", campanha.empresa_id)
      .maybeSingle();

    let enviados = 0;
    let falhas = 0;
    const enviosToInsert: any[] = [];

    for (const cliente of targetClientes) {
      // Build personalized message
      let msg = campanha.mensagem || `Olá ${cliente.nome}! ${campanha.nome}`;
      msg = msg.replace(/\{\{nome\}\}/g, cliente.nome);
      msg = msg.replace(/\{\{empresa\}\}/g, empresa?.nome || "");

      if (campanha.desconto_percentual) {
        msg = msg.replace(/\{\{desconto\}\}/g, `${campanha.desconto_percentual}%`);
      }
      if (campanha.cashback_percentual) {
        msg = msg.replace(/\{\{cashback\}\}/g, `${campanha.cashback_percentual}%`);
      }

      try {
        if (canal === "whatsapp") {
          if (!evolutionInstance || !evolutionApiUrl) {
            throw new Error("WhatsApp não conectado");
          }
          if (!cliente.telefone) {
            throw new Error("Cliente sem telefone");
          }

          // Send via Evolution API
          const phone = cliente.telefone.replace(/\D/g, "");
          const res = await fetch(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: EVOLUTION_API_KEY!,
            },
            body: JSON.stringify({ number: phone, text: msg }),
          });

          if (!res.ok) {
            const errData = await res.text();
            throw new Error(`Evolution API error: ${errData}`);
          }

          // Save to whatsapp_mensagens
          await supabase.from("whatsapp_mensagens").insert({
            telefone: phone,
            mensagem: msg,
            direcao: "enviada",
            tipo: "text",
            cliente_id: cliente.id,
            empresa_id: campanha.empresa_id,
          });

          enviosToInsert.push({
            campanha_id,
            cliente_id: cliente.id,
            canal: "whatsapp",
            status: "enviado",
            mensagem: msg,
            empresa_id: campanha.empresa_id,
          });
          enviados++;

        } else if (canal === "email") {
          if (!RESEND_API_KEY) throw new Error("Resend não configurado");
          if (!cliente.email) throw new Error("Cliente sem email");

          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: "noreply@10xmarketing.com.br",
              to: [cliente.email],
              subject: campanha.nome,
              html: `<div style="font-family:sans-serif;padding:20px;"><p>${msg.replace(/\n/g, "<br>")}</p></div>`,
            }),
          });

          if (!res.ok) {
            const errData = await res.text();
            throw new Error(`Resend error: ${errData}`);
          }

          enviosToInsert.push({
            campanha_id,
            cliente_id: cliente.id,
            canal: "email",
            status: "enviado",
            mensagem: msg,
            empresa_id: campanha.empresa_id,
          });
          enviados++;
        }
      } catch (err: any) {
        falhas++;
        enviosToInsert.push({
          campanha_id,
          cliente_id: cliente.id,
          canal,
          status: "falha",
          mensagem: msg,
          erro: err.message,
          empresa_id: campanha.empresa_id,
        });
      }
    }

    // Batch insert envios
    if (enviosToInsert.length > 0) {
      await supabase.from("campanha_envios").insert(enviosToInsert);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      enviados, 
      falhas, 
      total: targetClientes.length,
      message: `${enviados} mensagens enviadas, ${falhas} falhas` 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Erro no disparo:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
