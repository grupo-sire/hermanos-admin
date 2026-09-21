import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Building2, Phone, Mail, Instagram, Facebook, MessageCircle, Save, Loader2,
  Upload, Clock, Image, Palette, AlertTriangle, RotateCcw, Sparkles, Calendar,
  Sun, Moon, Plus
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useAuth } from "@/contexts/AuthContext";
import { THEME_PALETTES, applyThemeColors, hexToHSL } from "@/lib/theme-palettes";
import { TIPOS_ESTABELECIMENTO } from "@/lib/estabelecimento-labels";
import EmailConfigSection from "@/components/configuracoes/EmailConfigSection";
import ComissionamentoConfigSection from "@/components/configuracoes/ComissionamentoConfigSection";

const empresaSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  slug: z.string().min(3, "Slug deve ter no mínimo 3 caracteres").regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífens"),
  cnpj: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  endereco: z.string().optional(),
  instagram: z.string().optional(),
  facebook: z.string().optional(),
  whatsapp: z.string().optional(),
});

type EmpresaForm = z.infer<typeof empresaSchema>;

const DIAS_SEMANA = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
  { value: 6, label: "Sábado" },
];

interface HorarioConfig {
  dia_semana: number;
  horario_abertura: string;
  horario_fechamento: string;
  aberto: boolean;
}

export default function Configuracoes() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { config: empresaConfig, refresh: refreshEmpresa, empresaId } = useEmpresa();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [capaUrl, setCapaUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCapa, setUploadingCapa] = useState(false);
  const [temaPublico, setTemaPublico] = useState<"light" | "dark">("dark");
  const [horarios, setHorarios] = useState<HorarioConfig[]>(
    DIAS_SEMANA.map((d) => ({
      dia_semana: d.value,
      horario_abertura: "09:00",
      horario_fechamento: "20:00",
      aberto: d.value !== 0,
    }))
  );
  const [savingHorarios, setSavingHorarios] = useState(false);
  const [selectedUnidadeHorario, setSelectedUnidadeHorario] = useState<string>("");
  const { unidades, selectedUnidadeId } = useUnidade();

  // Theme & Reset state
  const [selectedCorPrimaria, setSelectedCorPrimaria] = useState(empresaConfig.cor_primaria);
  const [selectedCorNome, setSelectedCorNome] = useState(empresaConfig.cor_nome);
  const [customHex, setCustomHex] = useState("#8B1A3A");
  const [isCustomTheme, setIsCustomTheme] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  const [selectedTipo, setSelectedTipo] = useState(empresaConfig.tipo_estabelecimento);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetting, setResetting] = useState(false);
  const [permitirEscolhaProfissional, setPermitirEscolhaProfissional] = useState(true);

  const form = useForm<EmpresaForm>({
    resolver: zodResolver(empresaSchema),
    defaultValues: {
      nome: "", cnpj: "", telefone: "", email: "", endereco: "", instagram: "", facebook: "", whatsapp: "",
    },
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  useEffect(() => {
    const unidadeId = selectedUnidadeHorario || selectedUnidadeId;
    if (unidadeId) fetchHorarios(unidadeId);
  }, [selectedUnidadeHorario, selectedUnidadeId]);

  useEffect(() => {
    setSelectedCorPrimaria(empresaConfig.cor_primaria);
    setSelectedCorNome(empresaConfig.cor_nome);
    setSelectedTipo(empresaConfig.tipo_estabelecimento);
  }, [empresaConfig]);

  async function fetchConfig() {
    if (!empresaId) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase.from("empresas").select("*").eq("id", empresaId).single();
      if (error) throw error;
        if (data) {
          setConfigId(data.id);
          setLogoUrl(data.logo_url);
          setCapaUrl((data as any).capa_url);
          setTemaPublico((data as any).tema_publico || "dark");
          setPermitirEscolhaProfissional(data.permitir_escolha_profissional ?? true);
          form.reset({
            nome: data.nome || "", 
            slug: data.slug || "",
            cnpj: data.cnpj || "", 
            telefone: data.telefone || "",
            email: data.email || "", 
            endereco: data.endereco || "", 
            instagram: data.instagram || "",
            facebook: data.facebook || "", 
            whatsapp: data.whatsapp || "",
          });
        }
    } catch (error) {
      toast.error("Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  }

  async function fetchHorarios(unidadeId: string) {
    const { data } = await supabase
      .from("horarios_funcionamento")
      .select("dia_semana, horario_abertura, horario_fechamento, aberto")
      .eq("unidade_id", unidadeId)
      .order("dia_semana");

    if (data && data.length > 0) {
      setHorarios(
        DIAS_SEMANA.map((d) => {
          const found = data.find((h: any) => h.dia_semana === d.value);
          return found
            ? { ...found, horario_abertura: found.horario_abertura.slice(0, 5), horario_fechamento: found.horario_fechamento.slice(0, 5) }
            : { dia_semana: d.value, horario_abertura: "09:00", horario_fechamento: "20:00", aberto: d.value !== 0 };
        })
      );
    } else {
      setHorarios(DIAS_SEMANA.map((d) => ({
        dia_semana: d.value, horario_abertura: "09:00", horario_fechamento: "20:00", aberto: d.value !== 0,
      })));
    }
  }

  async function onSubmit(values: EmpresaForm) {
    setSaving(true);
    try {
      const payload = {
        nome: values.nome, 
        slug: values.slug.toLowerCase().trim(),
        cnpj: values.cnpj || null, 
        telefone: values.telefone || null,
        email: values.email || null, 
        endereco: values.endereco || null,
        instagram: values.instagram || null, 
        facebook: values.facebook || null, 
        whatsapp: values.whatsapp || null,
      };
      if (configId) {
        const { error } = await supabase.from("empresas").update({
          ...payload,
          tema_publico: temaPublico,
        }).eq("id", configId);
        if (error) throw error;
      }
      await refreshEmpresa();
      toast.success("Configurações salvas!");
    } catch (error) {
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem válida");
      return;
    }
    setUploadingLogo(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("logos").upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("logos").getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;
      if (configId) {
        await supabase.from("empresas").update({ logo_url: publicUrl }).eq("id", configId);
      }
      setLogoUrl(publicUrl);
      await refreshEmpresa();
      toast.success("Logo atualizada!");
    } catch (error: any) {
      toast.error(error.message || "Erro ao enviar logo");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleCapaUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCapa(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `capa-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("logos").upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("logos").getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;
      if (configId) {
        await supabase.from("empresas").update({ capa_url: publicUrl } as any).eq("id", configId);
      }
      setCapaUrl(publicUrl);
      await refreshEmpresa();
      toast.success("Banner atualizado!");
    } catch (error: any) {
      toast.error(error.message || "Erro ao enviar banner");
    } finally {
      setUploadingCapa(false);
    }
  }

  async function handleSaveHorarios() {
    const unidadeId = selectedUnidadeHorario || selectedUnidadeId;
    if (!unidadeId) {
      toast.error("Selecione uma unidade");
      return;
    }
    setSavingHorarios(true);
    try {
      await supabase.from("horarios_funcionamento").delete().eq("unidade_id", unidadeId);
      const rows = horarios.map((h) => ({
        unidade_id: unidadeId, dia_semana: h.dia_semana, horario_abertura: h.horario_abertura,
        horario_fechamento: h.horario_fechamento, aberto: h.aberto,
      }));
      const { error } = await supabase.from("horarios_funcionamento").insert(rows);
      if (error) throw error;
      toast.success("Horários salvos!");
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar horários");
    } finally {
      setSavingHorarios(false);
    }
  }

  const updateHorario = (diaSemana: number, field: keyof HorarioConfig, value: any) => {
    setHorarios((prev) =>
      prev.map((h) => (h.dia_semana === diaSemana ? { ...h, [field]: value } : h))
    );
  };

  async function handleSaveTheme() {
    if (!configId) return;
    setSavingTheme(true);
    try {
      const { error } = await supabase.from("empresas").update({
        cor_primaria: selectedCorPrimaria,
        cor_nome: selectedCorNome,
        tipo_estabelecimento: selectedTipo,
      }).eq("id", configId);
      if (error) throw error;
      applyThemeColors(selectedCorPrimaria);
      await refreshEmpresa();
      toast.success("Tema atualizado!");
    } catch (error) {
      toast.error("Erro ao salvar tema");
    } finally {
      setSavingTheme(false);
    }
  }

  async function handleResetSystem() {
    if (resetConfirmText !== "REDEFINIR") return;
    setResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke("reset-sistema");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Sistema redefinido! Faça login novamente.");
      localStorage.removeItem("selectedUnidadeId");
      setShowResetDialog(false);
      await signOut();
      navigate("/login", { replace: true });
    } catch (error: any) {
      toast.error(error.message || "Erro ao redefinir o sistema");
    } finally {
      setResetting(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" description="Configure o perfil da sua empresa" />

      <Tabs defaultValue="empresa" className="space-y-6">
        <TabsList className="bg-secondary/30">
          <TabsTrigger value="empresa">Empresa</TabsTrigger>
          <TabsTrigger value="horarios">Horários</TabsTrigger>
          <TabsTrigger value="comissao">Comissionamento & Campanhas</TabsTrigger>
          <TabsTrigger value="emails">Emails</TabsTrigger>
          <TabsTrigger value="sistema">Sistema</TabsTrigger>
        </TabsList>

        <TabsContent value="comissao">
          <ComissionamentoConfigSection />
        </TabsContent>

        {/* Tab: Empresa */}
        <TabsContent value="empresa">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="panel">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-5 w-5 text-primary" />Dados da Empresa</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Logo da Empresa</Label>
                    <div className="flex items-center gap-4">
                      {logoUrl ? (
                        <div className="relative group">
                          <img src={logoUrl} alt="Logo" className="w-16 h-16 rounded-xl object-cover border border-white/10" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl cursor-pointer" onClick={() => document.getElementById('logo-upload')?.click()}>
                            <Upload className="h-4 w-4 text-white" />
                          </div>
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-secondary flex items-center justify-center border border-dashed border-white/10 cursor-pointer" onClick={() => document.getElementById('logo-upload')?.click()}>
                          <Plus className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
                        <Button type="button" variant="outline" size="sm" className="btn-soft h-8" onClick={() => document.getElementById('logo-upload')?.click()} disabled={uploadingLogo}>
                          {uploadingLogo ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
                          {uploadingLogo ? "Enviando..." : "Mudar Logo"}
                        </Button>
                        <p className="text-[10px] text-muted-foreground mt-1">PNG, JPG até 2MB</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Link Personalizado da Agenda (URL)
                      </Label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs opacity-40 font-mono">
                            agendar.online/
                          </span>
                          <Input 
                            {...form.register("slug")} 
                            className="pl-[105px] font-mono text-sm input-dark h-11" 
                            placeholder="minha-loja"
                          />
                        </div>
                      </div>
                      {form.formState.errors.slug && <p className="text-destructive text-[10px] font-medium">{form.formState.errors.slug.message}</p>}
                      <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-2xl flex gap-3">
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-amber-200/70 leading-relaxed font-medium">
                          <strong className="text-amber-500">Cuidado:</strong> Ao mudar este link, qualquer QR Code ou link compartilhado anteriormente deixará de funcionar imediatamente.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="nome">Nome da Empresa *</Label>
                        <Input id="nome" {...form.register("nome")} placeholder="Nome do seu negócio" className="input-dark h-11" />
                        {form.formState.errors.nome && <p className="text-destructive text-xs">{form.formState.errors.nome.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cnpj">CNPJ</Label>
                        <Input id="cnpj" {...form.register("cnpj")} placeholder="00.000.000/0000-00" className="input-dark h-11" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endereco">Endereço</Label>
                    <Textarea id="endereco" {...form.register("endereco")} placeholder="Endereço completo" className="input-dark min-h-[60px]" />
                  </div>
                </CardContent>
              </Card>

              <Card className="panel">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base"><Phone className="h-5 w-5 text-primary" />Contato</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="telefone">Telefone</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="telefone" {...form.register("telefone")} placeholder="(11) 99999-9999" className="input-dark pl-10" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="whatsapp">WhatsApp</Label>
                      <div className="relative">
                        <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="whatsapp" {...form.register("whatsapp")} placeholder="(11) 99999-9999" className="input-dark pl-10" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="email" type="email" {...form.register("email")} placeholder="contato@empresa.com" className="input-dark pl-10" />
                    </div>
                    {form.formState.errors.email && <p className="text-destructive text-xs">{form.formState.errors.email.message}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="instagram">Instagram</Label>
                      <div className="relative">
                        <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="instagram" {...form.register("instagram")} placeholder="@seuinsta" className="input-dark pl-10" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="facebook">Facebook</Label>
                      <div className="relative">
                        <Facebook className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="facebook" {...form.register("facebook")} placeholder="fb.com/loja" className="input-dark pl-10" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Aparência da Agenda (Banner e Tema) */}
              <Card className="panel border-primary/20 bg-primary/5 lg:col-span-2">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Palette className="h-5 w-5 text-primary" />
                      Aparência da Agenda Online (Capa e Tema)
                    </CardTitle>
                    <div className="flex items-center gap-2 bg-black/20 p-1 rounded-lg border border-white/5">
                      <Button 
                        type="button" 
                        variant={temaPublico === "light" ? "default" : "ghost"} 
                        size="sm" 
                        className={`h-7 px-3 rounded-md text-[10px] uppercase font-bold tracking-wider transition-all ${temaPublico === "light" ? "bg-white text-black hover:bg-white/90" : "text-muted-foreground hover:text-white"}`}
                        onClick={() => setTemaPublico("light")}
                      >
                        <Sun className="h-3 w-3 mr-1" /> Modo Claro
                      </Button>
                      <Button 
                        type="button" 
                        variant={temaPublico === "dark" ? "default" : "ghost"} 
                        size="sm" 
                        className={`h-7 px-3 rounded-md text-[10px] uppercase font-bold tracking-wider transition-all ${temaPublico === "dark" ? "bg-primary text-white hover:bg-primary/90" : "text-muted-foreground hover:text-white"}`}
                        onClick={() => setTemaPublico("dark")}
                      >
                        <Moon className="h-3 w-3 mr-1" /> Modo Escuro
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="text-xs">Banner / Capa da Agenda</Label>
                    <div className="relative aspect-[21/9] w-full rounded-xl overflow-hidden border border-white/10 group bg-black/20">
                      {capaUrl ? (
                        <>
                          <img src={capaUrl} alt="Banner" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer" onClick={() => document.getElementById('capa-upload')?.click()}>
                            <Upload className="h-5 w-5 text-white" />
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 cursor-pointer border border-dashed border-white/10 hover:bg-white/5 transition-colors" onClick={() => document.getElementById('capa-upload')?.click()}>
                          <Image className="h-8 w-8 text-muted-foreground/50" />
                          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Sem Capa</span>
                        </div>
                      )}
                      <input id="capa-upload" type="file" accept="image/*" className="hidden" onChange={handleCapaUpload} disabled={uploadingCapa} />
                    </div>
                    <Button type="button" variant="outline" size="sm" className="w-full h-8 text-[11px] uppercase tracking-wider font-bold" onClick={() => document.getElementById('capa-upload')?.click()} disabled={uploadingCapa}>
                      {uploadingCapa ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <Upload className="h-3 w-3 mr-2" />}
                      {capaUrl ? "Alterar Capa da Agenda" : "Subir Capa da Agenda"}
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-black/20 border border-white/5 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${temaPublico === "light" ? "bg-white text-black" : "bg-primary/20 text-primary"}`}>
                          {temaPublico === "light" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold">Tema da Agenda: {temaPublico === "light" ? "Claro" : "Escuro"}</h4>
                          <p className="text-[11px] text-muted-foreground">Isso não afeta o painel administrativo, apenas o link que seus clientes acessam.</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div className={`p-3 rounded-lg border flex flex-col gap-2 ${temaPublico === "light" ? "border-white bg-white/10" : "border-white/5 bg-transparent opacity-40 hover:opacity-100 transition-opacity cursor-pointer"}`} onClick={() => setTemaPublico("light")}>
                          <div className="h-3 w-3/4 rounded bg-slate-200" />
                          <div className="h-10 w-full rounded bg-slate-100" />
                          <span className="text-[9px] font-bold text-center text-slate-400">MODO CLARO</span>
                        </div>
                        <div className={`p-3 rounded-lg border flex flex-col gap-2 ${temaPublico === "dark" ? "border-primary/50 bg-primary/10" : "border-white/5 bg-transparent opacity-40 hover:opacity-100 transition-opacity cursor-pointer"}`} onClick={() => setTemaPublico("dark")}>
                          <div className="h-3 w-3/4 rounded bg-white/10" />
                          <div className="h-10 w-full rounded bg-white/5" />
                          <span className="text-[9px] font-bold text-center text-primary/50">MODO ESCURO</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={saving} className="btn-wine h-12 px-8 text-base font-bold shadow-xl shadow-primary/20">
                {saving ? <Loader2 className="h-5 w-5 mr-1 animate-spin" /> : <Save className="h-5 w-5 mr-2" />}
                {saving ? "Salvando..." : "Salvar Configurações"}
              </Button>
            </div>
          </form>
        </TabsContent>

        {/* Tab: Horários */}
        <TabsContent value="horarios">
          <Card className="panel">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-5 w-5 text-primary" />Horários de Funcionamento
                </CardTitle>
                <Select value={selectedUnidadeHorario || selectedUnidadeId || ""} onValueChange={setSelectedUnidadeHorario}>
                  <SelectTrigger className="w-[200px] input-dark">
                    <SelectValue placeholder="Selecione a unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {unidades.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {horarios.map((h) => {
                  const dia = DIAS_SEMANA.find((d) => d.value === h.dia_semana);
                  return (
                    <div key={h.dia_semana} className="flex items-center gap-4 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                      <div className="w-32 flex items-center gap-3">
                        <Switch checked={h.aberto} onCheckedChange={(checked) => updateHorario(h.dia_semana, "aberto", checked)} />
                        <span className={`text-sm font-medium ${h.aberto ? "text-foreground" : "text-muted-foreground"}`}>{dia?.label}</span>
                      </div>
                      {h.aberto ? (
                        <div className="flex items-center gap-2">
                          <Input type="time" value={h.horario_abertura} onChange={(e) => updateHorario(h.dia_semana, "horario_abertura", e.target.value)} className="input-dark w-28" />
                          <span className="text-muted-foreground">às</span>
                          <Input type="time" value={h.horario_fechamento} onChange={(e) => updateHorario(h.dia_semana, "horario_fechamento", e.target.value)} className="input-dark w-28" />
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Fechado</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end mt-6">
                <Button onClick={handleSaveHorarios} disabled={savingHorarios} className="btn-wine">
                  {savingHorarios ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : <><Save className="h-4 w-4 mr-2" />Salvar Horários</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Emails */}
        <TabsContent value="emails">
          <EmailConfigSection />
        </TabsContent>

        {/* Tab: Sistema */}
        <TabsContent value="sistema" className="space-y-6">
          {/* Tipo de Negócio */}
          <Card className="panel">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-5 w-5 text-primary" />Tipo de Negócio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Label>Segmento do estabelecimento</Label>
                <Select value={selectedTipo} onValueChange={setSelectedTipo}>
                  <SelectTrigger className="input-dark w-full max-w-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_ESTABELECIMENTO.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.icon} {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Alterar o tipo muda as terminologias do sistema (ex: "Barbeiros" → "Dentistas")</p>
              </div>
            </CardContent>
          </Card>

          {/* Agendamento Online */}
          <Card className="panel">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-5 w-5 text-primary" />Agendamento Online
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Permitir escolha do profissional</p>
                  <p className="text-xs text-muted-foreground">Clientes podem selecionar o profissional ao agendar online</p>
                </div>
                <Switch
                  checked={permitirEscolhaProfissional}
                  onCheckedChange={async (checked) => {
                    setPermitirEscolhaProfissional(checked);
                     if (configId) {
                      await supabase.from("empresas").update({ permitir_escolha_profissional: checked }).eq("id", configId);
                      toast.success(checked ? "Escolha de profissional ativada" : "Escolha de profissional desativada");
                    }
                  }}
                />
              </div>
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                <p className="text-xs text-muted-foreground">
                  Link para agendamento: <span className="font-mono text-primary select-all">{window.location.origin}/agendar</span>
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="panel">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Palette className="h-5 w-5 text-primary" />Cores do Tema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Label>Paletas pré-definidas</Label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                  {THEME_PALETTES.map((palette) => (
                    <button
                      key={palette.name}
                      onClick={() => {
                        setSelectedCorPrimaria(palette.primary);
                        setSelectedCorNome(palette.name);
                        setIsCustomTheme(false);
                        applyThemeColors(palette.primary);
                      }}
                      className={`p-3 rounded-xl border text-center transition-all hover:scale-[1.02] ${
                        selectedCorNome === palette.name && !isCustomTheme
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-white/[0.06] hover:border-white/[0.12]"
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full mx-auto mb-1.5 ring-2 ring-white/10" style={{ backgroundColor: palette.preview }} />
                      <span className="text-[10px] font-medium text-muted-foreground">{palette.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <input
                  type="color"
                  value={customHex}
                  onChange={(e) => {
                    setCustomHex(e.target.value);
                    const hsl = hexToHSL(e.target.value);
                    setSelectedCorPrimaria(hsl);
                    setSelectedCorNome("Personalizada");
                    setIsCustomTheme(true);
                    applyThemeColors(hsl);
                  }}
                  className="w-10 h-10 rounded-lg cursor-pointer border-none bg-transparent"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">Cor personalizada</p>
                  <p className="text-xs text-muted-foreground">Ajustada automaticamente para o tema escuro</p>
                </div>
                {isCustomTheme && (
                  <span className="ml-auto text-xs px-2 py-1 rounded-full bg-primary/20 text-primary">Selecionada</span>
                )}
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveTheme} disabled={savingTheme} className="btn-wine">
                  {savingTheme ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : <><Sparkles className="h-4 w-4 mr-2" />Salvar Tema</>}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="panel border-destructive/30">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base text-destructive">
                <AlertTriangle className="h-5 w-5" />Zona de Perigo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Redefinir Sistema</p>
                  <p className="text-xs text-muted-foreground">Apaga todos os dados: clientes, profissionais, logo, horários, agendamentos e comandas.</p>
                </div>
                <Button variant="destructive" onClick={() => setShowResetDialog(true)}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Redefinir
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent className="bg-card border border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Redefinir Sistema do Zero
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>Esta ação é <strong className="text-destructive">irreversível</strong> e irá apagar:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Todos os clientes cadastrados</li>
                <li>Todos os profissionais</li>
                <li>Todos os agendamentos e comandas</li>
                <li>Logo e configurações da empresa</li>
                <li>Horários de funcionamento</li>
                <li>Unidades cadastradas</li>
                <li>Campanhas, cupons e programa de fidelidade</li>
              </ul>
              <p className="pt-2">Para confirmar, digite <strong className="text-foreground">REDEFINIR</strong> abaixo:</p>
              <Input
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder="Digite REDEFINIR"
                className="input-dark"
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="btn-soft" onClick={() => setResetConfirmText("")}>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={resetConfirmText !== "REDEFINIR" || resetting}
              onClick={handleResetSystem}
            >
              {resetting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Redefinindo...</> : <><RotateCcw className="h-4 w-4 mr-2" />Confirmar Redefinição</>}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
