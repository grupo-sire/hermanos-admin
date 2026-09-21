import { Handle, Position, NodeProps } from "@xyflow/react";
import { MessageCircle, GitBranch, Clock, UserCheck, Zap, List, Play, CalendarCheck, CheckCircle2 } from "lucide-react";

export function StartNode({ selected }: NodeProps) {
  return (
    <div className={`bg-card border-2 rounded-lg p-3 min-w-[200px] shadow-md ${selected ? "border-primary" : "border-border"}`}>
      <div className="flex items-center gap-2 mb-2">
        <Play className="h-4 w-4 text-emerald-500" />
        <span className="text-xs font-semibold text-emerald-500">INÍCIO</span>
      </div>
      <p className="text-sm text-foreground">Qualquer mensagem recebida</p>
      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-3 !h-3" />
    </div>
  );
}

export function MessageNode({ data, selected }: NodeProps) {
  return (
    <div className={`bg-card border-2 rounded-lg p-3 min-w-[200px] shadow-md ${selected ? "border-primary" : "border-border"}`}>
      <Handle type="target" position={Position.Top} className="!bg-primary !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-2">
        <MessageCircle className="h-4 w-4 text-green-500" />
        <span className="text-xs font-semibold text-green-500">MENSAGEM</span>
      </div>
      <p className="text-sm text-foreground">{(data as any).message || "Clique para editar"}</p>
      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-3 !h-3" />
    </div>
  );
}

export function ConditionNode({ data, selected }: NodeProps) {
  const conditionMsg = (data as any).conditionMessage;
  return (
    <div className={`bg-card border-2 rounded-lg p-3 min-w-[200px] shadow-md ${selected ? "border-primary" : "border-border"}`}>
      <Handle type="target" position={Position.Top} className="!bg-primary !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-2">
        <GitBranch className="h-4 w-4 text-blue-500" />
        <span className="text-xs font-semibold text-blue-500">CONDIÇÃO</span>
      </div>
      {conditionMsg && <p className="text-xs text-muted-foreground mb-1 italic">"{conditionMsg}"</p>}
      <p className="text-sm text-foreground">🔑 {(data as any).keyword || "Palavra-chave"}</p>
      <div className="flex justify-between mt-2 text-[10px] text-muted-foreground px-2">
        <span className="text-green-500">✓ Sim</span>
        <span className="text-red-500">✗ Não</span>
      </div>
      <Handle type="source" position={Position.Bottom} id="yes" className="!bg-green-500 !w-3 !h-3 !left-[30%]" />
      <Handle type="source" position={Position.Bottom} id="no" className="!bg-red-500 !w-3 !h-3 !left-[70%]" />
    </div>
  );
}

export function DelayNode({ data, selected }: NodeProps) {
  return (
    <div className={`bg-card border-2 rounded-lg p-3 min-w-[180px] shadow-md ${selected ? "border-primary" : "border-border"}`}>
      <Handle type="target" position={Position.Top} className="!bg-primary !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-2">
        <Clock className="h-4 w-4 text-yellow-500" />
        <span className="text-xs font-semibold text-yellow-500">DELAY</span>
      </div>
      <p className="text-sm text-foreground">{(data as any).delay || "5"} segundos</p>
      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-3 !h-3" />
    </div>
  );
}

export function HumanNode({ data, selected }: NodeProps) {
  return (
    <div className={`bg-card border-2 rounded-lg p-3 min-w-[200px] shadow-md ${selected ? "border-primary" : "border-border"}`}>
      <Handle type="target" position={Position.Top} className="!bg-primary !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-2">
        <UserCheck className="h-4 w-4 text-orange-500" />
        <span className="text-xs font-semibold text-orange-500">ATENDIMENTO HUMANO</span>
      </div>
      <p className="text-sm text-foreground">{(data as any).message || "Transferindo para atendente..."}</p>
    </div>
  );
}

export function ActionNode({ data, selected }: NodeProps) {
  return (
    <div className={`bg-card border-2 rounded-lg p-3 min-w-[200px] shadow-md ${selected ? "border-primary" : "border-border"}`}>
      <Handle type="target" position={Position.Top} className="!bg-primary !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-2">
        <Zap className="h-4 w-4 text-purple-500" />
        <span className="text-xs font-semibold text-purple-500">AÇÃO</span>
      </div>
      <p className="text-sm text-foreground">{(data as any).actionType || "Mover no funil"}</p>
      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-3 !h-3" />
    </div>
  );
}

export function MenuNode({ data, selected }: NodeProps) {
  const options: string[] = (data as any).options || ["Opção 1", "Opção 2"];
  const title: string = (data as any).title || "Escolha uma opção:";
  return (
    <div className={`bg-card border-2 rounded-lg p-3 min-w-[220px] shadow-md ${selected ? "border-primary" : "border-border"}`}>
      <Handle type="target" position={Position.Top} className="!bg-primary !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-2">
        <List className="h-4 w-4 text-teal-500" />
        <span className="text-xs font-semibold text-teal-500">MENU</span>
      </div>
      <p className="text-sm font-medium text-foreground mb-1">{title}</p>
      <div className="space-y-1">
        {options.map((opt, i) => (
          <div key={i} className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
            {i + 1}. {opt}
          </div>
        ))}
      </div>
      {options.map((_, i) => (
        <Handle
          key={i}
          type="source"
          position={Position.Bottom}
          id={`opt-${i}`}
          className="!bg-teal-500 !w-2.5 !h-2.5"
          style={{ left: `${((i + 1) / (options.length + 1)) * 100}%` }}
        />
      ))}
    </div>
  );
}

export function BookingNode({ data, selected }: NodeProps) {
  const mode = (data as any).mode || "conversational";
  return (
    <div className={`bg-card border-2 rounded-lg p-3 min-w-[200px] shadow-md ${selected ? "border-primary" : "border-border"}`}>
      <Handle type="target" position={Position.Top} className="!bg-primary !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-2">
        <CalendarCheck className="h-4 w-4 text-cyan-500" />
        <span className="text-xs font-semibold text-cyan-500">AGENDAMENTO</span>
      </div>
      <p className="text-sm text-foreground">
        {mode === "link" ? "Link de Agendamento Externo" : "Fluxo de Agendamento Automático"}
      </p>
      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-3 !h-3" />
    </div>
  );
}

export function CloseNode({ data, selected }: NodeProps) {
  return (
    <div className={`bg-card border-2 rounded-lg p-3 min-w-[200px] shadow-md ${selected ? "border-primary" : "border-border"}`}>
      <Handle type="target" position={Position.Top} className="!bg-primary !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle2 className="h-4 w-4 text-rose-500" />
        <span className="text-xs font-semibold text-rose-500">ENCERRAR</span>
      </div>
      <p className="text-sm text-foreground">{(data as any).message || "Atendimento finalizado. Obrigado!"}</p>
    </div>
  );
}

export const nodeTypes = {
  start: StartNode,
  message: MessageNode,
  condition: ConditionNode,
  delay: DelayNode,
  human: HumanNode,
  action: ActionNode,
  menu: MenuNode,
  booking: BookingNode,
  close: CloseNode,
};
