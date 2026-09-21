import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useEmpresa } from "@/contexts/EmpresaContext";
import type { Tables } from "@/integrations/supabase/types";
import { Loader2, Crown, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const barbeiroSchema = z.object({
  nome: z.string().min(1, "Informe o nome do profissional").max(100),
  email: z.string().optional().or(z.literal("")),
  telefone: z.string().optional().or(z.literal("")),
  codigo_cadeira: z.string().optional().or(z.literal("")),
  unidade_id: z.string().optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]),
  comissao_percentual: z.coerce.number().min(0).max(100).default(0),
  comissao_servico: z.boolean().default(true),
  comissao_produto: z.boolean().default(true),
  registrar_usuario: z.boolean().default(false),
  ranking: z.string().default("Top Barber Junior"),
});

type BarbeiroFormData = z.infer<typeof barbeiroSchema>;

interface BarbeiroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  barbeiro?: Tables<"barbeiros"> | null;
  onSuccess: () => void;
}

export function BarbeiroDialog({
  open,
  onOpenChange,
  barbeiro,
  onSuccess,
}: BarbeiroDialogProps) {
  const [loading, setLoading] = useState(false);
  const [unidades, setUnidades] = useState<{ id: string; nome: string }[]>([]);
  const { labels, empresaId, config } = useEmpresa();
  const { isSuperAdmin } = useUserRole();
  const isEditing = !!barbeiro;
  const form = useForm<BarbeiroFormData>({
    resolver: zodResolver(barbeiroSchema),
    defaultValues: {
      nome: "",
      email: "",
      telefone: "",
      codigo_cadeira: "",
      unidade_id: "",
      status: "active",
      comissao_percentual: 0,
      comissao_servico: true,
      comissao_produto: true,
      registrar_usuario: false,
      ranking: "Top Barber Junior",
    },
  });

  useEffect(() => {
    if (barbeiro) {
      form.reset({
        nome: barbeiro.nome,
        email: barbeiro.email,
        telefone: barbeiro.telefone || "",
        codigo_cadeira: (barbeiro as any).codigo_cadeira || "",
        unidade_id: barbeiro.unidade_id || "",
        status: barbeiro.status as "active" | "inactive",
        comissao_percentual: Number((barbeiro as any).comissao_percentual) || 0,
        comissao_servico: (barbeiro as any).comissao_servico ?? true,
        comissao_produto: (barbeiro as any).comissao_produto ?? true,
        registrar_usuario: !!barbeiro.user_id,
        ranking: (barbeiro as any).ranking || "Top Barber Junior",
      });
    } else {
      form.reset({
        nome: "",
        email: "",
        telefone: "",
        codigo_cadeira: "",
        unidade_id: "",
        status: "active",
        comissao_percentual: 0,
        comissao_servico: true,
        comissao_produto: true,
        registrar_usuario: false,
        ranking: "Top Barber Junior",
      });
    }
  }, [barbeiro, open, form]);
  
  useEffect(() => {
    if (empresaId) {
      fetchUnidades();
    }
  }, [empresaId]);

  const fetchUnidades = async () => {
    if (!empresaId) return;
    const { data } = await supabase
      .from("unidades")
      .select("id, nome")
      .eq("empresa_id", empresaId)
      .eq("status", "active")
      .order("nome");
    if (data) {
      setUnidades(data);
      if (!isEditing && data.length > 0 && !form.getValues("unidade_id")) {
        form.setValue("unidade_id", data[0].id);
      }
    }
  };

  const onSubmit = async (data: BarbeiroFormData) => {
    setLoading(true);
    try {
      const targetUnidadeId = data.unidade_id || (unidades[0]?.id || barbeiro?.unidade_id || null);

      // TRAVA DE DUPLICIDADE: Nao permitir 2 barbeiros ativos com o mesmo codigo na mesma unidade
      if (data.codigo_cadeira && data.codigo_cadeira !== "none" && data.status === "active" && targetUnidadeId) {
        try {
          let checkQuery = supabase
            .from("barbeiros")
            .select("id, nome")
            .eq("unidade_id", targetUnidadeId)
            .eq("codigo_cadeira", data.codigo_cadeira)
            .eq("status", "active");

          if (isEditing && barbeiro) {
            checkQuery = checkQuery.neq("id", barbeiro.id);
          }

          const { data: existing } = await checkQuery;
          if (existing && existing.length > 0) {
            toast({
              title: `Código ${data.codigo_cadeira} já está em uso!`,
              description: `O barbeiro ativo "${existing[0].nome}" já está utilizando o código ${data.codigo_cadeira} nesta unidade. Desative o barbeiro anterior ou selecione outro código.`,
              variant: "destructive",
            });
            setLoading(false);
            return;
          }
        } catch {
          // Se a coluna ainda nao existir no schema cache, tolera a consulta
        }
      }

      // Gravacao da data exata de desligamento/inativacao para historico
      const dataDesligamento = data.status === "inactive" 
        ? ((barbeiro as any)?.data_desligamento || new Date().toISOString()) 
        : null;

      const cleanCodigo = (data.codigo_cadeira && data.codigo_cadeira !== "none") ? data.codigo_cadeira : null;

      const payload: any = {
        nome: (data.nome || "").trim(),
        email: (data.email || "").trim(),
        telefone: data.telefone ? data.telefone.trim() : null,
        codigo_cadeira: cleanCodigo,
        status: data.status,
        data_desligamento: dataDesligamento,
        comissao_percentual: Number(data.comissao_percentual) || 0,
        comissao_servico: data.comissao_servico,
        comissao_produto: data.comissao_produto,
        empresa_id: empresaId,
        unidade_id: targetUnidadeId,
        ranking: data.ranking || "Top Barber Junior",
      };

      let saveError: any = null;

      if (isEditing && barbeiro) {
        const res = await supabase
          .from("barbeiros")
          .update(payload)
          .eq("id", barbeiro.id);
        saveError = res.error;

        // Se o banco reclamar de alguma coluna nova (codigo_cadeira, data_desligamento ou ranking), tenta com payload base
        if (saveError) {
          console.warn("Erro ao atualizar com payload completo, tentando payload compativel:", saveError.message);
          const safePayload = {
            nome: (data.nome || "").trim(),
            email: (data.email || "").trim(),
            telefone: data.telefone ? data.telefone.trim() : null,
            status: data.status,
            comissao_percentual: Number(data.comissao_percentual) || 0,
            comissao_servico: data.comissao_servico,
            comissao_produto: data.comissao_produto,
            empresa_id: empresaId,
            unidade_id: targetUnidadeId,
          };
          const retryRes = await supabase
            .from("barbeiros")
            .update(safePayload)
            .eq("id", barbeiro.id);
          saveError = retryRes.error;
        }
      } else {
        const res = await supabase.from("barbeiros").insert(payload);
        saveError = res.error;

        if (saveError) {
          console.warn("Erro ao inserir com payload completo, tentando payload compativel:", saveError.message);
          const safePayload = {
            nome: (data.nome || "").trim(),
            email: (data.email || "").trim(),
            telefone: data.telefone ? data.telefone.trim() : null,
            status: data.status,
            comissao_percentual: Number(data.comissao_percentual) || 0,
            comissao_servico: data.comissao_servico,
            comissao_produto: data.comissao_produto,
            empresa_id: empresaId,
            unidade_id: targetUnidadeId,
          };
          const retryRes = await supabase.from("barbeiros").insert(safePayload);
          saveError = retryRes.error;
        }
      }

      if (saveError) throw saveError;

      toast({ title: `${labels.profissional} ${isEditing ? "atualizado" : "cadastrado"} com sucesso!` });

      // Se marcou para registrar como usuário, cria um convite
      if (!isEditing && data.registrar_usuario && data.email) {
        const { data: userData } = await supabase.auth.getUser();
        
        if (userData.user) {
          await supabase
            .from("convites")
            .insert({
              email: data.email.trim(),
              empresa_id: empresaId,
              convidado_por: userData.user.id,
              status: "pendente"
            });
        }
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao salvar barbeiro:", error);
      toast({
        title: "Erro ao salvar barbeiro",
        description: error.message || "Ocorreu um erro ao gravar os dados no banco.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const onInvalid = (errors: any) => {
    console.error("Erros de validação do formulário:", errors);
    const firstKey = Object.keys(errors)[0];
    if (firstKey) {
      toast({
        title: "Campo Obrigatório Incompleto",
        description: errors[firstKey]?.message || "Verifique os dados preenchidos no formulário.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto bg-card border-white/10 my-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? `Editar ${labels.profissional}` : `Novo ${labels.profissional}`}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome *</FormLabel>
                  <FormControl>
                    <Input {...field} className="input-dark" placeholder="Nome completo" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" className="input-dark" placeholder="email@exemplo.com" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="telefone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone</FormLabel>
                  <FormControl>
                    <Input {...field} className="input-dark" placeholder="(11) 99999-9999" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="codigo_cadeira"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold text-foreground">Código do Barbeiro (Ex: Barbeiro H2)</FormLabel>
                  <Select onValueChange={(val) => field.onChange(val === "none" ? "" : val)} value={field.value || "none"}>
                    <FormControl>
                      <SelectTrigger className="input-dark font-mono font-bold">
                        <SelectValue placeholder="Selecione o código (Ex: H2)..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-popover border-white/10 max-h-56">
                      <SelectItem value="none">Sem Código (Reserva / Apoio)</SelectItem>
                      {Array.from({ length: 15 }, (_, i) => `H${i + 1}`).map((codigo) => (
                        <SelectItem key={codigo} value={codigo} className="font-mono font-bold">
                          Barbeiro {codigo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="unidade_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold text-foreground">Filial / Unidade de Atuação *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="input-dark">
                        <SelectValue placeholder="Selecione a filial..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-popover border-white/10">
                      {unidades.map((unidade) => (
                        <SelectItem key={unidade.id} value={unidade.id}>
                          {unidade.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="input-dark">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-popover border-white/10">
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Ranking Corporativo (Disponível Exclusivamente para SuperAdmin / Diretoria) */}
            {isSuperAdmin && (
              <FormField
                control={form.control}
                name="ranking"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5 text-red-400 font-bold">
                      <Crown className="h-4 w-4" /> Nível de Ranking Corporativo (Exclusivo SuperAdmin)
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="input-dark">
                          <SelectValue placeholder="Selecione o nível de ranking" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-popover border-white/10">
                        <SelectItem value="Top Barber Junior">🥉 Top Barber Junior</SelectItem>
                        <SelectItem value="Top Barber Bronze">🥉 Top Barber Bronze</SelectItem>
                        <SelectItem value="Top Barber Prata">🥈 Top Barber Prata</SelectItem>
                        <SelectItem value="Top Barber Ouro">🥇 Top Barber Ouro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Informação sobre Comissionamento Padronizado */}
            <div className="space-y-2 p-3.5 rounded-xl border border-red-900/30 bg-black/40">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Comissionamento Automático
                </h4>
                <Badge className="bg-red-950/60 text-red-400 border-red-500/40 text-[9px] font-mono">Padrão do Sistema</Badge>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                As comissões são apuradas automaticamente: <strong className="text-zinc-200">35% em serviços e assinaturas</strong> + <strong className="text-zinc-200">30% de produtos da filial</strong> distribuídos proporcionalmente pelo volume de atendimentos.
              </p>
              <p className="text-[10px] text-zinc-500 italic">
                Campanhas e exceções corporativas podem ser gerenciadas nas Configurações pelo SuperAdmin.
              </p>
            </div>

            {!isEditing && (
              <FormField
                control={form.control}
                name="registrar_usuario"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0 p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1">
                      <FormLabel className="text-sm font-semibold">
                        Cadastrar como usuário do sistema
                      </FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Envia um convite por e-mail para que o profissional possa acessar o dashboard.
                      </p>
                    </div>
                  </FormItem>
                )}
              />
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-white/10"
              >
                Cancelar
              </Button>
              <Button type="submit" className="btn-wine" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditing ? "Salvar" : "Cadastrar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
