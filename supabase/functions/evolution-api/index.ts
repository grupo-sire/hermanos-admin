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
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      throw new Error("Evolution API não configurada. Adicione EVOLUTION_API_URL e EVOLUTION_API_KEY.");
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase não configurado.");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    let { action, instanceName, phone, message, empresaId, token, number, integration, qrcode: reqQrCode } = body;

    // Slugify instanceName if exists
    if (instanceName) {
      instanceName = instanceName.trim().replace(/\s+/g, '-').toLowerCase();
    }

    const apiUrl = EVOLUTION_API_URL.replace(/\/$/, "");
    const headers = {
      "Content-Type": "application/json",
      apikey: EVOLUTION_API_KEY,
    };

    switch (action) {
      case "connect": {
        // Auto-resolve instance name from empresaId to override n8n 10X defaults
        if (empresaId) {
          const { data: empresaData } = await supabase
            .from("empresas")
            .select("slug, nome")
            .eq("id", empresaId)
            .single();

          if (empresaData) {
            instanceName = empresaData.slug || empresaData.nome || instanceName;
          }
        }

        // Slugify the final resolved instance name
        if (instanceName) {
          instanceName = instanceName.trim().replace(/\s+/g, '-').toLowerCase();
        }

        // 1. Check if instance exists and its state
        let isConnected = false;
        try {
          const statusRes = await fetch(`${apiUrl}/instance/connectionState/${instanceName}`, { headers });
          const statusData = await statusRes.json();
          isConnected = statusData?.instance?.state === "open";
        } catch (e) {
          console.log("Instance connection state check failed, might not exist yet.");
        }

        if (isConnected) {
          console.log(`Instance ${instanceName} is already connected.`);
        } else {
          // 2. Just Create Instance
          console.log(`Creating instance ${instanceName}...`);
          const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/chatbot-webhook`;
          
          await fetch(`${apiUrl}/instance/create`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              instanceName,
              qrcode: true,
              integration: integration || "WHATSAPP-BAILEYS",
              webhook: {
                enabled: true,
                url: webhookUrl,
                webhookByEvents: true,
                events: [
                  "MESSAGES_UPSERT",
                  "CONNECTION_UPDATE",
                  "MESSAGES_UPDATE",
                  "SEND_MESSAGE"
                ]
              }
            }),
          });
        }

        // 3. Get QR Code if not connected
        let qrCode = null;
        if (!isConnected) {
          const qrRes = await fetch(`${apiUrl}/instance/connect/${instanceName}`, { headers });
          const qrData = await qrRes.json();
          qrCode = qrData?.base64 || qrData?.code || null;
        }

        // 4. Save/Update config in DB
        const { data: existing } = await supabase
          .from("evolution_config")
          .select("id")
          .eq("empresa_id", empresaId || "")
          .limit(1)
          .maybeSingle();

        const configData = {
          instance_name: instanceName,
          api_url: apiUrl,
          connected: isConnected,
          qr_code: qrCode,
          empresa_id: empresaId || null,
        };

        if (existing) {
          await supabase.from("evolution_config").update(configData).eq("id", existing.id);
        } else {
          await supabase.from("evolution_config").insert(configData);
        }

        return new Response(JSON.stringify({ qrCode, connected: isConnected }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "status": {
        const res = await fetch(`${apiUrl}/instance/connectionState/${instanceName}`, { headers });
        const data = await res.json();
        const connected = data?.instance?.state === "open";
        let phoneNumber = null;

        if (connected) {
          try {
            const profileRes = await fetch(`${apiUrl}/instance/fetchInstances?instanceName=${instanceName}`, { headers });
            const profileData = await profileRes.json();
            phoneNumber = profileData?.[0]?.instance?.owner || null;
          } catch {}
        }

        let qrCodeData = null;
        if (!connected) {
          try {
            const qrRes = await fetch(`${apiUrl}/instance/connect/${instanceName}`, { headers });
            const qrJson = await qrRes.json();
            qrCodeData = qrJson?.base64 || null;
          } catch {}
        }

        return new Response(JSON.stringify({ connected, phone: phoneNumber, qrCode: qrCodeData }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "disconnect": {
        try {
          await fetch(`${apiUrl}/instance/logout/${instanceName}`, {
            method: "DELETE",
            headers,
          });
        } catch {
          // Instance might already be disconnected
        }

        return new Response(JSON.stringify({ success: true, disconnected: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "send": {
        if (!phone || !message) throw new Error("Telefone e mensagem são obrigatórios");

        const res = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            number: phone,
            text: message,
          }),
        });

        const data = await res.json();

        // Save message
        await supabase.from("whatsapp_mensagens").insert({
          telefone: phone,
          mensagem: message,
          direcao: "enviada",
          tipo: "text",
        });

        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "active-webhook": {
        const baseUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
        const apiKey = Deno.env.get("EVOLUTION_API_KEY");
        const selfUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/chatbot-webhook`;

        console.log(`Tentando ativar webhook para [${instanceName}] em [${baseUrl}]...`);
        
        const res = await fetch(`${baseUrl}/webhook/set/${instanceName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': apiKey || ""
          },
          body: JSON.stringify({
            enabled: true,
            url: selfUrl,
            webhookByEvents: false,
            events: [
              "MESSAGES_UPSERT",
              "MESSAGES_UPDATE",
              "MESSAGES_DELETE",
              "SEND_MESSAGE",
              "CONNECTION_UPDATE",
              "QRCODE_UPDATED"
            ]
          })
        });

        const data = await res.json();
        
        if (!res.ok) {
          console.error("Erro na Evolution API:", data);
          throw new Error(`Evolution API: ${JSON.stringify(data)}`);
        }

        console.log("Webhook ativado com sucesso:", data);
        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }
  } catch (error: any) {
    console.error("Evolution API error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
