import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUnidade } from "@/contexts/UnidadeContext";

const formSchema = z.object({
  barbeiro_id: z.string().optional().or(z.literal("")),
  tipo: z.enum(["falta", "almoco", "compromisso"]),
  data: z.string().min(1, "Selecione uma data"),
  hora_inicio: z.string().min(1, "Selecione horário inicial"),
  hora_fim: z.string().min(1, "Selecione horário final"),
  motivo: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface BloqueioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  selectedDate?: Date;
  defaultTipo?: string;
}

const tipoLabels: Record<string, string> = {
  falta: "Falta",
  almoco: "Almoço",
  compromisso: "Compromisso",
};

export function BloqueioDialog({ open, onOpenChange, onSuccess, selectedDate, defaultTipo }: BloqueioDialogProps) {
  const [loading, setLoading] = useState(false);
  const [barbeiros, setBarbeiros] = useState<{ id: string; nome: string }[]>([]);
  const { selectedUnidadeId } = useUnidade();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      barbeiro_id: "",
      tipo: (defaultTipo as "falta" | "almoco" | "compromisso") || "almoco",
      data: selectedDate ? format(selectedDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      hora_inicio: "12:00",
      hora_fim: "13:00",
      motivo: "",
    },
  });

  useEffect(() => {
    if (open) {
      fetchBarbeiros();
      form.reset({
        barbeiro_id: "",
        tipo: "almoco",
        data: selectedDate ? format(selectedDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
        hora_inicio: "12:00",
        hora_fim: "13:00",
        motivo: "",
      });
    }
  }, [open, selectedDate]);

  const fetchBarbeiros = async () => {
    let query = supabase.from("barbeiros").select("id, nome").eq("status", "active");
    if (selectedUnidadeId) query = query.eq("unidade_id", selectedUnidadeId);
    const { data } = await query.order("nome");
    if (data) setBarbeiros(data);
  };

  const onSubmit = async (data: FormData) => {
    if (!selectedUnidadeId) {
      toast.error("Selecione uma unidade primeiro");
      return;
    }
    setLoading(true);
    try {
      const dataInicio = new Date(`${data.data}T${data.hora_inicio}:00`);
      const dataFim = new Date(`${data.data}T${data.hora_fim}:00`);

      if (dataFim <= dataInicio) {
        toast.error("Horário final deve ser após o horário inicial");
        setLoading(false);
        return;
      }

      const { error } = await supabase.from("agenda_bloqueios").insert({
        barbeiro_id: data.barbeiro_id || null,
        unidade_id: selectedUnidadeId,
        tipo: data.tipo,
        data_inicio: dataInicio.toISOString(),
        data_fim: dataFim.toISOString(),
        motivo: data.motivo || null,
      });

      if (error) throw error;
      toast.success(`Bloqueio de ${tipoLabels[data.tipo]} registrado!`);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Erro ao registrar bloqueio");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] bg-card border-white/[0.08]">
        <DialogHeader>
          <DialogTitle className="text-foreground">Novo Bloqueio</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="tipo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Bloqueio</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="input-dark">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="falta">🚫 Falta</SelectItem>
                      <SelectItem value="almoco">🍽️ Almoço</SelectItem>
                      <SelectItem value="compromisso">📅 Compromisso</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="barbeiro_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Barbeiro (opcional - vazio bloqueia todos)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="input-dark">
                        <SelectValue placeholder="Todos os barbeiros" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {barbeiros.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="data"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data</FormLabel>
                  <FormControl>
                    <Input type="date" className="input-dark" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="hora_inicio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horário Início</FormLabel>
                    <FormControl>
                      <Input type="time" className="input-dark" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="hora_fim"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horário Fim</FormLabel>
                    <FormControl>
                      <Input type="time" className="input-dark" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="motivo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo (opcional)</FormLabel>
                  <FormControl>
                    <Textarea className="input-dark resize-none" rows={2} placeholder="Motivo do bloqueio..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" className="btn-soft" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="btn-wine" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Bloquear
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
