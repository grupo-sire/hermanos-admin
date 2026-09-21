import { useState, useCallback, useEffect } from "react";
import {
  ReactFlow, addEdge, useNodesState, useEdgesState, Controls, Background,
  BackgroundVariant, Connection, Node, Edge, Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MessageCircle, GitBranch, Clock, UserCheck, Zap, Plus, Save, Loader2, Trash2, List, Play, CalendarCheck, CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { nodeTypes } from "./chatbot/nodeTypes";

type FlowRecord = {
  id: string; nome: string; descricao: string | null; flow_data: any; ativo: boolean;
};

export function ChatbotBuilderSection({ empresaId: propEmpresaId }: { empresaId?: string }) {
  const { empresaId: contextEmpresaId } = useEmpresa();
  const empresaId = propEmpresaId || contextEmpresaId;

  const [flows, setFlows] = useState<FlowRecord[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<FlowRecord | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [flowDialogOpen, setFlowDialogOpen] = useState(false);
  const [flowNome, setFlowNome] = useState("");
  const [flowDescricao, setFlowDescricao] = useState("");

  const [editingNode, setEditingNode] = useState<Node | null>(null);
  const [nodeDialogOpen, setNodeDialogOpen] = useState(false);
  const [nodeMessage, setNodeMessage] = useState("");
  const [nodeKeyword, setNodeKeyword] = useState("");
  const [nodeDelay, setNodeDelay] = useState("5");
  const [nodeActionType, setNodeActionType] = useState("mover_funil");
  const [menuTitle, setMenuTitle] = useState("");
  const [menuOptions, setMenuOptions] = useState<string[]>(["", ""]);
  const [showBackOption, setShowBackOption] = useState(true);
  const [conditionMessage, setConditionMessage] = useState("");
  const [nodeBookingMode, setNodeBookingMode] = useState<"conversational" | "link">("conversational");

  useEffect(() => { fetchFlows(); }, [empresaId]);

  async function fetchFlows() {
    if (!empresaId) return;
    setLoading(true);
    const { data } = await supabase.from("chatbot_flows")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });
    if (data) setFlows(data as FlowRecord[]);
    setLoading(false);
  }

  function loadFlow(flow: FlowRecord) {
    setSelectedFlow(flow);
    try {
      const fd = typeof flow.flow_data === "string" ? JSON.parse(flow.flow_data) : flow.flow_data;
      setNodes(fd?.nodes || []);
      setEdges(fd?.edges || []);
    } catch (e) {
      console.error("Erro ao carregar dados do fluxo:", e);
      setNodes([]);
      setEdges([]);
    }
  }

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: "hsl(var(--primary))" } }, eds));
  }, [setEdges]);

  function addNode(type: string) {
    if (type === "start" && nodes.some(n => n.type === "start")) {
      toast.error("Já existe um nó de Início no fluxo");
      return;
    }
    const defaults: Record<string, any> = {
      start: {},
      message: { message: "Nova mensagem" },
      condition: { keyword: "palavra" },
      delay: { delay: "5" },
      human: { message: "Transferindo para atendente..." },
      action: { actionType: "mover_funil" },
      menu: { title: "Escolha uma opção:", options: ["Opção 1", "Opção 2"] },
      booking: {},
      close: { message: "Atendimento finalizado. Obrigado! 😊" },
    };
    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type,
      position: { x: 250, y: (nodes.length + 1) * 120 },
      data: defaults[type] || {},
    };
    setNodes((nds) => [...nds, newNode]);
  }

  function onNodeDoubleClick(_: any, node: Node) {
    if (node.type === "start") return; // start node is not editable
    setEditingNode(node);
    const d = node.data as any;
    setNodeMessage(d.message || "");
    setNodeKeyword(d.keyword || "");
    setNodeDelay(d.delay || "5");
    setNodeActionType(d.actionType || "mover_funil");
    setMenuTitle(d.title || "Escolha uma opção:");
    setMenuOptions(d.options || ["Opção 1", "Opção 2"]);
    setShowBackOption(d.showBackOption !== false);
    setConditionMessage(d.conditionMessage || "");
    setNodeBookingMode(d.mode || "conversational");
    setNodeDialogOpen(true);
  }

  function saveNodeEdits() {
    if (!editingNode) return;
    setNodes(nds => nds.map(n => {
      if (n.id !== editingNode.id) return n;
      const nd = { ...n.data } as any;
      if (n.type === "message" || n.type === "human" || n.type === "close") nd.message = nodeMessage;
      if (n.type === "condition") { nd.keyword = nodeKeyword; nd.conditionMessage = conditionMessage; }
      if (n.type === "delay") nd.delay = nodeDelay;
      if (n.type === "action") nd.actionType = nodeActionType;
      if (n.type === "menu") { nd.title = menuTitle; nd.options = menuOptions.filter(o => o.trim()); nd.showBackOption = showBackOption; }
      if (n.type === "booking") nd.mode = nodeBookingMode;
      return { ...n, data: nd };
    }));
    setNodeDialogOpen(false);
  }

  function deleteSelectedNodes() {
    const selectedIds = nodes.filter(n => n.selected).map(n => n.id);
    setNodes(nds => nds.filter(n => !n.selected));
    setEdges(eds => eds.filter(e => !selectedIds.includes(e.source) && !selectedIds.includes(e.target)));
  }

  async function saveFlow() {
    if (!selectedFlow || !empresaId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("chatbot_flows")
        .update({ flow_data: { nodes, edges } })
        .eq("id", selectedFlow.id)
        .eq("empresa_id", empresaId);
      if (error) throw error;
      toast.success("Fluxo salvo!");
      fetchFlows();
    } catch { toast.error("Erro ao salvar"); } finally { setSaving(false); }
  }

  async function createFlow() {
    if (!flowNome.trim()) { toast.error("Informe o nome"); return; }
    try {
      const { data, error } = await supabase.from("chatbot_flows").insert({
        nome: flowNome, 
        descricao: flowDescricao || null,
        empresa_id: empresaId,
        flow_data: {
          nodes: [{ id: "start-1", type: "start", position: { x: 250, y: 50 }, data: {} }],
          edges: [],
        },
      }).select().single();
      if (error) throw error;
      toast.success("Fluxo criado!");
      setFlowDialogOpen(false); setFlowNome(""); setFlowDescricao("");
      fetchFlows();
      if (data) loadFlow(data as FlowRecord);
    } catch { toast.error("Erro ao criar fluxo"); }
  }

  async function toggleFlowAtivo(flow: FlowRecord) {
    if (!empresaId) return;
    await supabase.from("chatbot_flows")
      .update({ ativo: !flow.ativo })
      .eq("id", flow.id)
      .eq("empresa_id", empresaId);
    fetchFlows();
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Flow selector */}
      <Card className="panel">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            Fluxos do Chatbot
          </CardTitle>
          <Button size="sm" className="btn-wine" onClick={() => setFlowDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Novo Fluxo
          </Button>
        </CardHeader>
        <CardContent>
          {flows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum fluxo criado. Crie um para começar.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {flows.map(flow => (
                <div key={flow.id} className="flex items-center gap-2">
                  <Button variant={selectedFlow?.id === flow.id ? "default" : "outline"} size="sm" onClick={() => loadFlow(flow)} className="gap-1">
                    {flow.nome}
                    {flow.ativo && <Badge className="bg-green-500 text-white text-[10px] ml-1">Ativo</Badge>}
                  </Button>
                  <Switch checked={flow.ativo} onCheckedChange={() => toggleFlowAtivo(flow)} className="scale-75" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Flow Builder */}
      {selectedFlow && (
        <Card className="panel overflow-hidden">
          <div className="h-[600px]">
            <ReactFlow
              nodes={nodes} edges={edges}
              onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
              onConnect={onConnect} onNodeDoubleClick={onNodeDoubleClick}
              nodeTypes={nodeTypes} fitView className="bg-background"
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} className="!bg-background" />
              <Controls className="!bg-card !border-border !rounded-lg" />

              <Panel position="top-left" className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => addNode("start")} className="gap-1 text-xs">
                  <Play className="h-3.5 w-3.5 text-emerald-500" /> Início
                </Button>
                <Button size="sm" variant="outline" onClick={() => addNode("message")} className="gap-1 text-xs">
                  <MessageCircle className="h-3.5 w-3.5 text-green-500" /> Mensagem
                </Button>
                <Button size="sm" variant="outline" onClick={() => addNode("menu")} className="gap-1 text-xs">
                  <List className="h-3.5 w-3.5 text-teal-500" /> Menu
                </Button>
                <Button size="sm" variant="outline" onClick={() => addNode("condition")} className="gap-1 text-xs">
                  <GitBranch className="h-3.5 w-3.5 text-blue-500" /> Condição
                </Button>
                <Button size="sm" variant="outline" onClick={() => addNode("delay")} className="gap-1 text-xs">
                  <Clock className="h-3.5 w-3.5 text-yellow-500" /> Delay
                </Button>
                <Button size="sm" variant="outline" onClick={() => addNode("human")} className="gap-1 text-xs">
                  <UserCheck className="h-3.5 w-3.5 text-orange-500" /> Humano
                </Button>
                <Button size="sm" variant="outline" onClick={() => addNode("action")} className="gap-1 text-xs">
                  <Zap className="h-3.5 w-3.5 text-purple-500" /> Ação
                </Button>
                <Button size="sm" variant="outline" onClick={() => addNode("booking")} className="gap-1 text-xs">
                  <CalendarCheck className="h-3.5 w-3.5 text-cyan-500" /> Agendamento
                </Button>
                <Button size="sm" variant="outline" onClick={() => addNode("close")} className="gap-1 text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5 text-rose-500" /> Encerrar
                </Button>
              </Panel>

              <Panel position="top-right" className="flex gap-2">
                <Button size="sm" variant="outline" onClick={deleteSelectedNodes} className="gap-1 text-xs text-destructive">
                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                </Button>
                <Button size="sm" className="btn-wine gap-1 text-xs" onClick={saveFlow} disabled={saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar
                </Button>
              </Panel>
            </ReactFlow>
          </div>
        </Card>
      )}

      {/* Create Flow Dialog */}
      <Dialog open={flowDialogOpen} onOpenChange={setFlowDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Novo Fluxo de Chatbot</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={flowNome} onChange={(e) => setFlowNome(e.target.value)} placeholder="Ex: Atendimento Inicial" className="input-dark" />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea value={flowDescricao} onChange={(e) => setFlowDescricao(e.target.value)} placeholder="Descreva o objetivo deste fluxo" className="input-dark" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setFlowDialogOpen(false)}>Cancelar</Button>
              <Button className="btn-wine" onClick={createFlow}>Criar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Node Dialog */}
      <Dialog open={nodeDialogOpen} onOpenChange={setNodeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Editar Nó</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {editingNode?.type === "message" && (
              <div className="space-y-2">
                <Label>Mensagem</Label>
                <Textarea value={nodeMessage} onChange={(e) => setNodeMessage(e.target.value)} className="input-dark min-h-[100px]" />
              </div>
            )}
            {editingNode?.type === "condition" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Mensagem de pergunta</Label>
                  <Textarea value={conditionMessage} onChange={(e) => setConditionMessage(e.target.value)} className="input-dark" placeholder="Ex: Você já é nosso cliente?" />
                  <p className="text-xs text-muted-foreground">Mensagem enviada ao usuário antes de avaliar a resposta</p>
                </div>
                <div className="space-y-2">
                  <Label>Palavras-chave para "Sim" (saída verde)</Label>
                  <Input value={nodeKeyword} onChange={(e) => setNodeKeyword(e.target.value)} className="input-dark" placeholder="Ex: sim, já, tenho" />
                  <p className="text-xs text-muted-foreground">Se a resposta contiver estas palavras → saída verde. Senão → saída vermelha</p>
                </div>
              </div>
            )}
            {editingNode?.type === "delay" && (
              <div className="space-y-2">
                <Label>Delay (segundos)</Label>
                <Input type="number" value={nodeDelay} onChange={(e) => setNodeDelay(e.target.value)} className="input-dark" />
              </div>
            )}
            {editingNode?.type === "human" && (
              <div className="space-y-2">
                <Label>Mensagem de transferência</Label>
                <Textarea value={nodeMessage} onChange={(e) => setNodeMessage(e.target.value)} className="input-dark" />
              </div>
            )}
            {editingNode?.type === "close" && (
              <div className="space-y-2">
                <Label>Mensagem de encerramento</Label>
                <Textarea value={nodeMessage} onChange={(e) => setNodeMessage(e.target.value)} className="input-dark" placeholder="Atendimento finalizado. Obrigado! 😊" />
              </div>
            )}
            {editingNode?.type === "action" && (
              <div className="space-y-2">
                <Label>Tipo de ação</Label>
                <Select value={nodeActionType} onValueChange={setNodeActionType}>
                  <SelectTrigger className="input-dark"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mover_funil">Mover no Funil CRM</SelectItem>
                    <SelectItem value="criar_agendamento">Criar Agendamento</SelectItem>
                    <SelectItem value="enviar_cupom">Enviar Cupom</SelectItem>
                    <SelectItem value="marcar_tag">Marcar Tag</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {editingNode?.type === "booking" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Modo de Agendamento</Label>
                  <Select value={nodeBookingMode} onValueChange={(v: any) => setNodeBookingMode(v)}>
                    <SelectTrigger className="input-dark"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conversational">💬 Fluxo Automático (Conversacional)</SelectItem>
                      <SelectItem value="link">🔗 Enviar Link de Agendamento Externo</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {nodeBookingMode === "conversational" 
                      ? "O chatbot guiará o cliente passo a passo pelo WhatsApp." 
                      : "O chatbot enviará o link direto para sua página de agendamento online."}
                  </p>
                </div>
              </div>
            )}
            {editingNode?.type === "menu" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Título do menu</Label>
                  <Input value={menuTitle} onChange={(e) => setMenuTitle(e.target.value)} className="input-dark" placeholder="Escolha uma opção:" />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Incluir opção "0. Voltar ao início"</Label>
                  <Switch checked={showBackOption} onCheckedChange={setShowBackOption} />
                </div>
                <div className="space-y-2">
                  <Label>Opções</Label>
                  {menuOptions.map((opt, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                      <Input
                        value={opt}
                        onChange={(e) => {
                          const updated = [...menuOptions];
                          updated[i] = e.target.value;
                          setMenuOptions(updated);
                        }}
                        className="input-dark"
                        placeholder={`Opção ${i + 1}`}
                      />
                      {menuOptions.length > 2 && (
                        <Button variant="ghost" size="sm" className="text-destructive h-8 w-8 p-0" onClick={() => setMenuOptions(menuOptions.filter((_, j) => j !== i))}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {menuOptions.length < 6 && (
                    <Button variant="outline" size="sm" onClick={() => setMenuOptions([...menuOptions, ""])} className="text-xs gap-1">
                      <Plus className="h-3 w-3" /> Adicionar opção
                    </Button>
                  )}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNodeDialogOpen(false)}>Cancelar</Button>
              <Button className="btn-wine" onClick={saveNodeEdits}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
