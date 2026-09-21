import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { table, rows } = await req.json();

    if (!table || !rows || !Array.isArray(rows) || rows.length === 0) {
      return new Response(
        JSON.stringify({ error: "table e rows são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const client = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const batchSize = 100;
    let totalWritten = 0;
    let lastError = null;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await client
        .from(table)
        .upsert(batch, { onConflict: "id", ignoreDuplicates: false });

      if (error) {
        console.error(`[importar-dados] Erro em ${table}:`, error.message);
        lastError = error.message;
        break;
      }
      totalWritten += batch.length;
    }

    console.log(`[importar-dados] ${table}: ${totalWritten}/${rows.length} escritos`);

    return new Response(
      JSON.stringify({ 
        success: !lastError, 
        table, 
        written: totalWritten, 
        total: rows.length,
        error: lastError 
      }),
      { status: lastError ? 500 : 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[importar-dados] Error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
