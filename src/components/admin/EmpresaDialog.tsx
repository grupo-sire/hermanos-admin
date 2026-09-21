import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { TIPOS_ESTABELECIMENTO } from "@/lib/estabelecimento-labels";

interface Plano {
  id: string;
  nome: string;
  slug: string;
}

interface EmpresaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresa: any | null;
  planos: Plano[];
  onSuccess: () => void;
}

interface FormData {
  nome: string;
  email: string;
  telefone: string;
  tipo_estabelecimento: string;
  plano_id: string;
  admin_email: string;
  admin_nome: string;
}

export function EmpresaDialog({ open, onOpenChange, empresa, planos, onSuccess }: EmpresaDialogProps) {
  const [saving, setSaving] = useState(false);
  const [customTipo, setCustomTipo] = useState("");
  const isEditing = !!empresa;

  const { register, handleSubmit, reset, setValue, watch } = useForm<FormData>({
    defaultValues: {
      nome: "",
      email: "",
      telefone: "",
      tipo_estabelecimento: "barbearia",
      plano_id: "",
      admin_email: "",
      admin_nome: "",
    },
  });

  useEffect(() => {
    if (empresa) {
      const tipo = empresa.tipo_estabelecimento || "barbearia";
      const isPredefined = TIPOS_ESTABELECIMENTO.some(t => t.value === tipo);
      setCustomTipo(isPredefined ? "" : tipo);
      reset({
        nome: empresa.nome || "",
        email: empresa.email || "",
        telefone: empresa.telefone || "",
        tipo_estabelecimento: tipo,
        plano_id: empresa.plano_id || "",
        admin_email: "",
        admin_nome: "",
      });
    } else {
      setCustomTipo("");
      reset({
        nome: "",
        email: "",
        telefone: "",
        tipo_estabelecimento: "barbearia",
        plano_id: planos[0]?.id || "",
        admin_email: "",
        admin_nome: "",
      });
    }
  }, [empresa, planos, reset]);

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    try {
      if (isEditing) {
        const { error } = await supabase
          .from("empresas")
          .update({
            nome: data.nome,
            email: data.email || null,
            telefone: data.telefone || null,
            tipo_estabelecimento: data.tipo_estabelecimento,
            plano_id: data.plano_id || null,
          })
          .eq("id", empresa.id);

        if (error) throw error;
        toast.success("Empresa atualizada!");
      } else {
        // Create empresa
        const { data: newEmpresa, error: empError } = await supabase
          .from("empresas")
          .insert({
            nome: data.nome,
            email: data.email || null,
            telefone: data.telefone || null,
            tipo_estabelecimento: data.tipo_estabelecimento,
            plano_id: data.plano_id || null,
          })
          .select()
          .single();

        if (empError) throw empError;

        // Auto-create default "Matriz" unit
        const { error: unidadeError } = await supabase.from("unidades").insert({
          empresa_id: newEmpresa.id,
          nome: "Matriz",
          endereco: "",
          status: "active",
        });
        if (unidadeError) {
          console.warn("Erro ao criar unidade Matriz:", unidadeError.message);
        }

        // Auto-create per-empresa email templates (convite_usuario and lembrete only; convite_cliente is global)
        await supabase.from("email_config").insert([
          {
            empresa_id: newEmpresa.id,
            tipo: "convite_usuario",
            assunto: "Você foi convidado para {{nome_empresa}}",
            corpo_html: '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;"><div style="text-align:center;padding:30px 0;background:linear-gradient(135deg,{{cor_primaria}},#1a1a2e);border-radius:12px;"><h1 style="color:white;margin:0;font-size:24px;">{{nome_empresa}}</h1></div><div style="padding:30px 20px;"><h2 style="color:#333;">Bem-vindo(a) à equipe!</h2><p style="color:#666;line-height:1.6;">Você foi convidado(a) para fazer parte da equipe <strong>{{nome_empresa}}</strong>.</p><div style="text-align:center;padding:20px 0;"><a href="{{link_login}}" style="background:{{cor_primaria}};color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;">Acessar o Sistema</a></div><div style="text-align:center;padding:0 0 20px;"><a href="{{link_definir_senha}}" style="background:transparent;color:{{cor_primaria}};padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;border:2px solid {{cor_primaria}};">Definir Minha Senha</a></div></div></div>',
          },
          {
            empresa_id: newEmpresa.id,
            tipo: "lembrete_agendamento",
            assunto: "Lembrete: Seu agendamento em {{nome_empresa}} é amanhã!",
            corpo_html: '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;"><div style="text-align:center;padding:30px 0;background:linear-gradient(135deg,{{cor_primaria}},#1a1a2e);border-radius:12px;"><h1 style="color:white;margin:0;font-size:24px;">{{nome_empresa}}</h1></div><div style="padding:30px 20px;"><h2 style="color:#333;">Lembrete de Agendamento</h2><p style="color:#666;">Olá <strong>{{nome_cliente}}</strong>,</p><div style="background:#f8f8f8;border-radius:8px;padding:20px;margin:16px 0;"><p style="margin:4px 0;color:#333;"><strong>📅 Data:</strong> {{data_agendamento}}</p><p style="margin:4px 0;color:#333;"><strong>⏰ Horário:</strong> {{horario_agendamento}}</p><p style="margin:4px 0;color:#333;"><strong>✂️ Serviço:</strong> {{servico}}</p><p style="margin:4px 0;color:#333;"><strong>👤 Profissional:</strong> {{profissional}}</p></div></div></div>',
            horas_antes: 24,
          },
        ] as any);


        // If admin email provided, send invite
        if (data.admin_email) {
          const { error: inviteError } = await supabase.functions.invoke("invite-user", {
            body: {
              email: data.admin_email,
              nome: data.admin_nome || data.nome,
              empresa_id: newEmpresa.id,
              role: "admin",
            },
          });

          if (inviteError) {
            toast.warning("Empresa criada, mas erro ao enviar convite: " + inviteError.message);
          } else {
            toast.success("Empresa criada e convite enviado!");
          }
        } else {
          toast.success("Empresa criada!");
        }
      }

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar empresa");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Empresa" : "Nova Empresa"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome da Empresa *</Label>
            <Input {...register("nome", { required: true })} placeholder="Ex: Barbearia Premium" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input {...register("email")} type="email" placeholder="contato@empresa.com" />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input {...register("telefone")} placeholder="(11) 99999-9999" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Estabelecimento</Label>
              <Select
                value={TIPOS_ESTABELECIMENTO.some(t => t.value === watch("tipo_estabelecimento")) ? watch("tipo_estabelecimento") : "__custom__"}
                onValueChange={(v) => {
                  if (v === "__custom__") {
                    setValue("tipo_estabelecimento", customTipo || "outro");
                  } else {
                    setValue("tipo_estabelecimento", v);
                    setCustomTipo("");
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_ESTABELECIMENTO.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>
                  ))}
                  <SelectItem value="__custom__">✏️ Digitar manualmente</SelectItem>
                </SelectContent>
              </Select>
              {(!TIPOS_ESTABELECIMENTO.some(t => t.value === watch("tipo_estabelecimento")) || customTipo) && (
                <Input
                  value={customTipo || (TIPOS_ESTABELECIMENTO.some(t => t.value === watch("tipo_estabelecimento")) ? "" : watch("tipo_estabelecimento"))}
                  onChange={(e) => { setCustomTipo(e.target.value); setValue("tipo_estabelecimento", e.target.value); }}
                  placeholder="Ex: Academia, Consultório, Loja..."
                  className="mt-1"
                />
              )}
            </div>
            <div className="space-y-2">
              <Label>Plano</Label>
              <Select
                value={watch("plano_id")}
                onValueChange={(v) => setValue("plano_id", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {planos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!isEditing && (
            <div className="border-t border-border pt-4 space-y-4">
              <p className="text-sm font-medium text-muted-foreground">
                Administrador (convite por email)
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Admin</Label>
                  <Input {...register("admin_nome")} placeholder="Nome completo" />
                </div>
                <div className="space-y-2">
                  <Label>Email do Admin</Label>
                  <Input {...register("admin_email")} type="email" placeholder="admin@empresa.com" />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? "Salvar" : "Criar Empresa"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
