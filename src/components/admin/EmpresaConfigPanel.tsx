import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Building2, Phone, Mail, Instagram, Facebook, MessageCircle,
  Save, Loader2, Upload, Image, Palette, Sparkles, Calendar, ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { THEME_PALETTES, applyThemeColors, hexToHSL } from "@/lib/theme-palettes";
import { TIPOS_ESTABELECIMENTO } from "@/lib/estabelecimento-labels";

interface EmpresaConfigPanelProps {
  empresaId: string;
  empresaNome: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

export function EmpresaConfigPanel({ empresaId, empresaNome, open, onOpenChange }: EmpresaConfigPanelProps) {
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
  const [customTipo, setCustomTipo] = useState("");
  const [permitirEscolha, setPermitirEscolha] = useState(true);
  const [multiUnidades, setMultiUnidades] = useState(false);
  const [acessoLiberado, setAcessoLiberado] = useState(false);

  const { register, handleSubmit, reset } = useForm<ConfigForm>({
    defaultValues: { nome: "", cnpj: "", telefone: "", email: "", endereco: "", instagram: "", facebook: "", whatsapp: "" },
  });

  useEffect(() => {
    if (open && empresaId) fetchConfig();
  }, [open, empresaId]);

  async function fetchConfig() {
    setLoading(true);
    try {
      const { data } = await supabase.from("empresas").select("*").eq("id", empresaId).single();
      if (data) {
        setLogoUrl(data.logo_url);
        setSelectedCorPrimaria(data.cor_primaria || "350 65% 33%");
        setSelectedCorNome(data.cor_nome || "Vinho");
        const tipo = data.tipo_estabelecimento || "barbearia";
        setSelectedTipo(tipo);
        setCustomTipo(TIPOS_ESTABELECIMENTO.some(t => t.value === tipo) ? "" : tipo);
        setPermitirEscolha(data.permitir_escolha_profissional ?? true);
        setMultiUnidades(data.multi_unidades ?? false);
        setAcessoLiberado((data as any).acesso_liberado ?? false);
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
    setSaving(true);
    try {
      const { error } = await supabase.from("empresas").update({
        nome: values.nome, cnpj: values.cnpj || null, telefone: values.telefone || null,
        email: values.email || null, endereco: values.endereco || null,
        instagram: values.instagram || null, facebook: values.facebook || null, whatsapp: values.whatsapp || null,
      }).eq("id", empresaId);
      if (error) throw error;
      toast.success("Configurações salvas!");
    } catch { toast.error("Erro ao salvar"); }
    finally { setSaving(false); }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setUploadingLogo(true);
    try {
      const fileName = `logo-${empresaId}-${Date.now()}.${file.name.split(".").pop()}`;
      const { error: upErr } = await supabase.storage.from("logos").upload(fileName, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("logos").getPublicUrl(fileName);
      await supabase.from("empresas").update({ logo_url: urlData.publicUrl }).eq("id", empresaId);
      setLogoUrl(urlData.publicUrl);
      toast.success("Logo atualizada!");
    } catch (err: any) { toast.error(err.message || "Erro ao enviar logo"); }
    finally { setUploadingLogo(false); }
  }

  async function handleSaveTheme() {
    setSavingTheme(true);
    try {
      const { error } = await supabase.from("empresas").update({
        cor_primaria: selectedCorPrimaria, cor_nome: selectedCorNome, tipo_estabelecimento: selectedTipo,
      }).eq("id", empresaId);
      if (error) throw error;
      toast.success("Tema atualizado!");
    } catch { toast.error("Erro ao salvar tema"); }
    finally { setSavingTheme(false); }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto" side="right">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Configurações — {empresaNome}
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6 pb-8">
            {/* Logo & Dados */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Dados da Empresa</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-4">
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
                        <span>{uploadingLogo ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}{uploadingLogo ? "Enviando..." : "Logo"}</span>
                      </Button>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Nome *</Label>
                      <Input {...register("nome", { required: true })} className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">CNPJ</Label>
                      <Input {...register("cnpj")} className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Telefone</Label>
                      <Input {...register("telefone")} className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Email</Label>
                      <Input {...register("email")} type="email" className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">WhatsApp</Label>
                      <Input {...register("whatsapp")} className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Instagram</Label>
                      <Input {...register("instagram")} className="h-9 text-sm" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Endereço</Label>
                    <Textarea {...register("endereco")} className="text-sm min-h-[60px]" />
                  </div>
                  <Button type="submit" size="sm" disabled={saving}>
                    {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                    Salvar Dados
                  </Button>
                </CardContent>
              </Card>
            </form>

            {/* Tipo & Agendamento */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" />Tipo & Agendamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Segmento</Label>
                  <Select value={TIPOS_ESTABELECIMENTO.some(t => t.value === selectedTipo) ? selectedTipo : "__custom__"} onValueChange={(val) => { if (val !== "__custom__") { setSelectedTipo(val); setCustomTipo(""); } else { setSelectedTipo(customTipo || "outro"); } }}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPOS_ESTABELECIMENTO.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>
                      ))}
                      <SelectItem value="__custom__">✏️ Digitar manualmente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(!TIPOS_ESTABELECIMENTO.some(t => t.value === selectedTipo) || customTipo) && (
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo personalizado</Label>
                    <Input
                      value={customTipo || (TIPOS_ESTABELECIMENTO.some(t => t.value === selectedTipo) ? "" : selectedTipo)}
                      onChange={(e) => { setCustomTipo(e.target.value); setSelectedTipo(e.target.value); }}
                      placeholder="Ex: Academia, Consultório, Loja..."
                      className="h-9 text-sm"
                    />
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium">Permitir escolha do profissional</p>
                    <p className="text-[10px] text-muted-foreground">No agendamento online</p>
                  </div>
                  <Switch
                    checked={permitirEscolha}
                    onCheckedChange={async (checked) => {
                      setPermitirEscolha(checked);
                      await supabase.from("empresas").update({ permitir_escolha_profissional: checked }).eq("id", empresaId);
                      toast.success(checked ? "Ativada" : "Desativada");
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium">Múltiplas unidades</p>
                    <p className="text-[10px] text-muted-foreground">Habilita gestão de filiais/unidades</p>
                  </div>
                  <Switch
                    checked={multiUnidades}
                    onCheckedChange={async (checked) => {
                      setMultiUnidades(checked);
                      await supabase.from("empresas").update({ multi_unidades: checked }).eq("id", empresaId);
                      toast.success(checked ? "Multi-unidades ativado" : "Multi-unidades desativado");
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Acesso & Billing */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" />Acesso & Faturamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium">Acesso liberado (sem cobrança)</p>
                    <p className="text-[10px] text-muted-foreground">Libera acesso mesmo sem mensalidade ativa</p>
                  </div>
                  <Switch
                    checked={acessoLiberado}
                    onCheckedChange={async (checked) => {
                      setAcessoLiberado(checked);
                      await supabase.from("empresas").update({ acesso_liberado: checked } as any).eq("id", empresaId);
                      toast.success(checked ? "Acesso liberado" : "Acesso condicionado ao pagamento");
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Tema */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><Palette className="h-4 w-4 text-primary" />Cores do Tema</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {THEME_PALETTES.map((palette) => (
                    <button
                      key={palette.name}
                      onClick={() => { setSelectedCorPrimaria(palette.primary); setSelectedCorNome(palette.name); setIsCustomTheme(false); }}
                      className={`p-2 rounded-lg border text-center transition-all ${
                        selectedCorNome === palette.name && !isCustomTheme ? "border-primary ring-1 ring-primary/30" : "border-border hover:border-primary/30"
                      }`}
                    >
                      <div className="w-6 h-6 rounded-full mx-auto mb-1" style={{ backgroundColor: palette.preview }} />
                      <span className="text-[9px] text-muted-foreground">{palette.label}</span>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={customHex}
                    onChange={(e) => {
                      setCustomHex(e.target.value);
                      setSelectedCorPrimaria(hexToHSL(e.target.value));
                      setSelectedCorNome("Personalizada");
                      setIsCustomTheme(true);
                    }}
                    className="w-8 h-8 rounded cursor-pointer border-none bg-transparent"
                  />
                  <span className="text-xs text-muted-foreground">Cor personalizada</span>
                </div>
                <Button onClick={handleSaveTheme} size="sm" disabled={savingTheme}>
                  {savingTheme ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                  Salvar Tema
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
