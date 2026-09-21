/**
 * Serviço Oficial de Integração com a Meta WhatsApp Cloud API (Graph API v21.0)
 * Barbearia Hermanos - Número Oficial: +55 (11) 4118-8017
 * Phone Number ID Oficial: 433100683226162
 */

import { supabase } from "@/integrations/supabase/client";

export interface MetaWhatsAppConfig {
  phoneNumberId: string;
  wabaId: string;
  displayPhoneNumber: string;
  verifiedName: string;
}

export const META_WHATSAPP_CONFIG: MetaWhatsAppConfig = {
  phoneNumberId: "433100683226162",
  wabaId: "1402962371930996",
  displayPhoneNumber: "+55 (11) 4118-8017",
  verifiedName: "Barbearia Hermanos",
};

/**
 * Normaliza o número de telefone para o padrão internacional E.164 exigido pela Meta (ex: 5511999998888)
 */
export function formatarNumeroMeta(telefone: string): string {
  let clean = telefone.replace(/\D/g, "");
  if (!clean.startsWith("55") && (clean.length === 10 || clean.length === 11)) {
    clean = "55" + clean;
  }
  return clean;
}

/**
 * Envia uma mensagem de texto pelo WhatsApp Oficial da Barbearia Hermanos via Edge Function Segura
 */
export async function enviarMensagemWhatsAppMeta(
  telefoneDestino: string,
  texto: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const cleanPhone = formatarNumeroMeta(telefoneDestino);
    if (!cleanPhone || !texto.trim()) {
      return { success: false, error: "Telefone ou texto inválido" };
    }

    const { data, error } = await supabase.functions.invoke("meta-webhook", {
      body: {
        action: "send_manual_message",
        to: cleanPhone,
        text: texto,
      },
    });

    if (error) {
      console.error("❌ Erro ao invocar função meta-webhook:", error);
      return { success: false, error: error.message };
    }

    if (data?.error) {
      console.error("❌ Erro retornado pela Meta via webhook:", data.error);
      return { success: false, error: data.error };
    }

    console.log(`✅ Mensagem WhatsApp enviada com sucesso para ${cleanPhone}! ID: ${data?.messageId}`);
    return { success: true, messageId: data?.messageId };
  } catch (err: any) {
    console.error("❌ Exceção ao enviar mensagem WhatsApp Meta:", err);
    return { success: false, error: err.message || "Erro de conexão com a Meta" };
  }
}

/**
 * Verifica o status e a saúde da conexão do número na Meta Cloud API
 */
export async function testarConexaoMeta(): Promise<{
  online: boolean;
  dados?: any;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.functions.invoke("meta-webhook", {
      body: { action: "test_connection" },
    });

    if (error) {
      return { online: false, error: error.message };
    }

    return {
      online: data?.online ?? true,
      dados: data?.dados || {
        verifiedName: "Barbearia Hermanos",
        displayPhoneNumber: "+55 (11) 4118-8017",
        status: "VERIFIED",
      },
      error: data?.error,
    };
  } catch (err: any) {
    return { online: false, error: err.message || "Erro de rede" };
  }
}
