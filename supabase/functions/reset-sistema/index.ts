import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the user with their token
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
    } = await supabaseUser.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to check admin and delete data
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify admin role
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin");

    if (!roles || roles.length === 0) {
      return new Response(
        JSON.stringify({ error: "Apenas administradores podem redefinir o sistema" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[reset-sistema] Admin ${user.id} iniciou reset do sistema`);

    // Delete all business data (children first, then parents)
    const nilUUID = "00000000-0000-0000-0000-000000000000";

    await supabaseAdmin.from("comanda_itens").delete().neq("id", nilUUID);
    console.log("[reset-sistema] comanda_itens deleted");

    await supabaseAdmin.from("comandas").delete().neq("id", nilUUID);
    console.log("[reset-sistema] comandas deleted");

    await supabaseAdmin.from("agendamentos").delete().neq("id", nilUUID);
    console.log("[reset-sistema] agendamentos deleted");

    await supabaseAdmin.from("agenda_bloqueios").delete().neq("id", nilUUID);
    console.log("[reset-sistema] agenda_bloqueios deleted");

    await supabaseAdmin.from("crm_interacoes").delete().neq("id", nilUUID);
    console.log("[reset-sistema] crm_interacoes deleted");

    await supabaseAdmin.from("cliente_pontos").delete().neq("id", nilUUID);
    console.log("[reset-sistema] cliente_pontos deleted");

    await supabaseAdmin.from("estoque_movimentacoes").delete().neq("id", nilUUID);
    console.log("[reset-sistema] estoque_movimentacoes deleted");

    await supabaseAdmin.from("barbeiros").delete().neq("id", nilUUID);
    console.log("[reset-sistema] barbeiros deleted");

    await supabaseAdmin.from("clientes").delete().neq("id", nilUUID);
    console.log("[reset-sistema] clientes deleted");

    await supabaseAdmin.from("servicos").delete().neq("id", nilUUID);
    console.log("[reset-sistema] servicos deleted");

    await supabaseAdmin.from("produtos").delete().neq("id", nilUUID);
    console.log("[reset-sistema] produtos deleted");

    await supabaseAdmin.from("campanhas").delete().neq("id", nilUUID);
    console.log("[reset-sistema] campanhas deleted");

    await supabaseAdmin.from("cupons").delete().neq("id", nilUUID);
    console.log("[reset-sistema] cupons deleted");

    await supabaseAdmin.from("planos_fidelidade").delete().neq("id", nilUUID);
    console.log("[reset-sistema] planos_fidelidade deleted");

    await supabaseAdmin.from("horarios_funcionamento").delete().neq("id", nilUUID);
    console.log("[reset-sistema] horarios_funcionamento deleted");

    await supabaseAdmin.from("unidades").delete().neq("id", nilUUID);
    console.log("[reset-sistema] unidades deleted");

    await supabaseAdmin.from("empresa_config").delete().neq("id", nilUUID);
    console.log("[reset-sistema] empresa_config deleted");

    // Delete all files from logos bucket
    try {
      const { data: logos } = await supabaseAdmin.storage.from("logos").list();
      if (logos && logos.length > 0) {
        await supabaseAdmin.storage.from("logos").remove(logos.map((f) => f.name));
        console.log(`[reset-sistema] ${logos.length} logos deleted from storage`);
      }
    } catch (storageError) {
      console.error("[reset-sistema] Error cleaning storage:", storageError);
    }

    console.log("[reset-sistema] Reset completo!");

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[reset-sistema] Error:", error);
    return new Response(JSON.stringify({ error: "Erro ao redefinir o sistema" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
