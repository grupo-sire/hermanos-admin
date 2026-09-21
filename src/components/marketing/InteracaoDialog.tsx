import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const interacaoSchema = z.object({
  cliente_id: z.string().min(1, "Cliente é obrigatório"),
  tipo: z.enum(["ligacao", "whatsapp", "email", "visita", "outro"]),
  descricao: z.string().optional(),
  data_interacao: z.string().min(1, "Data é obrigatória"),
  responsavel_id: z.string().optional(),
  proxima_acao: z.string().optional(),
  data_proxima_acao: z.string().optional(),
  status: z.enum(["pendente", "concluido", "cancelado"]),
});

type InteracaoForm = z.infer<typeof interacaoSchema>;

type Interacao = {
  id: string;
  cliente_id: string;
  tipo: string;
  descricao: string | null;
  data_interacao: string;
  responsavel_id: string | null;
  proxima_acao: string | null;
  data_proxima_acao: string | null;
  status: string;
};

type Cliente = {
  id: string;
  nome: string;
};

interface InteracaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interacao: Interacao | null;
  clientes: Cliente[];
  onSuccess: () => void;
}

export function InteracaoDialog({ open, onOpenChange, interacao, clientes, onSuccess }: InteracaoDialogProps) {
  const [barbeiros, setBarbeiros] = useState<{ id: string; nome: string }[]>([]);

  const form = useForm<InteracaoForm>({
    resolver: zodResolver(interacaoSchema),
    defaultValues: {
      cliente_id: "",
      tipo: "whatsapp",
      descricao: "",
      data_interacao: new Date().toISOString().slice(0, 16),
      responsavel_id: "",
      proxima_acao: "",
      data_proxima_acao: "",
      status: "pendente",
    },
  });

  const isSubmitting = form.formState.isSubmitting;

  useEffect(() => {
    fetchBarbeiros();
  }, []);

  useEffect(() => {
    if (interacao) {
      form.reset({
        cliente_id: interacao.cliente_id,
        tipo: interacao.tipo as InteracaoForm["tipo"],
        descricao: interacao.descricao || "",
        data_interacao: interacao.data_interacao.slice(0, 16),
        responsavel_id: interacao.responsavel_id || "",
        proxima_acao: interacao.proxima_acao || "",
        data_proxima_acao: interacao.data_proxima_acao?.slice(0, 16) || "",
        status: interacao.status as InteracaoForm["status"],
      });
    } else {
      form.reset({
        cliente_id: "",
        tipo: "whatsapp",
        descricao: "",
        data_interacao: new Date().toISOString().slice(0, 16),
        responsavel_id: "",
        proxima_acao: "",
        data_proxima_acao: "",
        status: "pendente",
      });
    }
  }, [interacao, form]);

  async function fetchBarbeiros() {
    const { data } = await supabase
      .from("barbeiros")
      .select("id, nome")
      .eq("status", "active")
      .order("nome");
    setBarbeiros(data || []);
  }

  async function onSubmit(values: InteracaoForm) {
    try {
      const payload = {
        cliente_id: values.cliente_id,
        tipo: values.tipo,
        descricao: values.descricao || null,
        data_interacao: values.data_interacao,
        responsavel_id: values.responsavel_id || null,
        proxima_acao: values.proxima_acao || null,
        data_proxima_acao: values.data_proxima_acao || null,
        status: values.status,
      };

      if (interacao) {
        const { error } = await supabase.from("crm_interacoes").update(payload).eq("id", interacao.id);
        if (error) throw error;
        toast.success("Interação atualizada com sucesso!");
      } else {
        const { error } = await supabase.from("crm_interacoes").insert(payload);
        if (error) throw error;
        toast.success("Interação registrada com sucesso!");
      }

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Erro ao salvar interação:", error);
      toast.error("Erro ao salvar interação");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{interacao ? "Editar Interação" : "Nova Interação"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select
                value={form.watch("cliente_id")}
                onValueChange={(v) => form.setValue("cliente_id", v)}
              >
                <SelectTrigger className="input-dark">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.cliente_id && (
                <p className="text-destructive text-xs">{form.formState.errors.cliente_id.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={form.watch("tipo")}
                onValueChange={(v) => form.setValue("tipo", v as InteracaoForm["tipo"])}
              >
                <SelectTrigger className="input-dark">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="ligacao">Ligação</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="visita">Visita</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data_interacao">Data/Hora *</Label>
              <Input
                id="data_interacao"
                type="datetime-local"
                {...form.register("data_interacao")}
                className="input-dark"
              />
            </div>

            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select
                value={form.watch("responsavel_id") || "none"}
                onValueChange={(v) => form.setValue("responsavel_id", v === "none" ? "" : v)}
              >
                <SelectTrigger className="input-dark">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {barbeiros.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              {...form.register("descricao")}
              placeholder="Detalhes da interação..."
              className="input-dark min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="proxima_acao">Próxima Ação</Label>
            <Input
              id="proxima_acao"
              {...form.register("proxima_acao")}
              placeholder="Ex: Ligar para confirmar agendamento"
              className="input-dark"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data_proxima_acao">Data Próxima Ação</Label>
              <Input
                id="data_proxima_acao"
                type="datetime-local"
                {...form.register("data_proxima_acao")}
                className="input-dark"
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.watch("status")}
                onValueChange={(v) => form.setValue("status", v as InteracaoForm["status"])}
              >
                <SelectTrigger className="input-dark">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="btn-wine">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {interacao ? "Salvar" : "Registrar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
