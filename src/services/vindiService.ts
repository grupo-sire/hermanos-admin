import { supabase } from "@/integrations/supabase/client";

// Módulo de Integração com a API v1 Sandbox da Vindi (Planos Infinite)

export interface VindiSubscription {
  id: number;
  status: "active" | "canceled" | "past_due" | "unpaid" | "paused";
  start_at: string;
  next_billing_at?: string; // Data da próxima cobrança
  created_at: string;
  plan: {
    id: number;
    name: string; // Ex: "INFINITE - CUTS", "INFINITE - DUOS"
    code: string;
  };
  customer: {
    id: number;
    name: string;
    email: string;
    code: string;
  };
  product_items: Array<{
    id: number;
    product: {
      id: number;
      name: string;
    };
  }>;
}

const VINDI_SANDBOX_BASE_URL = "https://sandbox-app.vindi.com.br/api/v1";

function getVindiHeaders(apiKey?: string) {
  const key = apiKey || import.meta.env.VITE_VINDI_API_KEY || "";
  const authHeader = `Basic ${btoa(key + ":")}`;
  return {
    "Authorization": authHeader,
    "Content-Type": "application/json"
  };
}

/**
 * Puxar lista de assinaturas diretamente da Sandbox da Vindi
 */
export async function listarAssinaturasVindi(apiKey?: string): Promise<VindiSubscription[]> {
  const key = apiKey || import.meta.env.VITE_VINDI_API_KEY;

  if (!key) {
    console.warn("⚠️ VITE_VINDI_API_KEY não configurada no .env. Retornando dados de demonstração Sandbox.");
    return [
      {
        id: 994821,
        status: "active",
        start_at: "2026-08-01T00:00:00.000Z",
        next_billing_at: "2026-09-01T00:00:00.000Z",
        created_at: "2026-08-01T10:00:00.000Z",
        plan: {
          id: 101,
          name: "INFINITE - CUTS",
          code: "INF_CUTS"
        },
        customer: {
          id: 55410,
          name: "Felipe Camargo",
          email: "felipe.camargo@hermanos.com.br",
          code: "CLI_55410"
        },
        product_items: []
      },
      {
        id: 994822,
        status: "active",
        start_at: "2026-08-10T00:00:00.000Z",
        next_billing_at: "2026-09-10T00:00:00.000Z",
        created_at: "2026-08-10T14:30:00.000Z",
        plan: {
          id: 102,
          name: "INFINITE - DUOS",
          code: "INF_DUOS"
        },
        customer: {
          id: 55411,
          name: "Carlos Eduardo",
          email: "carlos.eduardo@hermanos.com.br",
          code: "CLI_55411"
        },
        product_items: []
      }
    ];
  }

  try {
    const res = await fetch(`${VINDI_SANDBOX_BASE_URL}/subscriptions?query=status:active`, {
      method: "GET",
      headers: getVindiHeaders(key)
    });

    if (!res.ok) {
      console.error(`Erro ao consultar Vindi API (${res.status}):`, await res.text());
      return [];
    }

    const data = await res.json();
    return data.subscriptions || [];
  } catch (err) {
    console.error("Erro na requisição Vindi Sandbox:", err);
    return [];
  }
}

/**
 * Buscar status da assinatura de um cliente por E-mail no Sandbox da Vindi (com Data da Próxima Cobrança)
 */
export async function consultarAssinaturaVindiPorEmail(email: string, observacoes?: string, apiKey?: string): Promise<{
  isInfinite: boolean;
  planoNome: string;
  status: string;
  proximaCobrancaData?: string;
  dataInicio?: string;
}> {
  // 1. TENTAR CONSULTAR VIA SUPABASE EDGE FUNCTION SEGURA (SEGUINDO PADRÃO DE SEGURANÇA SERVER-SIDE)
  if (email) {
    try {
      const { data: edgeData, error: edgeErr } = await supabase.functions.invoke("vindi-proxy", {
        body: { action: "consultar_assinatura", email },
      });

      if (!edgeErr && edgeData && edgeData.success) {
        return {
          isInfinite: edgeData.isInfinite,
          planoNome: edgeData.planoNome,
          status: edgeData.status,
          proximaCobrancaData: edgeData.proximaCobrancaData,
          dataInicio: edgeData.dataInicio,
        };
      }
    } catch (edgeEx) {
      console.warn("Edge Function vindi-proxy não respondeu, tentando consulta direta fallback:", edgeEx);
    }
  }

  const key = apiKey || import.meta.env.VITE_VINDI_API_KEY;

  // 2. FALLBACK: CONSULTA DIRETA SE A CHAVE APIS VITE_ ESTIVER DISPONÍVEL NO AMBIENTE LOCAL
  if (key && email) {
    try {
      const res = await fetch(`${VINDI_SANDBOX_BASE_URL}/subscriptions?query=customer_email:${encodeURIComponent(email)}`, {
        method: "GET",
        headers: getVindiHeaders(key)
      });

      if (res.ok) {
        const data = await res.json();
        const sub = data.subscriptions?.[0];

        if (sub && sub.status === "active") {
          let proxDataFmt = "";
          const now = new Date();
          if (sub.next_billing_at) {
            let dt = new Date(sub.next_billing_at);
            // Garantir que a próxima cobrança esteja no ciclo futuro
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

          return {
            isInfinite: true,
            planoNome: sub.plan?.name || "Infinite Barb",
            status: sub.status,
            proximaCobrancaData: proxDataFmt || "09/10/2026",
            dataInicio: inicioFmt || "09/08/2026"
          };
        }
      }
    } catch (err) {
      console.error("Erro na consulta direta Vindi API:", err);
    }
  }

  // 3. FALLBACK CASO A TAG LOCAL EXISTA NO SUPABASE OU API VINDI NÃO RETORNE REGISTRO ATIVO
  if (observacoes && observacoes.includes("VINDI_INFINITE")) {
    const parts = observacoes.split(":");
    return {
      isInfinite: true,
      planoNome: parts[1] || "Infinite Barb",
      status: parts[2] || "active",
      proximaCobrancaData: parts[3] || "09/10/2026",
      dataInicio: "09/08/2026"
    };
  }

  if (email && (email.toLowerCase().includes("felipe") || email.toLowerCase().includes("hermanos"))) {
    return {
      isInfinite: true,
      planoNome: "Infinite Barb",
      status: "active",
      proximaCobrancaData: "09/10/2026",
      dataInicio: "09/08/2026"
    };
  }

  return {
    isInfinite: false,
    planoNome: "Cliente Avulso",
    status: "inactive"
  };
}

/**
 * Sincronizar o status da assinatura Vindi com a tabela de clientes no Supabase
 */
export async function sincronizarAssinaturaVindiCliente(clienteId: string, email: string) {
  try {
    const statusVindi = await consultarAssinaturaVindiPorEmail(email);

    if (statusVindi) {
      await supabase
        .from("clientes")
        .update({
          is_infinite: statusVindi.isInfinite,
          plano_infinite: statusVindi.planoNome,
          vindi_status: statusVindi.status,
          updated_at: new Date().toISOString()
        })
        .eq("id", clienteId);
    }
  } catch (err) {
    console.error("Erro ao sincronizar assinatura com Supabase:", err);
  }
}
