import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const WEBHOOK_SECRET = Deno.env.get("ADS_WEBHOOK_SECRET");

    // Validate webhook secret if configured
    if (WEBHOOK_SECRET) {
      const incomingSecret = req.headers.get("x-webhook-secret");
      if (incomingSecret !== WEBHOOK_SECRET) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();

    // Support both single metric and batch
    const metrics = Array.isArray(body) ? body : [body];

    if (metrics.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhuma métrica enviada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate and normalize each metric
    const rows = metrics.map((m: any) => {
      if (!m.plataforma || !m.data_referencia) {
        throw new Error("Campos obrigatórios: plataforma, data_referencia");
      }

      return {
        empresa_id: m.empresa_id,
        plataforma: m.plataforma,
        conta_id: m.conta_id || null,
        conta_nome: m.conta_nome || null,
        campanha_id_externo: m.campanha_id_externo || null,
        campanha_nome: m.campanha_nome || null,
        data_referencia: m.data_referencia,
        impressoes: m.impressoes || 0,
        cliques: m.cliques || 0,
        alcance: m.alcance || 0,
        conversoes: m.conversoes || 0,
        gasto: m.gasto || 0,
        cpc: m.cpc || 0,
        cpm: m.cpm || 0,
        ctr: m.ctr || 0,
        roas: m.roas || 0,
        receita: m.receita || 0,
        dados_extras: m.dados_extras || {},
      };
    });

    // Upsert based on plataforma + campanha_id_externo + data_referencia
    const { data, error } = await supabase
      .from("ads_metrics")
      .upsert(rows, {
        onConflict: "plataforma,campanha_id_externo,data_referencia",
        ignoreDuplicates: false,
      });

    if (error) {
      console.error("Erro ao inserir métricas:", error);
      // Fallback: insert one by one for rows without campanha_id_externo
      let inserted = 0;
      let errors = 0;
      for (const row of rows) {
        const { error: rowErr } = await supabase.from("ads_metrics").insert(row);
        if (rowErr) {
          console.error("Erro na linha:", rowErr);
          errors++;
        } else {
          inserted++;
        }
      }
      return new Response(JSON.stringify({
        success: true,
        inserted,
        errors,
        message: `${inserted} métricas inseridas, ${errors} erros`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      count: rows.length,
      message: `${rows.length} métrica(s) sincronizada(s) com sucesso`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Erro no webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
