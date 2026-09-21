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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Crown, Camera, X } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { useEmpresa } from "@/contexts/EmpresaContext";

const clienteSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  telefone: z.string().min(10, "Telefone inválido").max(20),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  data_nascimento: z.string().optional().or(z.literal("")),
  observacoes: z.string().max(500).optional().or(z.literal("")),
  plano_assinatura: z.string().optional().or(z.literal("")),
  status_assinatura: z.string().optional().or(z.literal("")),
});

type ClienteFormData = z.infer<typeof clienteSchema>;

interface ClienteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente?: Tables<"clientes"> | null;
  onSuccess: () => void;
}

export function ClienteDialog({
  open,
  onOpenChange,
  cliente,
  onSuccess,
}: ClienteDialogProps) {
  const [loading, setLoading] = useState(false);
  const [fotoUrl, setFotoUrl] = useState<string>("");
  const isEditing = !!cliente;
  const { empresaId } = useEmpresa();

  const form = useForm<ClienteFormData>({
    resolver: zodResolver(clienteSchema),
    defaultValues: {
      nome: "",
      telefone: "",
      email: "",
      data_nascimento: "",
      observacoes: "",
      plano_assinatura: "",
      status_assinatura: "inativo",
    },
  });

  useEffect(() => {
    if (cliente) {
      setFotoUrl((cliente as any).foto_url || "");
      form.reset({
        nome: cliente.nome,
        telefone: cliente.telefone,
        email: cliente.email || "",
        data_nascimento: cliente.data_nascimento || "",
        observacoes: cliente.observacoes || "",
        plano_assinatura: (cliente as any).plano_assinatura || "",
        status_assinatura: (cliente as any).status_assinatura || "inativo",
      });
    } else {
      setFotoUrl("");
      form.reset({
        nome: "",
        telefone: "",
        email: "",
        data_nascimento: "",
        observacoes: "",
        plano_assinatura: "",
        status_assinatura: "inativo",
      });
    }
  }, [cliente, form]);

  const handleFotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Selecione uma imagem de até 5MB.", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFotoUrl(reader.result as string);
      toast({ title: "Foto selecionada!" });
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async (data: ClienteFormData) => {
    setLoading(true);
    try {
      const payload: any = {
        nome: data.nome.trim(),
        telefone: data.telefone.trim(),
        email: data.email?.trim() || null,
        data_nascimento: data.data_nascimento || null,
        observacoes: data.observacoes?.trim() || null,
        plano_assinatura: data.plano_assinatura || null,
        status_assinatura: data.status_assinatura || "inativo",
        foto_url: fotoUrl || null,
      };

      if (!isEditing && empresaId) {
        payload.empresa_id = empresaId;
      }

      if (isEditing && cliente) {
        const { error } = await supabase
          .from("clientes")
          .update(payload)
          .eq("id", cliente.id);

        if (error) throw error;

        toast({
          title: "Cliente atualizado com sucesso!",
        });
      } else {
        const { error } = await supabase.from("clientes").insert([payload]);

        if (error) throw error;

        toast({
          title: "Cliente cadastrado com sucesso!",
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao salvar cliente",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Cliente" : "Novo Cliente"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Foto do Cliente (Opcional) */}
            <div className="flex items-center gap-4 p-3 rounded-xl bg-secondary/30 border border-white/[0.08]">
              <div className="relative group shrink-0">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/50 to-primary/20 flex items-center justify-center font-bold text-lg text-foreground overflow-hidden border border-white/10">
                  {fotoUrl ? (
                    <img src={fotoUrl} alt="Foto do Cliente" className="w-full h-full object-cover" />
                  ) : (
                    form.watch("nome")?.charAt(0).toUpperCase() || "C"
                  )}
                </div>
                <label className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground p-1 rounded-full shadow-lg cursor-pointer hover:scale-110 transition-all border border-background">
                  <Camera className="h-3.5 w-3.5" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleFotoUpload} />
                </label>
              </div>
              <div className="flex-1 min-w-0 text-xs">
                <p className="font-bold text-foreground">Foto do Cliente (Opcional)</p>
                <p className="text-muted-foreground text-[11px]">Envie uma imagem JPG ou PNG para o perfil.</p>
                {fotoUrl && (
                  <button
                    type="button"
                    onClick={() => setFotoUrl("")}
                    className="text-[10px] text-destructive hover:underline mt-1 font-semibold flex items-center gap-1"
                  >
                    <X className="h-3 w-3" /> Remover Foto
                  </button>
                )}
              </div>
            </div>
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo *</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome do cliente" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="telefone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone / WhatsApp *</FormLabel>
                    <FormControl>
                      <Input placeholder="(11) 99999-9999" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="data_nascimento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Nascimento</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="cliente@email.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Painel de Assinatura Recorrente */}
            <div className="p-3 bg-secondary/30 rounded-xl border border-primary/20 space-y-3">
              <div className="flex items-center gap-2 font-bold text-xs text-primary">
                <Crown className="h-4 w-4 text-warning" />
                Plano de Assinatura Hermanos
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="plano_assinatura"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Plano Ativo</FormLabel>
                      <select
                        {...field}
                        className="w-full h-9 rounded-md bg-secondary/50 border border-input px-3 text-xs"
                      >
                        <option value="">Nenhum Plano</option>
                        <option value="INFINITE CUTS">INFINITE CUTS (R$ 99,89/mês)</option>
                        <option value="INFINITE DUOS">INFINITE DUOS (R$ 199,89/mês)</option>
                        <option value="INFINITE BARB">INFINITE BARB (R$ 129,89/mês)</option>
                        <option value="INFINITE PLUS">INFINITE PLUS (R$ 34,90/mês)</option>
                      </select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status_assinatura"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Status da Assinatura</FormLabel>
                      <select
                        {...field}
                        className="w-full h-9 rounded-md bg-secondary/50 border border-input px-3 text-xs font-bold"
                      >
                        <option value="ativo" className="text-success font-bold">🟢 Ativo</option>
                        <option value="inativo" className="text-muted-foreground">⚪ Inativo</option>
                        <option value="atrasado" className="text-destructive font-bold">🔴 Em Atraso</option>
                      </select>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Preferências de corte, estilo de barba, observações..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" className="btn-wine" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Salvar Alterações" : "Cadastrar Cliente"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
