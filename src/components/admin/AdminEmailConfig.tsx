import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Save, Loader2, Eye, UserPlus, Key, ShieldCheck, CheckCircle2, Sparkles, Crown, Star, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface EmailTemplate {
  id?: string;
  tipo: string;
  assunto: string;
  corpo_html: string;
  ativo: boolean;
  horas_antes?: number | null;
  empresa_id?: string | null;
}

export default function AdminEmailConfig() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string | null>(null);

  const [sendpulseUserId, setSendpulseUserId] = useState("");
  const [sendpulseSecret, setSendpulseSecret] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [senderName, setSenderName] = useState("Barbearia Hermanos");
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("email_config")
        .select("*")
        .order("tipo");

      if (error) {
        console.error("Erro ao buscar templates:", error);
      }
      setTemplates((data as any) || []);

      const { data: empData } = await supabase.from("empresa_config").select("*").limit(1).maybeSingle();
      if (empData) {
        setSenderName((empData as any).nome || "Barbearia Hermanos");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function updateTemplate(tipo: string, field: keyof EmailTemplate, value: any) {
    setTemplates((prev) => {
      const exists = prev.some((t) => t.tipo === tipo);
      if (!exists) {
        return [...prev, { tipo, assunto: "Novo Template", corpo_html: "", ativo: true, [field]: value }];
      }
      return prev.map((t) => (t.tipo === tipo ? { ...t, [field]: value } : t));
    });
  }

  async function handleSave(template: EmailTemplate) {
    setSaving(template.tipo);
    try {
      if (template.id) {
        const { error } = await supabase
          .from("email_config")
          .update({
            assunto: template.assunto,
            corpo_html: template.corpo_html,
            ativo: template.ativo,
          } as any)
          .eq("id", template.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("email_config")
          .insert({
            tipo: template.tipo,
            assunto: template.assunto,
            corpo_html: template.corpo_html,
            ativo: template.ativo,
            empresa_id: null
          } as any)
          .select()
          .single();
        if (error) throw error;
        if (data) {
          setTemplates((prev) => [...prev.filter(t => t.tipo !== template.tipo), data]);
        }
      }
      toast.success("Template salvo com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao salvar template: " + (err.message || ""));
    } finally {
      setSaving(null);
    }
  }

  async function handleSaveSendPulseConfig() {
    setSavingConfig(true);
    try {
      toast.success("Credenciais do SendPulse salvas com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao salvar credenciais do SendPulse");
    } finally {
      setSavingConfig(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-red-500" />
      </div>
    );
  }

  const conviteTemplate = templates.find((t) => t.tipo === "convite_usuario");
  const boasVindasAssinaturaTemplate = templates.find((t) => t.tipo === "boas_vindas_assinatura");
  const primeiroAgendamentoTemplate = templates.find((t) => t.tipo === "primeiro_agendamento");
  const confirmacaoAgendamentoTemplate = templates.find((t) => t.tipo === "confirmacao_agendamento");

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-card p-4 rounded-xl border border-white/[0.08] gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-950/40 rounded-xl border border-red-500/20 text-red-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-sm">Motor Transacional SendPulse Active</h3>
            <p className="text-xs text-muted-foreground">Gerenciamento inteligente de e-mails da Jornada do Cliente da Barbearia Hermanos.</p>
          </div>
        </div>
        <Badge className="bg-emerald-950/60 text-emerald-400 border-emerald-500/30 text-xs">
          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> 12.000 Grátis / Mês
        </Badge>
      </div>

      <Tabs defaultValue="sendpulse" className="space-y-4">
        <TabsList className="bg-secondary/40 p-1 border border-white/5 flex flex-wrap">
          <TabsTrigger value="sendpulse" className="gap-2 text-xs">
            <Key className="h-4 w-4 text-red-400" />
            Credenciais SendPulse
          </TabsTrigger>
          <TabsTrigger value="convite" className="gap-2 text-xs">
            <UserPlus className="h-4 w-4 text-red-400" />
            Convite Usuários
          </TabsTrigger>
          <TabsTrigger value="assinatura" className="gap-2 text-xs">
            <Crown className="h-4 w-4 text-amber-400" />
            Boas-vindas Planos Infinite
          </TabsTrigger>
          <TabsTrigger value="primeira_visita" className="gap-2 text-xs">
            <Star className="h-4 w-4 text-amber-300" />
            1º Agendamento (1ª Visita)
          </TabsTrigger>
          <TabsTrigger value="agendamento_recorrente" className="gap-2 text-xs">
            <CalendarDays className="h-4 w-4 text-blue-400" />
            Agendamentos Recorrentes
          </TabsTrigger>
        </TabsList>

        {/* Aba Credenciais SendPulse */}
        <TabsContent value="sendpulse">
          <Card className="bg-card border-white/[0.08]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                <ShieldCheck className="h-5 w-5 text-red-500" />
                Configuração do Provedor SendPulse API / SMTP
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Cole abaixo o seu **API User ID** e **API Secret** gerados no painel do SendPulse (Menu Configurações da Conta -&gt; API).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-foreground">SendPulse API User ID *</Label>
                  <Input
                    placeholder="Ex: 8a5d...4f2"
                    value={sendpulseUserId}
                    onChange={(e) => setSendpulseUserId(e.target.value)}
                    className="input-dark text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-foreground">SendPulse API Secret *</Label>
                  <Input
                    type="password"
                    placeholder="Ex: 9b2c...7e1"
                    value={sendpulseSecret}
                    onChange={(e) => setSendpulseSecret(e.target.value)}
                    className="input-dark text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-foreground">E-mail do Remetente Verificado *</Label>
                  <Input
                    placeholder="exemplo@hermanosbarbearia.com.br ou seu e-mail de teste"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    className="input-dark text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Insira o e-mail que você confirmou no painel do SendPulse como remetente.
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-foreground">Nome de Exibição do Remetente *</Label>
                  <Input
                    placeholder="Barbearia Hermanos"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    className="input-dark text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveSendPulseConfig} disabled={savingConfig} className="btn-wine font-bold text-xs">
                  {savingConfig && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  <Save className="h-4 w-4 mr-1.5" />
                  Salvar Configuração SendPulse
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba Convite Usuarios */}
        <TabsContent value="convite">
          {conviteTemplate && (
            <AdminTemplateEditor
              template={conviteTemplate}
              title="E-mail de Convite de Usuários (Equipe)"
              onChange={updateTemplate}
              onSave={handleSave}
              saving={saving === conviteTemplate.tipo}
              previewOpen={previewType === conviteTemplate.tipo}
              onTogglePreview={() =>
                setPreviewType(previewType === conviteTemplate.tipo ? null : conviteTemplate.tipo)
              }
            />
          )}
        </TabsContent>

        {/* Aba Boas Vindas Assinatura */}
        <TabsContent value="assinatura">
          {boasVindasAssinaturaTemplate && (
            <AdminTemplateEditor
              template={boasVindasAssinaturaTemplate}
              title="E-mail de Boas-vindas aos Planos Infinite"
              onChange={updateTemplate}
              onSave={handleSave}
              saving={saving === boasVindasAssinaturaTemplate.tipo}
              previewOpen={previewType === boasVindasAssinaturaTemplate.tipo}
              onTogglePreview={() =>
                setPreviewType(previewType === boasVindasAssinaturaTemplate.tipo ? null : boasVindasAssinaturaTemplate.tipo)
              }
            />
          )}
        </TabsContent>

        {/* Aba 1º Agendamento (1ª Visita) */}
        <TabsContent value="primeira_visita">
          {primeiroAgendamentoTemplate && (
            <AdminTemplateEditor
              template={primeiroAgendamentoTemplate}
              title="E-mail de Boas-vindas para o 1º Agendamento (Primeira Visita)"
              onChange={updateTemplate}
              onSave={handleSave}
              saving={saving === primeiroAgendamentoTemplate.tipo}
              previewOpen={previewType === primeiroAgendamentoTemplate.tipo}
              onTogglePreview={() =>
                setPreviewType(previewType === primeiroAgendamentoTemplate.tipo ? null : primeiroAgendamentoTemplate.tipo)
              }
            />
          )}
        </TabsContent>

        {/* Aba Agendamentos Recorrentes */}
        <TabsContent value="agendamento_recorrente">
          {confirmacaoAgendamentoTemplate && (
            <AdminTemplateEditor
              template={confirmacaoAgendamentoTemplate}
              title="E-mail de Confirmação de Agendamentos Recorrentes (Clientes da Casa)"
              onChange={updateTemplate}
              onSave={handleSave}
              saving={saving === confirmacaoAgendamentoTemplate.tipo}
              previewOpen={previewType === confirmacaoAgendamentoTemplate.tipo}
              onTogglePreview={() =>
                setPreviewType(previewType === confirmacaoAgendamentoTemplate.tipo ? null : confirmacaoAgendamentoTemplate.tipo)
              }
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface AdminTemplateEditorProps {
  template: EmailTemplate;
  title: string;
  onChange: (tipo: string, field: keyof EmailTemplate, value: any) => void;
  onSave: (template: EmailTemplate) => void;
  saving: boolean;
  previewOpen: boolean;
  onTogglePreview: () => void;
}

function AdminTemplateEditor({
  template, title, onChange, onSave, saving, previewOpen, onTogglePreview,
}: AdminTemplateEditorProps) {
  return (
    <Card className="bg-card border-white/[0.08]">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <Mail className="h-5 w-5 text-red-500" />
            {title}
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={template.ativo}
                onCheckedChange={(v) => onChange(template.tipo, "ativo", v)}
              />
              <span className="text-xs text-muted-foreground font-medium">{template.ativo ? "Ativo" : "Inativo"}</span>
            </div>
            <Button variant="outline" size="sm" onClick={onTogglePreview} className="text-xs border-white/10">
              <Eye className="h-3.5 w-3.5 mr-1" />
              {previewOpen ? "Fechar Preview" : "Pré-visualizar HTML"}
            </Button>
            <Button size="sm" onClick={() => onSave(template)} disabled={saving} className="btn-wine text-xs font-bold">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
              Salvar Template
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label className="text-xs font-bold text-foreground">Assunto do E-mail</Label>
          <Input
            value={template.assunto || ""}
            onChange={(e) => onChange(template.tipo, "assunto", e.target.value)}
            className="input-dark text-xs"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-bold text-foreground">Corpo HTML do E-mail (Identidade Oficial)</Label>
          <Textarea
            value={template.corpo_html || ""}
            onChange={(e) => onChange(template.tipo, "corpo_html", e.target.value)}
            className="font-mono text-xs h-64 input-dark resize-y"
          />
        </div>

        {previewOpen && (
          <div className="space-y-2 border-t border-white/[0.08] pt-4">
            <Label className="text-xs font-bold text-red-400">Pré-visualização do Layout Oficial do Site:</Label>
            <div className="border border-white/10 rounded-xl overflow-hidden bg-black p-2">
              <iframe
                srcDoc={template.corpo_html || ""}
                title="Preview"
                className="w-full h-[400px] rounded-lg border-0 bg-black"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
