import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const event = body.event;
    const payment = body.payment;

    if (!event || !payment) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find empresa by asaas_customer_id
    const customerId = payment.customer;
    const { data: empresa } = await supabase
      .from("empresas")
      .select("id")
      .eq("asaas_customer_id", customerId)
      .single();

    if (!empresa) {
      console.log("Empresa not found for customer:", customerId);
      return new Response(JSON.stringify({ ok: true, message: "Customer not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const empresaId = empresa.id;

    switch (event) {
      case "PAYMENT_CONFIRMED":
      case "PAYMENT_RECEIVED": {
        // Payment received - clear inadimplência
        await supabase.from("empresa_assinaturas").insert({
          empresa_id: empresaId,
          asaas_payment_id: payment.id,
          asaas_subscription_id: payment.subscription || null,
          status: "paid",
          valor: payment.value || 0,
          data_vencimento: payment.dueDate || null,
          data_pagamento: new Date().toISOString(),
          dias_inadimplente: 0,
        });
        break;
      }

      case "PAYMENT_OVERDUE": {
        // Payment overdue - calculate days
        const dueDate = payment.dueDate ? new Date(payment.dueDate) : new Date();
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        await supabase.from("empresa_assinaturas").insert({
          empresa_id: empresaId,
          asaas_payment_id: payment.id,
          asaas_subscription_id: payment.subscription || null,
          status: "overdue",
          valor: payment.value || 0,
          data_vencimento: payment.dueDate || null,
          data_inadimplencia: new Date().toISOString(),
          dias_inadimplente: Math.max(diffDays, 1),
        });
        break;
      }

      case "PAYMENT_CREATED": {
        await supabase.from("empresa_assinaturas").insert({
          empresa_id: empresaId,
          asaas_payment_id: payment.id,
          asaas_subscription_id: payment.subscription || null,
          status: "pending",
          valor: payment.value || 0,
          data_vencimento: payment.dueDate || null,
          dias_inadimplente: 0,
        });
        break;
      }

      default:
        console.log("Unhandled event:", event);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
