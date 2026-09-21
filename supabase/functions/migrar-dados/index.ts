import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Cloud Supabase (Sistema X - source)
const CLOUD_URL = "https://otztxwktxnabxgodqmqw.supabase.co";
const CLOUD_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90enR4d2t0eG5hYnhnb2RxbXF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1MDAxNzAsImV4cCI6MjA4NjA3NjE3MH0.18t95FfpiYoKcf-0BJ6ieOM2hSOSlYA5pCuUhlonG7U";

// Tables to migrate in dependency order (children last)
const TABLES_ORDER = [
  "empresa_config",
  "unidades",
  "categorias",
  "servicos",
  "produtos",
  "clientes",
  "barbeiros",
  "planos_fidelidade",
  "cupons",
  "campanhas",
  "horarios_funcionamento",
  "crm_funil_estagios",
  "email_config",
  "evolution_config",
  "chatbot_fluxos",
  "chatbot_flows",
  "perfis_acesso",
  "agendamentos",
  "agendamento_servicos",
  "agenda_bloqueios",
  "comandas",
  "comanda_itens",
  "crm_funil_clientes",
  "crm_interacoes",
  "cliente_pontos",
  "estoque_movimentacoes",
  "campanha_envios",
  "ads_metrics",
  "whatsapp_conversas",
  "whatsapp_mensagens",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email e senha são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Authenticate on Cloud Supabase
    const cloudClient = createClient(CLOUD_URL, CLOUD_ANON_KEY);
    const { data: authData, error: authError } = await cloudClient.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.session) {
      return new Response(
        JSON.stringify({ error: "Falha ao autenticar no Cloud: " + (authError?.message || "sem sessão") }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[migrar-dados] Autenticado no Cloud com sucesso");

    // 2. Create admin client for current Supabase (destination)
    const destClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const results: Record<string, { read: number; written: number; error?: string }> = {};

    // 3. Migrate each table
    for (const table of TABLES_ORDER) {
      try {
        console.log(`[migrar-dados] Lendo ${table} do Cloud...`);

        // Read all data from Cloud (paginated to handle >1000 rows)
        let allData: any[] = [];
        let offset = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await cloudClient
            .from(table)
            .select("*")
            .range(offset, offset + pageSize - 1);

          if (error) {
            console.error(`[migrar-dados] Erro ao ler ${table}:`, error.message);
            results[table] = { read: 0, written: 0, error: error.message };
            hasMore = false;
            break;
          }

          if (data && data.length > 0) {
            allData = allData.concat(data);
            offset += pageSize;
            hasMore = data.length === pageSize;
          } else {
            hasMore = false;
          }
        }

        if (results[table]?.error) continue;

        results[table] = { read: allData.length, written: 0 };

        if (allData.length === 0) {
          console.log(`[migrar-dados] ${table}: sem dados`);
          continue;
        }

        // Write to destination in batches
        const batchSize = 100;
        let totalWritten = 0;

        for (let i = 0; i < allData.length; i += batchSize) {
          const batch = allData.slice(i, i + batchSize);
          const { error: writeError } = await destClient
            .from(table)
            .upsert(batch, { onConflict: "id", ignoreDuplicates: false });

          if (writeError) {
            console.error(`[migrar-dados] Erro ao escrever ${table}:`, writeError.message);
            results[table].error = writeError.message;
            break;
          }
          totalWritten += batch.length;
        }

        results[table].written = totalWritten;
        console.log(`[migrar-dados] ${table}: ${allData.length} lidos, ${totalWritten} escritos`);
      } catch (tableError) {
        console.error(`[migrar-dados] Erro em ${table}:`, tableError);
        results[table] = { read: 0, written: 0, error: String(tableError) };
      }
    }

    // Also migrate user_roles and profiles
    for (const table of ["profiles", "user_roles", "convites", "perfil_permissoes"]) {
      try {
        const { data, error } = await cloudClient.from(table).select("*");
        if (error) {
          results[table] = { read: 0, written: 0, error: error.message };
          continue;
        }
        results[table] = { read: data?.length || 0, written: 0 };
        if (data && data.length > 0) {
          const { error: writeError } = await destClient
            .from(table)
            .upsert(data, { onConflict: "id", ignoreDuplicates: false });
          if (writeError) {
            results[table].error = writeError.message;
          } else {
            results[table].written = data.length;
          }
        }
        console.log(`[migrar-dados] ${table}: ${data?.length || 0} lidos, ${results[table].written} escritos`);
      } catch (e) {
        results[table] = { read: 0, written: 0, error: String(e) };
      }
    }

    // Sign out from Cloud
    await cloudClient.auth.signOut();

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[migrar-dados] Error:", error);
    return new Response(
      JSON.stringify({ error: "Erro na migração: " + String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
