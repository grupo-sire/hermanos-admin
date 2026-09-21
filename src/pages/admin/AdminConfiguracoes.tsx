import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useForm } from "react-hook-form";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Building2, Save, Loader2, Upload, Image, Palette, Sparkles, Calendar, Globe,
} from "lucide-react";
import { toast } from "sonner";
import { useEmpresa } from "@/contexts/EmpresaContext";
import ComissionamentoConfigSection from "@/components/configuracoes/ComissionamentoConfigSection";
import { THEME_PALETTES, applyThemeColors, hexToHSL } from "@/lib/theme-palettes";
import { TIPOS_ESTABELECIMENTO } from "@/lib/estabelecimento-labels";

interface ConfigForm {
  nome: string;
  cnpj: string;
  telefone: string;
  email: string;
  endereco: string;
  instagram: string;
  facebook: string;
  whatsapp: string;
}

export default function AdminConfiguracoes() {
  const { empresaId, config: empresaConfig, refresh: refreshEmpresa } = useEmpresa();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [selectedCorPrimaria, setSelectedCorPrimaria] = useState("350 65% 33%");
  const [selectedCorNome, setSelectedCorNome] = useState("Vinho");
  const [customHex, setCustomHex] = useState("#8B1A3A");
  const [isCustomTheme, setIsCustomTheme] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  const [selectedTipo, setSelectedTipo] = useState("barbearia");
  const [permitirEscolha, setPermitirEscolha] = useState(true);
  const [siteUrl, setSiteUrl] = useState("");
  const [savingSiteUrl, setSavingSiteUrl] = useState(false);

  const { register, handleSubmit, reset } = useForm<ConfigForm>({
    defaultValues: { nome: "", cnpj: "", telefone: "", email: "", endereco: "", instagram: "", facebook: "", whatsapp: "" },
  });

  // If super admin has no empresa, show global settings
  // If super admin has empresa, show that empresa's config
  const targetId = empresaId;

  useEffect(() => {
    if (targetId) fetchConfig();
    else setLoading(false);
  }, [targetId]);

  async function fetchConfig() {
    setLoading(true);
    try {
      const { data } = await supabase.from("empresas").select("*").eq("id", targetId!).single();
      if (data) {
        setLogoUrl(data.logo_url);
        setSelectedCorPrimaria(data.cor_primaria || "350 65% 33%");
        setSelectedCorNome(data.cor_nome || "Vinho");
        setSelectedTipo(data.tipo_estabelecimento || "barbearia");
        setPermitirEscolha(data.permitir_escolha_profissional ?? true);
        reset({
          nome: data.nome || "", cnpj: data.cnpj || "", telefone: data.telefone || "",
          email: data.email || "", endereco: data.endereco || "",
          instagram: data.instagram || "", facebook: data.facebook || "", whatsapp: data.whatsapp || "",
        });
      }
    } catch { toast.error("Erro ao carregar configurações"); }
    finally { setLoading(false); }
  }

  async function onSubmit(values: ConfigForm) {
    if (!targetId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("empresas").update({
        nome: values.nome, cnpj: values.cnpj || null, telefone: values.telefone || null,
        email: values.email || null, endereco: values.endereco || null,
        instagram: values.instagram || null, facebook: values.facebook || null, whatsapp: values.whatsapp || null,
      }).eq("id", targetId);
      if (error) throw error;
      await refreshEmpresa();
      toast.success("Configurações salvas!");
    } catch { toast.error("Erro ao salvar"); }
    finally { setSaving(false); }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/") || !targetId) return;
    setUploadingLogo(true);
    try {
      const fileName = `logo-${targetId}-${Date.now()}.${file.name.split(".").pop()}`;
      const { error: upErr } = await supabase.storage.from("logos").upload(fileName, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("logos").getPublicUrl(fileName);
      await supabase.from("empresas").update({ logo_url: urlData.publicUrl }).eq("id", targetId);
      setLogoUrl(urlData.publicUrl);
      await refreshEmpresa();
      toast.success("Logo atualizada!");
    } catch (err: any) { toast.error(err.message || "Erro ao enviar logo"); }
    finally { setUploadingLogo(false); }
  }

  async function handleSaveTheme() {
    if (!targetId) return;
    setSavingTheme(true);
    try {
      const { error } = await supabase.from("empresas").update({
        cor_primaria: selectedCorPrimaria, cor_nome: selectedCorNome, tipo_estabelecimento: selectedTipo,
      }).eq("id", targetId);
      if (error) throw error;
      applyThemeColors(selectedCorPrimaria);
      await refreshEmpresa();
      toast.success("Tema atualizado!");
    } catch { toast.error("Erro ao salvar tema"); }
    finally { setSavingTheme(false); }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!targetId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Configurações" description="Configurações gerais do painel administrativo" />
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Você é um super admin sem empresa vinculada.</p>
            <p className="text-sm mt-1">As configurações de cada empresa podem ser acessadas pela página de Empresas.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" description="Configure o perfil e aparência da sua empresa" />

      <Tabs defaultValue="empresa" className="space-y-6">
        <TabsList>
          <TabsTrigger value="empresa">Empresa</TabsTrigger>
          <TabsTrigger value="comissao">Comissionamento & Campanhas</TabsTrigger>
          <TabsTrigger value="sistema">Sistema & Tema</TabsTrigger>
        </TabsList>

        <TabsContent value="comissao">
          <ComissionamentoConfigSection />
        </TabsContent>

        {/* Tab: Empresa */}
        <TabsContent value="empresa">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building2 className="h-5 w-5 text-primary" />Dados da Empresa
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs">Logo</Label>
                    <div className="flex items-center gap-4 mt-1">
                      {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="w-14 h-14 rounded-lg object-cover border border-border" />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-secondary flex items-center justify-center border border-border">
                          <Image className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <label className="cursor-pointer">
                        <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
                        <Button type="button" variant="outline" size="sm" asChild disabled={uploadingLogo}>
                          <span>{uploadingLogo ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}{uploadingLogo ? "Enviando..." : "Enviar Logo"}</span>
                        </Button>
                      </label>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Nome *</Label>
                      <Input {...register("nome", { required: true })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">CNPJ</Label>
                      <Input {...register("cnpj")} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Telefone</Label>
                      <Input {...register("telefone")} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Email</Label>
                      <Input {...register("email")} type="email" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">WhatsApp</Label>
                      <Input {...register("whatsapp")} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Instagram</Label>
                      <Input {...register("instagram")} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Endereço</Label>
                    <Textarea {...register("endereco")} className="min-h-[60px]" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Calendar className="h-5 w-5 text-primary" />Tipo & Agendamento
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Segmento do estabelecimento</Label>
                    <Select value={selectedTipo} onValueChange={setSelectedTipo}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIPOS_ESTABELECIMENTO.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">Alterar o tipo muda as terminologias do sistema</p>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div>
                      <p className="text-sm font-medium">Permitir escolha do profissional</p>
                      <p className="text-xs text-muted-foreground">No agendamento online</p>
                    </div>
                    <Switch
                      checked={permitirEscolha}
                      onCheckedChange={async (checked) => {
                        setPermitirEscolha(checked);
                        await supabase.from("empresas").update({ permitir_escolha_profissional: checked }).eq("id", targetId);
                        toast.success(checked ? "Ativada" : "Desativada");
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar Configurações
              </Button>
            </div>
          </form>
        </TabsContent>

        {/* Tab: Sistema & Tema */}
        <TabsContent value="sistema" className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Palette className="h-5 w-5 text-primary" />Cores do Tema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full mx-auto mb-1.5 ring-2 ring-border" style={{ backgroundColor: palette.preview }} />
                    <span className="text-[10px] font-medium text-muted-foreground">{palette.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-4 p-4 rounded-xl border border-border">
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
                  <p className="text-sm font-medium">Cor personalizada</p>
                  <p className="text-xs text-muted-foreground">Ajustada automaticamente para o tema</p>
                </div>
                {isCustomTheme && (
                  <span className="ml-auto text-xs px-2 py-1 rounded-full bg-primary/20 text-primary">Selecionada</span>
                )}
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveTheme} disabled={savingTheme}>
                  {savingTheme ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  Salvar Tema
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
