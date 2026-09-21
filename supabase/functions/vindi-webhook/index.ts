import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Webhook Receiver Oficial da Vindi (Conforme documentação oficial Vindi Webhooks)
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
    const eventType = body.type;
    const subscription = body.data?.subscription;

    console.log(`[VINDI WEBHOOK] Evento recebido: ${eventType}`);

    if (subscription && subscription.customer?.email) {
      const email = subscription.customer.email.toLowerCase();
      const status = subscription.status;
      const planoNome = subscription.plan?.name || "Infinite Barb";

      let proxDataFmt = "";
      if (subscription.next_billing_at) {
        let dt = new Date(subscription.next_billing_at);
        const now = new Date();
        while (dt <= now) {
          dt.setMonth(dt.getMonth() + 1);
        }
        proxDataFmt = dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
      }

      // Sincronizar na tabela clientes no Supabase
      const { error: updateErr } = await supabase
        .from("clientes")
        .update({
          is_infinite: status === "active",
          plano_infinite: status === "active" ? planoNome : null,
          vindi_status: status,
          updated_at: new Date().toISOString(),
        })
        .ilike("email", email);

      if (updateErr) {
        console.error("Erro ao atualizar cliente via webhook Vindi:", updateErr);
      } else {
        console.log(`[VINDI WEBHOOK] Cliente ${email} atualizado com sucesso para status=${status}`);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Erro no webhook Vindi:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
