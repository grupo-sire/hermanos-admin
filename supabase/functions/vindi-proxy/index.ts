import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VINDI_SANDBOX_BASE_URL = "https://sandbox-app.vindi.com.br/api/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("VINDI_API_KEY") || Deno.env.get("VITE_VINDI_API_KEY");
    const body = await req.json().catch(() => ({}));
    const { action, email, subscriptionId } = body;

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "VINDI_API_KEY não configurada nos secrets do Supabase.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = `Basic ${btoa(apiKey + ":")}`;
    const headers = {
      "Authorization": authHeader,
      "Content-Type": "application/json"
    };

    // =========================================================================
    // AÇÃO 1: CONSULTAR ASSINATURA (GET /customers por email + GET /subscriptions por customer_id)
    // Conforme especificação oficial Swagger Vindi 2.0
    // =========================================================================
    if (action === "consultar_assinatura") {
      if (!email) {
        return new Response(
          JSON.stringify({ error: "E-mail do cliente é obrigatório." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let customerId: number | null = null;
      let customerName = "";
      let customerEmail = email;

      // PASSO 1 DA SWAGGER DOC VINDI: GET /v1/customers?query=email:...
      try {
        const custRes = await fetch(`${VINDI_SANDBOX_BASE_URL}/customers?query=email:${encodeURIComponent(email)}`, {
          method: "GET",
          headers
        });

        if (custRes.ok) {
          const custData = await custRes.json();
          const custObj = custData.customers?.[0];
          if (custObj) {
            customerId = custObj.id;
            customerName = custObj.name || "";
            customerEmail = custObj.email || email;
          }
        }
      } catch (custErr) {
        console.warn("Aviso na busca de cliente Vindi:", custErr);
      }

      // PASSO 2 DA SWAGGER DOC VINDI: GET /v1/subscriptions?query=customer_id:...
      let subscriptionsUrl = `${VINDI_SANDBOX_BASE_URL}/subscriptions?query=customer_email:${encodeURIComponent(email)}`;
      if (customerId) {
        subscriptionsUrl = `${VINDI_SANDBOX_BASE_URL}/subscriptions?query=customer_id:${customerId}`;
      }

      const res = await fetch(subscriptionsUrl, {
        method: "GET",
        headers
      });

      if (!res.ok) {
        const errText = await res.text();
        return new Response(
          JSON.stringify({ error: `Erro na API Vindi: ${res.status}`, detail: errText }),
          { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await res.json();
      const sub = data.subscriptions?.[0];

      if (!sub || sub.status !== "active") {
        return new Response(
          JSON.stringify({
            success: true,
            isInfinite: false,
            planoNome: "Cliente Avulso",
            status: sub?.status || "inactive"
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // PASSO 3 SWAGGER DOC VINDI: Processar next_billing_at no ciclo ativo futuro
      let proxDataFmt = "";
      const now = new Date();

      if (sub.next_billing_at) {
        let dt = new Date(sub.next_billing_at);
        while (dt <= now) {
          dt.setMonth(dt.getMonth() + 1);
        }
        proxDataFmt = dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
      }

      let inicioFmt = "";
      if (sub.start_at || sub.created_at) {
        const dt = new Date(sub.start_at || sub.created_at);
        inicioFmt = dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
      }

      return new Response(
        JSON.stringify({
          success: true,
          isInfinite: true,
          planoNome: sub.plan?.name || "Infinite Barb",
          status: sub.status,
          proximaCobrancaData: proxDataFmt || "09/10/2026",
          dataInicio: inicioFmt || "09/08/2026",
          subscriptionId: sub.id,
          customerId: sub.customer?.id || customerId,
          customerName: sub.customer?.name || customerName,
          customerEmail: sub.customer?.email || customerEmail
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =========================================================================
    // AÇÃO 2: REATIVAR ASSINATURA (POST /v1/subscriptions/{id}/reactivate)
    // Conforme especificação oficial Swagger Vindi
    // =========================================================================
    if (action === "reativar_assinatura") {
      if (!subscriptionId) {
        return new Response(
          JSON.stringify({ error: "subscriptionId é obrigatório." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const res = await fetch(`${VINDI_SANDBOX_BASE_URL}/subscriptions/${subscriptionId}/reactivate`, {
        method: "POST",
        headers
      });

      const data = await res.json();
      return new Response(
        JSON.stringify({ success: res.ok, data }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =========================================================================
    // AÇÃO 3: CANCELAR ASSINATURA (DELETE /v1/subscriptions/{id}?cancel_bills=true)
    // Conforme especificação oficial Swagger Vindi
    // =========================================================================
    if (action === "cancelar_assinatura") {
      if (!subscriptionId) {
        return new Response(
          JSON.stringify({ error: "subscriptionId é obrigatório." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const res = await fetch(`${VINDI_SANDBOX_BASE_URL}/subscriptions/${subscriptionId}?cancel_bills=true`, {
        method: "DELETE",
        headers
      });

      const data = await res.json();
      return new Response(
        JSON.stringify({ success: res.ok, data }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =========================================================================
    // AÇÃO 4: RENOVAR / ADIANTAR COBRANÇA (POST /v1/subscriptions/{id}/renew)
    // Conforme especificação oficial Swagger Vindi
    // =========================================================================
    if (action === "renovar_assinatura") {
      if (!subscriptionId) {
        return new Response(
          JSON.stringify({ error: "subscriptionId é obrigatório." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const res = await fetch(`${VINDI_SANDBOX_BASE_URL}/subscriptions/${subscriptionId}/renew`, {
        method: "POST",
        headers
      });

      const data = await res.json();
      return new Response(
        JSON.stringify({ success: res.ok, data }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Ação não informada ou inválida." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
