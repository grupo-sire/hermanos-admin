import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SelectedService {
  id: string;
  nome: string;
  preco: number;
  duracao_minutos: number;
}

interface BookingState {
  step: "service" | "more_services" | "unit" | "barber" | "date" | "time" | "confirm";
  services?: { id: string; nome: string; preco: number; duracao_minutos: number }[];
  selected_services?: SelectedService[];
  units?: { id: string; nome: string }[];
  barbers?: { id: string; nome: string }[];
  date_options?: string[];
  selected_unit_id?: string;
  selected_unit_name?: string;
  selected_barber_id?: string;
  selected_barber_name?: string;
  selected_date?: string;
  available_times?: string[];
  selected_time?: string;
}

interface FlowState {
  flow_id: string;
  current_node_id?: string;
  is_global_menu?: boolean;
}

// Simple in-memory dedup
const processedMessages = new Map<string, number>();
const DEDUP_WINDOW_MS = 10_000;

function isDuplicate(telefone: string, mensagem: string): boolean {
  const key = `${telefone}:${mensagem}`;
  const now = Date.now();
  const last = processedMessages.get(key);
  if (last && now - last < DEDUP_WINDOW_MS) return true;
  processedMessages.set(key, now);
  if (processedMessages.size > 500) {
    for (const [k, v] of processedMessages) {
      if (now - v > DEDUP_WINDOW_MS) processedMessages.delete(k);
    }
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();
    const instanceName = body?.instance || ""; 

    if (!instanceName) {
      return ok({ status: "missing_instance" });
    }

    // Identify the company based on the instanceName
    const { data: evoConfig, error: evoError } = await supabase
      .from("evolution_config")
      .select("empresa_id, instance_name")
      .eq("instance_name", instanceName)
      .limit(1)
      .maybeSingle();

    if (evoError || !evoConfig || !evoConfig.empresa_id) {
      console.error("Empresa não encontrada para a instância:", instanceName);
      return ok({ status: "empresa_not_found", instance: instanceName });
    }

    const empresaId = evoConfig.empresa_id;

    const event = body?.event || "";

    // 1. --- CONNECTION_UPDATE AUTO-CONFIG ---
    if (event === "connection.update") {
      const state = body?.data?.state || "";
      if (state === "open") {
        console.log(`🚀 Instance ${instanceName} connected! Auto-configuring webhook...`);
        const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
        const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
        const selfUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/chatbot-webhook`;

        if (EVOLUTION_API_URL && EVOLUTION_API_KEY) {
          try {
            await fetch(`${EVOLUTION_API_URL}/webhook/set/${instanceName}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
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
            console.log(`✅ Webhook auto-configured for ${instanceName}`);
          } catch (e) {
            console.error(`❌ Failed to auto-configure webhook for ${instanceName}:`, e);
          }
        }
      }
      return ok({ status: "connection_event_handled", state });
    }

    if (event && event !== "messages.upsert") {
      return ok({ status: "ignored_event", event });
    }

    if (body?.data?.key?.fromMe === true) {
      return ok({ status: "ignored_own_message" });
    }

    const remoteJid = body?.data?.key?.remoteJid || body?.remoteJid || "";
    if (remoteJid.includes("@g.us")) {
      return ok({ status: "ignored_group" });
    }

    const telefone = remoteJid.replace("@s.whatsapp.net", "");
    const mensagem = body?.data?.message?.conversation || body?.data?.message?.extendedTextMessage?.text || body?.message || "";

    if (!telefone || !mensagem) {
      return new Response(JSON.stringify({ error: "Missing phone or message" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (isDuplicate(telefone, mensagem)) {
      return ok({ status: "duplicate_ignored" });
    }

    // Save incoming message
    await supabase.from("whatsapp_mensagens").insert({
      telefone, mensagem, direcao: "recebida", tipo: "texto", empresa_id: empresaId,
    });

    // Upsert conversation
    const { data: existingConv } = await supabase.from("whatsapp_conversas")
      .select("*")
      .eq("telefone", telefone)
      .eq("empresa_id", empresaId)
      .maybeSingle();

    let convId: string;

    if (existingConv) {
      convId = existingConv.id;
      await supabase.from("whatsapp_conversas").update({
        ultima_mensagem: mensagem,
        ultima_mensagem_at: new Date().toISOString(),
        nao_lidas: (existingConv.nao_lidas || 0) + 1,
      }).eq("id", existingConv.id);

      if (existingConv.atendimento_humano) {
        return ok({ status: "human_takeover" });
      }
    } else {
      const { data: newConv } = await supabase.from("whatsapp_conversas").insert({
        telefone,
        nome_contato: body?.data?.pushName || telefone,
        ultima_mensagem: mensagem,
        ultima_mensagem_at: new Date().toISOString(),
        nao_lidas: 1,
        empresa_id: empresaId,
      }).select("id").single();
      convId = newConv?.id || "";
    }

    // ===== AGENTE IA — Check if AI agent is active for this company =====
    const { data: agente } = await supabase
      .from("agentes_ia")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("ativo", true)
      .maybeSingle();

    if (agente) {
      // Resolve webhook URL: empresa-specific → universal fallback
      let webhookUrl = agente.webhook_n8n_url || "";
      if (!webhookUrl) {
        const { data: configUniversal } = await supabase
          .from("configuracoes_plataforma")
          .select("valor")
          .eq("chave", "webhook_n8n_universal")
          .maybeSingle();
        webhookUrl = configUniversal?.valor || "";
      }

      if (webhookUrl) {
        try {
          // Build full context to send to n8n
          const [
            { data: empresaData },
            { data: servicos },
            { data: profissionais },
            { data: produtos },
            { data: historico },
          ] = await Promise.all([
            supabase.from("empresas").select("nome, email, slug").eq("id", empresaId).single(),
            supabase.from("servicos").select("nome, preco, duracao_minutos").eq("empresa_id", empresaId).eq("status", "active").limit(50),
            supabase.from("barbeiros").select("nome, especialidade").eq("empresa_id", empresaId).eq("status", "active").limit(20),
            supabase.from("produtos").select("nome, preco, descricao").eq("empresa_id", empresaId).eq("ativo", true).limit(30),
            supabase.from("whatsapp_mensagens").select("mensagem, direcao, created_at").eq("telefone", telefone).eq("empresa_id", empresaId).order("created_at", { ascending: false }).limit(10),
          ]);

          const contexto = {
            agente: {
              nome: agente.nome,
              tom: agente.tom,
              func_agendamento: agente.func_agendamento,
              func_produtos: agente.func_produtos,
              func_fidelidade: agente.func_fidelidade,
              func_humano: agente.func_humano,
              instrucoes_extras: agente.instrucoes_extras,
            },
            empresa: { id: empresaId, nome: empresaData?.nome, email: empresaData?.email, slug: empresaData?.slug },
            servicos: servicos || [],
            profissionais: profissionais || [],
            produtos: produtos || [],
            historico: (historico || []).reverse(),
            conversa_id: convId,
            instance_name: instanceName,
          };

          await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event: "messages.upsert",
              session_id: convId,
              telefone: telefone,
              instance: instanceName,
              data: {
                key: body?.data?.key,
                pushName: body?.data?.pushName,
                message: body?.data?.message,
                messageType: "conversation"
              },
              contexto
            }),
          });

          console.log("Delegated to AI agent n8n for empresa:", empresaId, "webhook:", webhookUrl.includes("universal") ? "universal" : "custom");
          return ok({ status: "ai_agent_delegated" });
        } catch (aiErr: any) {
          console.error("Error delegating to AI agent:", aiErr.message);
          // Fall through to normal chatbot flow on error if IA fails
        }
      }
    }
    // ===== END AGENTE IA =====

    const msgLower = mensagem.trim().toLowerCase();

    // ---- ACTIVE BOOKING FLOW ----
    const bookingState: BookingState | null = existingConv?.booking_state || null;

    if (bookingState) {
      if (msgLower === "cancelar" || msgLower === "0") {
        await supabase.from("whatsapp_conversas").update({ booking_state: null }).eq("id", convId);
        await sendWhatsApp(supabase, telefone, "❌ Agendamento cancelado.", instanceName, empresaId);
        return ok({ status: "booking_cancelled" });
      }
      const result = await handleBookingStep(supabase, convId, telefone, mensagem, bookingState, instanceName, empresaId);
      return ok(result);
    }

    // ---- VISUAL FLOW ENGINE ----
    const flowState: FlowState | null = existingConv?.flow_state || null;

    // If user is mid-flow (waiting at a menu/condition node), handle input
    if (flowState) {
      const result = await handleFlowInput(supabase, convId, telefone, mensagem, flowState, instanceName, empresaId);
      return ok(result);
    }

    // No active state: find active flow and start from the beginning
    const { data: flows } = await supabase.from("chatbot_flows")
      .select("*")
      .eq("ativo", true)
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: true })
      .limit(1);

    if (flows && flows.length > 0) {
      const flow = flows[0];
      const fd = typeof flow.flow_data === "string" ? JSON.parse(flow.flow_data) : flow.flow_data;
      const nodes = fd.nodes || [];
      const edges = fd.edges || [];

      const startNode = nodes.find((n: any) => n.type === "start");
      if (startNode) {
        const result = await traverseFlow(supabase, convId, telefone, flow.id, startNode.id, nodes, edges, mensagem, instanceName, empresaId);
        return ok(result);
      }
    }

    // Fallback: check simple keyword-based fluxos
    const { data: fluxos } = await supabase.from("chatbot_fluxos")
      .select("*")
      .eq("ativo", true)
      .eq("empresa_id", empresaId)
      .order("ordem");
    if (fluxos && fluxos.length > 0) {
      for (const fluxo of fluxos) {
        const keywords = fluxo.gatilho.split(",").map((k: string) => k.trim().toLowerCase());
        if (keywords.some((k: string) => msgLower.includes(k))) {
          await sendWhatsApp(supabase, telefone, fluxo.resposta, instanceName, empresaId);
          return ok({ status: "fluxo_matched", fluxo: fluxo.nome });
        }
      }
    }

    // No flow configured at all
    const { data: empresa } = await supabase.from("empresas").select("nome").eq("id", empresaId).limit(1).maybeSingle();
    const nomeEmpresa = empresa?.nome || "nosso estabelecimento";
    await sendWhatsApp(supabase, telefone, `Olá! 👋 Bem-vindo(a) ao *${nomeEmpresa}*! No momento não temos um fluxo de atendimento configurado. Um atendente entrará em contato em breve.`, instanceName, empresaId);
    return ok({ status: "no_flow_fallback" });

  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

function ok(data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// ============ VISUAL FLOW ENGINE ============

function getOutgoingEdges(edges: any[], nodeId: string, sourceHandle?: string): any[] {
  return edges.filter((e: any) => {
    if (e.source !== nodeId) return false;
    if (sourceHandle !== undefined) return e.sourceHandle === sourceHandle;
    return true;
  });
}

async function sendGlobalHelpMenu(supabase: any, convId: string, telefone: string, flowId: string, instanceName: string, empresaId: string) {
  const msg = "Deseja mais alguma informação?\n\nDigite:\n1. Voltar ao menu principal\n2. Encerrar atendimento\n3. Falar com um atendente humano";
  await sendWhatsApp(supabase, telefone, msg, instanceName, empresaId);
  
  await supabase.from("whatsapp_conversas").update({
    flow_state: { flow_id: flowId, is_global_menu: true } as FlowState,
  }).eq("id", convId);

  return { status: "waiting_global_input" };
}

function getNode(nodes: any[], nodeId: string): any {
  return nodes.find((n: any) => n.id === nodeId);
}

async function traverseFlow(
  supabase: any, convId: string, telefone: string,
  flowId: string, startFromNodeId: string,
  nodes: any[], edges: any[], userMessage: string,
  instanceName: string, empresaId: string
): Promise<Record<string, unknown>> {
  let currentNodeId = startFromNodeId;
  let iterations = 0;
  const MAX_ITERATIONS = 20;

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    const node = getNode(nodes, currentNodeId);
    if (!node) break;

    const data = node.data || {};
    const nodeType = node.type;

    switch (nodeType) {
      case "start": {
        const outEdges = getOutgoingEdges(edges, currentNodeId);
        if (outEdges.length === 0) return { status: "flow_end" };
        currentNodeId = outEdges[0].target;
        break;
      }

      case "message": {
        const msg = data.message || "";
        if (msg) await sendWhatsApp(supabase, telefone, msg, instanceName, empresaId);
        const outEdges = getOutgoingEdges(edges, currentNodeId);
        if (outEdges.length === 0) {
          return await sendGlobalHelpMenu(supabase, convId, telefone, flowId, instanceName, empresaId);
        }
        currentNodeId = outEdges[0].target;
        break;
      }

      case "delay": {
        const delaySec = parseInt(data.delay || "5");
        await new Promise(resolve => setTimeout(resolve, Math.min(delaySec, 30) * 1000));
        const outEdges = getOutgoingEdges(edges, currentNodeId);
        if (outEdges.length === 0) {
          return await sendGlobalHelpMenu(supabase, convId, telefone, flowId, instanceName, empresaId);
        }
        currentNodeId = outEdges[0].target;
        break;
      }

      case "menu": {
        const title = data.title || "Escolha uma opção:";
        const options: string[] = data.options || ["Opção 1", "Opção 2"];
        let msg = `${title}\n\n`;
        options.forEach((opt: string, i: number) => { msg += `${i + 1}. ${opt}\n`; });
        // Add "voltar" option if enabled (default true)
        if (data.showBackOption !== false) {
          msg += `\n0. Voltar ao início`;
        }
        await sendWhatsApp(supabase, telefone, msg, instanceName, empresaId);

        await supabase.from("whatsapp_conversas").update({
          flow_state: { flow_id: flowId, current_node_id: currentNodeId } as FlowState,
        }).eq("id", convId);
        return { status: "waiting_menu_input" };
      }

      case "condition": {
        // FIXED: Condition node now PAUSES and asks for user input,
        // then evaluates keywords against the response.
        const prompt = data.prompt || data.keyword || "";
        const promptMsg = data.conditionMessage || `💬 ${prompt ? `Responda: *${prompt}*` : "Por favor, digite sua resposta:"}`;
        await sendWhatsApp(supabase, telefone, promptMsg, instanceName, empresaId);

        await supabase.from("whatsapp_conversas").update({
          flow_state: { flow_id: flowId, current_node_id: currentNodeId } as FlowState,
        }).eq("id", convId);
        return { status: "waiting_condition_input" };
      }

      case "human": {
        const msg = data.message || "Você será atendido por um de nossos profissionais em breve. Aguarde!";
        await sendWhatsApp(supabase, telefone, `👤 ${msg}`, instanceName, empresaId);
        
        // Tag contact in CRM and mark human takeover
        await handleHumanTakeover(supabase, convId, telefone, instanceName, empresaId);
        
        return { status: "human_takeover" };
      }

      case "action": {
        const actionType = data.actionType || "";
        await executeAction(supabase, convId, telefone, actionType, instanceName, empresaId);
        const outEdges = getOutgoingEdges(edges, currentNodeId);
        if (outEdges.length === 0) {
          return await sendGlobalHelpMenu(supabase, convId, telefone, flowId, instanceName, empresaId);
        }
        currentNodeId = outEdges[0].target;
        break;
      }

      case "booking": {
        await supabase.from("whatsapp_conversas").update({ flow_state: null }).eq("id", convId);
        if (data.mode === "link") {
          const { data: empresa } = await supabase.from("empresas").select("slug").eq("id", empresaId).single();
          const bookingUrl = `https://blank-canvas.com/agendar/${empresa?.slug || ""}`;
          await sendWhatsApp(supabase, telefone, `📅 *Agendamento Online*\n\nVocê pode realizar seu agendamento diretamente pelo link abaixo:\n\n${bookingUrl}`, instanceName, empresaId);
          return await sendGlobalHelpMenu(supabase, convId, telefone, flowId, instanceName, empresaId);
        } else {
          const result = await startBookingFlow(supabase, convId, telefone, instanceName, empresaId);
          return result;
        }
      }

      case "close": {
        const msg = data.message || "Atendimento finalizado. Obrigado! 😊";
        await sendWhatsApp(supabase, telefone, `✅ ${msg}`, instanceName, empresaId);
        // Clear all states and mark conversation as finalized
        await supabase.from("whatsapp_conversas").update({
          flow_state: null,
          booking_state: null,
          atendimento_humano: false,
          status: "finalizado",
        }).eq("id", convId);
        return { status: "conversation_closed" };
      }

      default: {
        const outEdges = getOutgoingEdges(edges, currentNodeId);
        if (outEdges.length === 0) return { status: "flow_end_unknown" };
        currentNodeId = outEdges[0].target;
        break;
      }
    }
  }

  return { status: "flow_completed" };
}

// Handle user input when they're at a menu or condition node
async function handleFlowInput(
  supabase: any, convId: string, telefone: string,
  mensagem: string, flowState: FlowState,
  instanceName: string, empresaId: string
): Promise<Record<string, unknown>> {
  const msgLower = mensagem.trim().toLowerCase();

  const { data: flow } = await supabase.from("chatbot_flows").select("*").eq("id", flowState.flow_id).maybeSingle();
  if (!flow) {
    await supabase.from("whatsapp_conversas").update({ flow_state: null }).eq("id", convId);
    return { status: "flow_not_found" };
  }

  const fd = typeof flow.flow_data === "string" ? JSON.parse(flow.flow_data) : flow.flow_data;
  const nodes = fd.nodes || [];
  const edges = fd.edges || [];

  const currentNode = getNode(nodes, flowState.current_node_id || "");
  
  // Handle Global Menu Input
  if (flowState.is_global_menu) {
    if (msgLower === "1") { // Voltar ao início
      await supabase.from("whatsapp_conversas").update({ flow_state: null }).eq("id", convId);
      const startNode = nodes.find((n: any) => n.type === "start");
      if (startNode) return await traverseFlow(supabase, convId, telefone, flow.id, startNode.id, nodes, edges, mensagem, instanceName, empresaId);
    } else if (msgLower === "2") { // Encerrar
      await sendWhatsApp(supabase, telefone, "Atendimento finalizado. Obrigado! 😊", instanceName, empresaId);
      await supabase.from("whatsapp_conversas").update({ flow_state: null, status: "finalizado" }).eq("id", convId);
      return { status: "flow_closed_global" };
    } else if (msgLower === "3") { // Falar com humano
      await handleHumanTakeover(supabase, convId, telefone, instanceName, empresaId);
      await sendWhatsApp(supabase, telefone, "Certo! Um atendente humano irá falar com você em breve. Aguarde um instante.", instanceName, empresaId);
      return { status: "human_takeover_global" };
    }
    await sendWhatsApp(supabase, telefone, "⚠️ Opção inválida.\n\nDigite:\n1 para voltar ao menu\n2 para encerrar\n3 para falar com humano", instanceName, empresaId);
    return { status: "invalid_global_option" };
  }

  if (!currentNode) {
    await supabase.from("whatsapp_conversas").update({ flow_state: null }).eq("id", convId);
    return { status: "node_not_found" };
  }

  // Handle "0" or "voltar" to reset flow back to start
  if (msgLower === "0" || msgLower === "voltar") {
    await supabase.from("whatsapp_conversas").update({ flow_state: null }).eq("id", convId);
    const startNode = nodes.find((n: any) => n.type === "start");
    if (startNode) {
      return await traverseFlow(supabase, convId, telefone, flow.id, startNode.id, nodes, edges, mensagem, instanceName, empresaId);
    }
    return { status: "flow_reset" };
  }

  if (currentNode.type === "menu") {
    const options: string[] = currentNode.data?.options || [];
    const idx = parseInt(mensagem.trim()) - 1;

    if (isNaN(idx) || idx < 0 || idx >= options.length) {
      await sendWhatsApp(supabase, telefone, `⚠️ Opção inválida. Envie um número de 1 a ${options.length}.`, instanceName, empresaId);
      return { status: "invalid_menu_option" };
    }

    await supabase.from("whatsapp_conversas").update({ flow_state: null }).eq("id", convId);

    const handleId = `opt-${idx}`;
    const outEdges = getOutgoingEdges(edges, currentNode.id, handleId);
    if (outEdges.length === 0) {
      await sendWhatsApp(supabase, telefone, "Esta opção ainda não tem um fluxo configurado.", instanceName, empresaId);
      return { status: "no_edge_for_option" };
    }

    return await traverseFlow(supabase, convId, telefone, flow.id, outEdges[0].target, nodes, edges, mensagem, instanceName, empresaId);
  }

  if (currentNode.type === "condition") {
    // FIXED: Now we evaluate the user's RESPONSE against the keywords
    const keywords = (currentNode.data?.keyword || "").split(",").map((k: string) => k.trim().toLowerCase());
    const matched = keywords.some((k: string) => k && msgLower.includes(k));

    await supabase.from("whatsapp_conversas").update({ flow_state: null }).eq("id", convId);

    const handleId = matched ? "yes" : "no";
    const outEdges = getOutgoingEdges(edges, currentNode.id, handleId);
    if (outEdges.length === 0) {
      const fallbackEdges = getOutgoingEdges(edges, currentNode.id);
      if (fallbackEdges.length === 0) return { status: "flow_end_condition" };
      return await traverseFlow(supabase, convId, telefone, flow.id, fallbackEdges[0].target, nodes, edges, mensagem, instanceName, empresaId);
    }

    return await traverseFlow(supabase, convId, telefone, flow.id, outEdges[0].target, nodes, edges, mensagem, instanceName, empresaId);
  }

  await supabase.from("whatsapp_conversas").update({ flow_state: null }).eq("id", convId);
  return { status: "unexpected_flow_state" };
}

// ============ HUMAN TAKEOVER WITH CRM + NOTIFICATIONS ============

async function handleHumanTakeover(supabase: any, convId: string, telefone: string, instanceName: string, empresaId: string) {
  // 1. Mark conversation as human takeover and clear flow state
  await supabase.from("whatsapp_conversas").update({
    atendimento_humano: true,
    flow_state: null,
  }).eq("id", convId);

  // 2. Find or create client
  let clienteId: string | null = null;
  const { data: conv } = await supabase.from("whatsapp_conversas").select("cliente_id, nome_contato").eq("id", convId).single();
  
  if (conv?.cliente_id) {
    clienteId = conv.cliente_id;
  } else {
    // Try to find by phone
    const { data: cliente } = await supabase.from("clientes").select("id").eq("telefone", telefone).eq("empresa_id", empresaId).maybeSingle();
    if (cliente) {
      clienteId = cliente.id;
      await supabase.from("whatsapp_conversas").update({ cliente_id: clienteId }).eq("id", convId);
    }
  }

  // 3. Register CRM interaction
  if (clienteId) {
    await supabase.from("crm_interacoes").insert({
      cliente_id: clienteId,
      tipo: "whatsapp",
      descricao: "Solicitou atendimento humano via chatbot WhatsApp",
      status: "pendente",
      proxima_acao: "Atender cliente no WhatsApp",
      empresa_id: empresaId,
    });

    // Move to "Atendimento" stage in CRM funnel if exists
    const { data: estagios } = await supabase.from("crm_funil_estagios")
      .select("id").eq("empresa_id", empresaId).order("ordem").limit(10);
    
    if (estagios && estagios.length > 0) {
      // Look for a stage with "atendimento" in name, or use first stage
      const atendimentoStage = estagios.find((e: any) => false) || estagios[0];
      
      // Upsert client in funnel
      const { data: existing } = await supabase.from("crm_funil_clientes")
        .select("id").eq("cliente_id", clienteId).eq("empresa_id", empresaId).maybeSingle();
      
      if (existing) {
        await supabase.from("crm_funil_clientes").update({
          notas: "⚠️ Solicitou atendimento humano via WhatsApp",
          updated_at: new Date().toISOString(),
        }).eq("id", existing.id);
      } else {
        await supabase.from("crm_funil_clientes").insert({
          cliente_id: clienteId,
          estagio_id: atendimentoStage.id,
          empresa_id: empresaId,
          notas: "⚠️ Solicitou atendimento humano via WhatsApp",
        });
      }
    }
  }

  // 4. Notify group via WhatsApp (if configured)
  try {
    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    // Look for owner's whatsapp in the specific empresa
    const { data: empresaConfig } = await supabase.from("empresas").select("whatsapp").eq("id", empresaId).limit(1).maybeSingle();

    // Send notification to business WhatsApp number if configured
    if (evolutionUrl && evolutionKey && instanceName && empresaConfig?.whatsapp) {
      const nomeContato = conv?.nome_contato || telefone;
      const notifMsg = `🔔 *Novo atendimento solicitado*\n\n👤 Cliente: ${nomeContato}\n📱 Telefone: ${telefone}\n\nO cliente solicitou atendimento humano pelo chatbot.`;
      
      await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evolutionKey },
        body: JSON.stringify({ number: empresaConfig.whatsapp, text: notifMsg }),
      });
    }
  } catch (err) {
    console.error("Error sending human takeover notification:", err);
  }
}

// ============ ACTION EXECUTION ============

async function executeAction(supabase: any, convId: string, telefone: string, actionType: string, instanceName: string, empresaId: string) {
  try {
    const { data: conv } = await supabase.from("whatsapp_conversas").select("cliente_id").eq("id", convId).single();
    const clienteId = conv?.cliente_id;

    switch (actionType) {
      case "mover_funil": {
        if (!clienteId) break;
        const { data: estagios } = await supabase.from("crm_funil_estagios").select("id").eq("empresa_id", empresaId).order("ordem").limit(1);
        if (estagios && estagios.length > 0) {
          const { data: existing } = await supabase.from("crm_funil_clientes").select("id").eq("cliente_id", clienteId).eq("empresa_id", empresaId).maybeSingle();
          if (!existing) {
            await supabase.from("crm_funil_clientes").insert({
              cliente_id: clienteId, estagio_id: estagios[0].id, empresa_id: empresaId,
            });
          }
        }
        break;
      }
      case "enviar_cupom": {
        const { data: cupom } = await supabase.from("cupons").select("codigo, valor, tipo")
          .eq("empresa_id", empresaId).eq("status", "active").limit(1).maybeSingle();
        if (cupom) {
          const desc = cupom.tipo === "percentual" ? `${cupom.valor}%` : `R$ ${Number(cupom.valor).toFixed(2)}`;
          await sendWhatsApp(supabase, telefone, `🎁 Cupom especial para você!\n\nCódigo: *${cupom.codigo}*\nDesconto: ${desc}\n\nUse no seu próximo atendimento!`, instanceName, empresaId);
        }
        break;
      }
      case "marcar_tag": {
        if (!clienteId) break;
        await supabase.from("crm_interacoes").insert({
          cliente_id: clienteId,
          tipo: "tag",
          descricao: "Tag adicionada via chatbot WhatsApp",
          status: "concluido",
        });
        break;
      }
      default:
        console.log(`Action type not implemented: ${actionType}`);
    }
  } catch (err) {
    console.error(`Error executing action ${actionType}:`, err);
  }
}

// ============ BOOKING FLOW ============

async function startBookingFlow(supabase: any, convId: string, telefone: string, instanceName: string, empresaId: string) {
  const { data: servicos } = await supabase.from("servicos").select("id, nome, preco, duracao_minutos").eq("empresa_id", empresaId).eq("status", "active").order("nome");

  if (!servicos || servicos.length === 0) {
    await sendWhatsApp(supabase, telefone, "Desculpe, não há serviços disponíveis no momento.", instanceName, empresaId);
    return { status: "no_services" };
  }

  const state: BookingState = { step: "service", services: servicos };
  await supabase.from("whatsapp_conversas").update({ booking_state: state }).eq("id", convId);

  let msg = "📋 *Agendamento Online*\n\nEscolha um serviço:\n\n";
  servicos.forEach((s: any, i: number) => {
    msg += `${i + 1}. ${s.nome} - R$ ${Number(s.preco).toFixed(2)} (${s.duracao_minutos} min)\n`;
  });
  msg += `\n0. Cancelar`;

  await sendWhatsApp(supabase, telefone, msg, instanceName, empresaId);
  return { status: "booking_started" };
}

async function handleBookingStep(supabase: any, convId: string, telefone: string, mensagem: string, state: BookingState, instanceName: string, empresaId: string) {
  const input = mensagem.trim();
  switch (state.step) {
    case "service": return handleServiceSelection(supabase, convId, telefone, input, state, instanceName, empresaId);
    case "more_services": return handleMoreServicesChoice(supabase, convId, telefone, input, state, instanceName, empresaId);
    case "unit": return handleUnitSelection(supabase, convId, telefone, input, state, instanceName, empresaId);
    case "barber": return handleBarberSelection(supabase, convId, telefone, input, state, instanceName, empresaId);
    case "date": return handleDateSelection(supabase, convId, telefone, input, state, instanceName, empresaId);
    case "time": return handleTimeSelection(supabase, convId, telefone, input, state, instanceName, empresaId);
    case "confirm": return handleConfirmation(supabase, convId, telefone, input, state, instanceName, empresaId);
    default:
      await supabase.from("whatsapp_conversas").update({ booking_state: null }).eq("id", convId);
      return { status: "invalid_step" };
  }
}

async function handleServiceSelection(supabase: any, convId: string, telefone: string, input: string, state: BookingState, instanceName: string, empresaId: string) {
  const idx = parseInt(input) - 1;
  if (isNaN(idx) || !state.services || idx < 0 || idx >= state.services.length) {
    await sendWhatsApp(supabase, telefone, "⚠️ Opção inválida. Envie o número do serviço desejado.", instanceName, empresaId);
    return { status: "invalid_option" };
  }

  const service = state.services[idx];
  if (!state.selected_services) state.selected_services = [];
  state.selected_services.push({
    id: service.id,
    nome: service.nome,
    preco: service.preco,
    duracao_minutos: service.duracao_minutos,
  });

  // Ask if they want to add more services
  state.step = "more_services";
  await supabase.from("whatsapp_conversas").update({ booking_state: state }).eq("id", convId);

  const totalPreco = state.selected_services.reduce((sum, s) => sum + Number(s.preco), 0);
  const totalDuracao = state.selected_services.reduce((sum, s) => sum + s.duracao_minutos, 0);

  let msg = `✅ *${service.nome}* adicionado!\n\n`;
  msg += `📋 Serviços selecionados:\n`;
  state.selected_services.forEach((s, i) => {
    msg += `  ${i + 1}. ${s.nome} - R$ ${Number(s.preco).toFixed(2)}\n`;
  });
  msg += `\n💰 Total: R$ ${totalPreco.toFixed(2)} | ⏱️ ${totalDuracao} min\n\n`;
  msg += `Deseja adicionar mais serviços?\n\n`;
  msg += `1. ✅ Sim, adicionar mais\n`;
  msg += `2. ➡️ Não, continuar agendamento\n`;
  msg += `0. Cancelar`;

  await sendWhatsApp(supabase, telefone, msg, instanceName, empresaId);
  return { status: "waiting_more_services" };
}

async function handleMoreServicesChoice(supabase: any, convId: string, telefone: string, input: string, state: BookingState, instanceName: string, empresaId: string) {
  if (input === "1") {
    // Show service list again (excluding already selected)
    const selectedIds = (state.selected_services || []).map(s => s.id);
    const remaining = (state.services || []).filter(s => !selectedIds.includes(s.id));

    if (remaining.length === 0) {
      await sendWhatsApp(supabase, telefone, "Todos os serviços já foram adicionados. Continuando...", instanceName, empresaId);
    } else {
      state.step = "service";
      state.services = remaining;
      await supabase.from("whatsapp_conversas").update({ booking_state: state }).eq("id", convId);

      let msg = "📋 Escolha mais um serviço:\n\n";
      remaining.forEach((s: any, i: number) => {
        msg += `${i + 1}. ${s.nome} - R$ ${Number(s.preco).toFixed(2)} (${s.duracao_minutos} min)\n`;
      });
      msg += `\n0. Cancelar`;
      await sendWhatsApp(supabase, telefone, msg, instanceName, empresaId);
      return { status: "waiting_more_service_selection" };
    }
  }

  // Continue to unit selection
  return await proceedToUnitSelection(supabase, convId, telefone, state, instanceName, empresaId);
}

async function proceedToUnitSelection(supabase: any, convId: string, telefone: string, state: BookingState, instanceName: string, empresaId: string) {
  const totalPreco = (state.selected_services || []).reduce((sum, s) => sum + Number(s.preco), 0);
  const serviceNames = (state.selected_services || []).map(s => s.nome).join(", ");

  const { data: unidades } = await supabase.from("unidades").select("id, nome").eq("empresa_id", empresaId).eq("status", "active").order("nome");

  if (!unidades || unidades.length === 0) {
    await sendWhatsApp(supabase, telefone, "Desculpe, nenhuma unidade disponível.", instanceName, empresaId);
    await supabase.from("whatsapp_conversas").update({ booking_state: null }).eq("id", convId);
    return { status: "no_units" };
  }

  if (unidades.length === 1) {
    state.selected_unit_id = unidades[0].id;
    state.selected_unit_name = unidades[0].nome;
    return await proceedToBarberSelection(supabase, convId, telefone, state, instanceName, empresaId);
  }

  state.units = unidades;
  state.step = "unit";
  await supabase.from("whatsapp_conversas").update({ booking_state: state }).eq("id", convId);

  let msg = `✅ Serviços: *${serviceNames}*\n\nEscolha a unidade:\n\n`;
  unidades.forEach((u: any, i: number) => { msg += `${i + 1}. ${u.nome}\n`; });
  msg += `\n0. Cancelar`;

  await sendWhatsApp(supabase, telefone, msg, instanceName, empresaId);
  return { status: "waiting_unit" };
}

async function handleUnitSelection(supabase: any, convId: string, telefone: string, input: string, state: BookingState, instanceName: string, empresaId: string) {
  const idx = parseInt(input) - 1;
  if (isNaN(idx) || !state.units || idx < 0 || idx >= state.units.length) {
    await sendWhatsApp(supabase, telefone, "⚠️ Opção inválida. Envie o número da unidade.", instanceName, empresaId);
    return { status: "invalid_option" };
  }

  const unit = state.units[idx];
  state.selected_unit_id = unit.id;
  state.selected_unit_name = unit.nome;

  return await proceedToBarberSelection(supabase, convId, telefone, state, instanceName, empresaId);
}

async function proceedToBarberSelection(supabase: any, convId: string, telefone: string, state: BookingState, instanceName: string, empresaId: string) {
  const { data: barbeiros } = await supabase.from("barbeiros")
    .select("id, nome")
    .eq("empresa_id", empresaId)
    .eq("unidade_id", state.selected_unit_id)
    .eq("status", "active")
    .order("nome");

  if (!barbeiros || barbeiros.length === 0) {
    state.selected_barber_id = "any";
    state.selected_barber_name = "Sem preferência";
    state.step = "date";
    await supabase.from("whatsapp_conversas").update({ booking_state: state }).eq("id", convId);
    await sendDatePrompt(supabase, convId, telefone, state, instanceName, empresaId);
    return { status: "no_barbers_auto_date" };
  }

  state.barbers = barbeiros;
  state.step = "barber";
  await supabase.from("whatsapp_conversas").update({ booking_state: state }).eq("id", convId);

  let msg = `📍 Unidade: *${state.selected_unit_name}*\n\nEscolha o profissional:\n\n1. 💈 Sem preferência (Qualquer profissional)\n`;
  barbeiros.forEach((b: any, i: number) => {
    msg += `${i + 2}. 👤 ${b.nome}\n`;
  });
  msg += `\n0. Cancelar`;

  await sendWhatsApp(supabase, telefone, msg, instanceName, empresaId);
  return { status: "waiting_barber" };
}

async function handleBarberSelection(supabase: any, convId: string, telefone: string, input: string, state: BookingState, instanceName: string, empresaId: string) {
  const idx = parseInt(input);
  if (isNaN(idx) || idx < 1 || !state.barbers || idx > state.barbers.length + 1) {
    await sendWhatsApp(supabase, telefone, "⚠️ Opção inválida. Envie o número do profissional desejado.", instanceName, empresaId);
    return { status: "invalid_option" };
  }

  if (idx === 1) {
    state.selected_barber_id = "any";
    state.selected_barber_name = "Sem preferência";
  } else {
    const selectedBarber = state.barbers[idx - 2];
    state.selected_barber_id = selectedBarber.id;
    state.selected_barber_name = selectedBarber.nome;
  }

  state.step = "date";
  await supabase.from("whatsapp_conversas").update({ booking_state: state }).eq("id", convId);

  await sendDatePrompt(supabase, convId, telefone, state, instanceName, empresaId);
  return { status: "waiting_date" };
}

async function sendDatePrompt(supabase: any, convId: string, telefone: string, state: BookingState, instanceName: string, empresaId: string) {
  const { data: horarios } = await supabase.from("horarios_funcionamento")
    .select("dia_semana, aberto")
    .eq("unidade_id", state.selected_unit_id)
    .eq("empresa_id", empresaId);

  const closedDays = new Set<number>();
  if (horarios) {
    horarios.forEach((h: any) => { if (!h.aberto) closedDays.add(h.dia_semana); });
  }

  const days: { date: Date; label: string }[] = [];
  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const now = new Date();

  for (let i = 0; i < 30 && days.length < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    if (!closedDays.has(d.getDay())) {
      const dayStr = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
      days.push({ date: d, label: `${weekDays[d.getDay()]} ${dayStr}` });
    }
  }

  state.date_options = days.map(d => d.date.toISOString().split("T")[0]);
  await supabase.from("whatsapp_conversas").update({ booking_state: state }).eq("id", convId);

  const serviceNames = (state.selected_services || []).map(s => s.nome).join(", ");
  let msg = `📅 Unidade: *${state.selected_unit_name}*\nServiços: *${serviceNames}*\n\nEscolha a data:\n\n`;
  days.forEach((d, i) => { msg += `${i + 1}. ${d.label}\n`; });
  msg += `\n0. Cancelar`;

  await sendWhatsApp(supabase, telefone, msg, instanceName, empresaId);
}

async function handleDateSelection(supabase: any, convId: string, telefone: string, input: string, state: BookingState, instanceName: string, empresaId: string) {
  const dateOptions = state.date_options || [];
  const idx = parseInt(input) - 1;

  if (isNaN(idx) || idx < 0 || idx >= dateOptions.length) {
    await sendWhatsApp(supabase, telefone, "⚠️ Opção inválida. Envie o número da data.", instanceName, empresaId);
    return { status: "invalid_option" };
  }

  const selectedDate = dateOptions[idx];
  state.selected_date = selectedDate;

  const availableTimes = await getAvailableSlots(supabase, state, empresaId);

  if (availableTimes.length === 0) {
    await sendWhatsApp(supabase, telefone, "⚠️ Não há horários disponíveis nesta data. Escolha outra data.", instanceName, empresaId);
    return { status: "no_slots" };
  }

  state.available_times = availableTimes;
  state.step = "time";
  await supabase.from("whatsapp_conversas").update({ booking_state: state }).eq("id", convId);

  const dateLabel = `${selectedDate.split("-")[2]}/${selectedDate.split("-")[1]}`;
  let msg = `⏰ Data: *${dateLabel}*\n\nHorários disponíveis:\n\n`;
  availableTimes.forEach((t, i) => { msg += `${i + 1}. ${t}\n`; });
  msg += `\n0. Cancelar`;

  await sendWhatsApp(supabase, telefone, msg, instanceName, empresaId);
  return { status: "waiting_time" };
}

async function handleTimeSelection(supabase: any, convId: string, telefone: string, input: string, state: BookingState, instanceName: string, empresaId: string) {
  const idx = parseInt(input) - 1;
  if (isNaN(idx) || !state.available_times || idx < 0 || idx >= state.available_times.length) {
    await sendWhatsApp(supabase, telefone, "⚠️ Opção inválida. Envie o número do horário.", instanceName, empresaId);
    return { status: "invalid_option" };
  }

  state.selected_time = state.available_times[idx];
  state.step = "confirm";
  await supabase.from("whatsapp_conversas").update({ booking_state: state }).eq("id", convId);

  const dateLabel = `${state.selected_date!.split("-")[2]}/${state.selected_date!.split("-")[1]}`;
  const selectedSvcs = state.selected_services || [];
  const totalPreco = selectedSvcs.reduce((sum, s) => sum + Number(s.preco), 0);
  const totalDuracao = selectedSvcs.reduce((sum, s) => sum + s.duracao_minutos, 0);

  let msg = `✅ *Confirme seu agendamento:*\n\n`;
  msg += `📋 Serviços:\n`;
  selectedSvcs.forEach(s => { msg += `  • ${s.nome} - R$ ${Number(s.preco).toFixed(2)}\n`; });
  msg += `\n💰 Total: R$ ${totalPreco.toFixed(2)} (${totalDuracao} min)\n`;
  msg += `📍 Unidade: ${state.selected_unit_name}\n`;
  msg += `👤 Profissional: ${state.selected_barber_name || "Sem preferência"}\n`;
  msg += `📅 Data: ${dateLabel}\n`;
  msg += `⏰ Horário: ${state.selected_time}\n\n`;
  msg += `1. ✅ Confirmar\n2. ❌ Cancelar`;

  await sendWhatsApp(supabase, telefone, msg, instanceName, empresaId);
  return { status: "waiting_confirm" };
}

async function handleConfirmation(supabase: any, convId: string, telefone: string, input: string, state: BookingState, instanceName: string, empresaId: string) {
  if (input !== "1") {
    await supabase.from("whatsapp_conversas").update({ booking_state: null }).eq("id", convId);
    await sendWhatsApp(supabase, telefone, "❌ Agendamento cancelado.", instanceName, empresaId);
    return { status: "booking_cancelled" };
  }

  try {
    let { data: cliente } = await supabase.from("clientes").select("id, nome").eq("telefone", telefone).eq("empresa_id", empresaId).maybeSingle();
    if (!cliente) {
      const pushName = (await supabase.from("whatsapp_conversas").select("nome_contato").eq("id", convId).single()).data?.nome_contato || telefone;
      const { data: newCliente } = await supabase.from("clientes").insert({ nome: pushName, telefone, empresa_id: empresaId }).select("id, nome").single();
      cliente = newCliente;
    }

    if (!cliente) throw new Error("Não foi possível identificar/criar o cliente");

    const { data: barbeiros } = await supabase.from("barbeiros")
      .select("id, nome").eq("status", "active").eq("unidade_id", state.selected_unit_id).eq("empresa_id", empresaId);

    if (!barbeiros || barbeiros.length === 0) throw new Error("Nenhum profissional disponível");

    const selectedSvcs = state.selected_services || [];
    const totalPreco = selectedSvcs.reduce((sum, s) => sum + Number(s.preco), 0);
    const totalDuracao = selectedSvcs.reduce((sum, s) => sum + s.duracao_minutos, 0);

    const [hh, mm] = state.selected_time!.split(":").map(Number);
    const dataHoraISO = `${state.selected_date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00-03:00`;
    const dataHoraDate = new Date(dataHoraISO);

    let selectedBarber = null;

    if (state.selected_barber_id && state.selected_barber_id !== "any") {
      const targetB = barbeiros.find((b: any) => b.id === state.selected_barber_id);
      if (targetB) {
        selectedBarber = targetB;
      }
    }

    if (!selectedBarber) {
      for (const barber of barbeiros) {
        const { data: conflicts } = await supabase.from("agendamentos")
          .select("id").eq("barbeiro_id", barber.id).eq("status", "agendado")
          .gte("data_hora", new Date(dataHoraDate.getTime() - totalDuracao * 60000).toISOString())
          .lte("data_hora", dataHoraDate.toISOString());

        const { data: blocks } = await supabase.from("agenda_bloqueios")
          .select("id").eq("barbeiro_id", barber.id)
          .lte("data_inicio", dataHoraISO).gte("data_fim", dataHoraISO);

        if ((!conflicts || conflicts.length === 0) && (!blocks || blocks.length === 0)) {
          selectedBarber = barber;
          break;
        }
      }
    }

    if (!selectedBarber) {
      await sendWhatsApp(supabase, telefone, "⚠️ Desculpe, este horário acabou de ser ocupado. Tente novamente.", instanceName, empresaId);
      await supabase.from("whatsapp_conversas").update({ booking_state: null }).eq("id", convId);
      return { status: "slot_taken" };
    }

    // Use first service as the primary servico_id
    const primaryService = selectedSvcs[0];

    const { error: agError } = await supabase.from("agendamentos").insert({
      cliente_id: cliente.id,
      barbeiro_id: selectedBarber.id,
      servico_id: primaryService.id,
      unidade_id: state.selected_unit_id,
      data_hora: dataHoraISO,
      duracao_minutos: totalDuracao,
      preco: totalPreco,
      status: "agendado",
      observacoes: "Agendado via WhatsApp",
      empresa_id: empresaId,
    });

    if (agError) throw agError;

    const { data: agendamento } = await supabase.from("agendamentos")
      .select("id").eq("cliente_id", cliente.id).eq("data_hora", dataHoraISO)
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false }).limit(1).single();

    if (agendamento) {
      // Insert all selected services
      for (const svc of selectedSvcs) {
        await supabase.from("agendamento_servicos").insert({
          agendamento_id: agendamento.id,
          servico_id: svc.id,
          nome: svc.nome,
          preco: svc.preco,
          duracao_minutos: svc.duracao_minutos,
          empresa_id: empresaId,
        });
      }
    }

    await supabase.from("whatsapp_conversas").update({ booking_state: null }).eq("id", convId);

    const dateLabel = `${state.selected_date!.split("-")[2]}/${state.selected_date!.split("-")[1]}`;
    const serviceNames = selectedSvcs.map(s => s.nome).join(", ");
    let msg = `🎉 *Agendamento confirmado!*\n\n`;
    msg += `📋 ${serviceNames}\n`;
    msg += `📅 ${dateLabel} às ${state.selected_time}\n`;
    msg += `📍 ${state.selected_unit_name}\n`;
    msg += `👤 Profissional: ${selectedBarber.nome}\n`;
    msg += `💰 R$ ${totalPreco.toFixed(2)}\n\n`;
    msg += `Até lá! 😊`;

    await sendWhatsApp(supabase, telefone, msg, instanceName, empresaId);
    return { status: "booking_confirmed" };
  } catch (err) {
    console.error("Booking error:", err);
    await supabase.from("whatsapp_conversas").update({ booking_state: null }).eq("id", convId);
    await sendWhatsApp(supabase, telefone, "⚠️ Desculpe, houve um erro ao criar o agendamento. Tente novamente mais tarde.", instanceName, empresaId);
    return { status: "booking_error", error: String(err) };
  }
}

// ============ AVAILABILITY LOGIC ============

async function getAvailableSlots(supabase: any, state: BookingState, empresaId: string): Promise<string[]> {
  const unitId = state.selected_unit_id!;
  const dateStr = state.selected_date!;
  const duracao = (state.selected_services || []).reduce((sum, s) => sum + s.duracao_minutos, 0) || 30;
  const date = new Date(dateStr + "T00:00:00");
  const dayOfWeek = date.getDay();

  const { data: horario } = await supabase.from("horarios_funcionamento")
    .select("aberto, horario_abertura, horario_fechamento")
    .eq("unidade_id", unitId).eq("empresa_id", empresaId).eq("dia_semana", dayOfWeek).maybeSingle();

  let openTime = "09:00";
  let closeTime = "20:00";

  if (horario) {
    if (!horario.aberto) return [];
    openTime = horario.horario_abertura?.substring(0, 5) || "09:00";
    closeTime = horario.horario_fechamento?.substring(0, 5) || "20:00";
  } else {
    const { data: unit } = await supabase.from("unidades").select("horario_abertura, horario_fechamento").eq("id", unitId).eq("empresa_id", empresaId).single();
    if (unit) {
      openTime = (unit.horario_abertura || "09:00:00").substring(0, 5);
      closeTime = (unit.horario_fechamento || "20:00:00").substring(0, 5);
    }
  }

  const { data: barbeiros } = await supabase.from("barbeiros")
    .select("id").eq("status", "active").eq("unidade_id", unitId).eq("empresa_id", empresaId);

  if (!barbeiros || barbeiros.length === 0) return [];

  const barberIds = barbeiros.map((b: any) => b.id);

  const dayStart = new Date(`${dateStr}T00:00:00Z`);
  const dayEnd = new Date(`${dateStr}T23:59:59Z`);

  const { data: appointments } = await supabase.from("agendamentos")
    .select("barbeiro_id, data_hora, duracao_minutos")
    .in("barbeiro_id", barberIds).eq("status", "agendado").eq("empresa_id", empresaId)
    .gte("data_hora", dayStart.toISOString()).lte("data_hora", dayEnd.toISOString());

  const { data: blocks } = await supabase.from("agenda_bloqueios")
    .select("barbeiro_id, data_inicio, data_fim")
    .in("barbeiro_id", barberIds)
    .lte("data_inicio", dayEnd.toISOString()).gte("data_fim", dayStart.toISOString());

  const [openH, openM] = openTime.split(":").map(Number);
  const [closeH, closeM] = closeTime.split(":").map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  const now = new Date();
  const isToday = dateStr === now.toISOString().split("T")[0];

  const slots: string[] = [];

  for (let t = openMinutes; t + duracao <= closeMinutes; t += 30) {
    const slotH = Math.floor(t / 60);
    const slotM = t % 60;

    if (isToday) {
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      if (t <= currentMinutes) continue;
    }

    const slotStartUTC = new Date(`${dateStr}T${String(slotH).padStart(2, "0")}:${String(slotM).padStart(2, "0")}:00`);
    slotStartUTC.setMinutes(slotStartUTC.getMinutes() + 180);
    const slotEndUTC = new Date(slotStartUTC.getTime() + duracao * 60000);

    let hasAvailableBarber = false;
    const targetBarberIds = (state.selected_barber_id && state.selected_barber_id !== "any")
      ? [state.selected_barber_id]
      : barberIds;

    for (const barberId of targetBarberIds) {
      let isBusy = false;

      if (appointments) {
        for (const appt of appointments) {
          if (appt.barbeiro_id !== barberId) continue;
          const apptStart = new Date(appt.data_hora);
          const apptEnd = new Date(apptStart.getTime() + (appt.duracao_minutos || 30) * 60000);
          if (slotStartUTC < apptEnd && slotEndUTC > apptStart) { isBusy = true; break; }
        }
      }

      if (!isBusy && blocks) {
        for (const block of blocks) {
          if (block.barbeiro_id !== barberId) continue;
          const blockStart = new Date(block.data_inicio);
          const blockEnd = new Date(block.data_fim);
          if (slotStartUTC < blockEnd && slotEndUTC > blockStart) { isBusy = true; break; }
        }
      }

      if (!isBusy) { hasAvailableBarber = true; break; }
    }

    if (hasAvailableBarber) {
      slots.push(`${String(slotH).padStart(2, "0")}:${String(slotM).padStart(2, "0")}`);
    }
  }

  return slots;
}

// ============ SEND WHATSAPP ============

async function sendWhatsApp(supabase: any, telefone: string, msg: string, instanceName: string, empresaId: string) {
  const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");

  // In a multi-tenant environment, we use the instanceName provided by the webhook
  if (evolutionUrl && evolutionKey && instanceName) {
    try {
      await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evolutionKey },
        body: JSON.stringify({ number: telefone, text: msg }),
      });
    } catch (err) {
      console.error("Error calling Evolution API:", err);
    }
  }

  await supabase.from("whatsapp_mensagens").insert({
    telefone, mensagem: msg, direcao: "enviada", tipo: "texto", empresa_id: empresaId,
  });
}
