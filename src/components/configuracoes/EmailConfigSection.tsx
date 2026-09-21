import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Save, Loader2, Eye, Bell, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { hslToHex } from "@/lib/theme-palettes";

interface EmailTemplate {
  id: string;
  tipo: string;
  assunto: string;
  corpo_html: string;
  ativo: boolean;
  horas_antes: number | null;
}

export default function EmailConfigSection() {
  const { config } = useEmpresa();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
    try {
      const { data, error } = await supabase
        .from("email_config")
        .select("*")
        .order("tipo");
      if (error) throw error;
      setTemplates((data as any) || []);
    } catch (error) {
      toast.error("Erro ao carregar templates de email");
    } finally {
      setLoading(false);
    }
  }

  function updateTemplate(tipo: string, field: keyof EmailTemplate, value: any) {
    setTemplates((prev) =>
      prev.map((t) => (t.tipo === tipo ? { ...t, [field]: value } : t))
    );
  }

  async function handleSave(template: EmailTemplate) {
    setSaving(template.tipo);
    try {
      const { error } = await supabase
        .from("email_config")
        .update({
          assunto: template.assunto,
          corpo_html: template.corpo_html,
          ativo: template.ativo,
          horas_antes: template.horas_antes,
        } as any)
        .eq("id", template.id);
      if (error) throw error;
      toast.success("Template salvo com sucesso!");
    } catch (error) {
      toast.error("Erro ao salvar template");
    } finally {
      setSaving(null);
    }
  }

  function renderPreview(html: string) {
    const corHex = hslToHex(config.cor_primaria);
    const replaced = html
      .replace(/\{\{nome_empresa\}\}/g, config.nome)
      .replace(/\{\{cor_primaria\}\}/g, corHex)
      .replace(/\{\{logo_url\}\}/g, config.logo_url || "")
      .replace(/\{\{link_acesso\}\}/g, "#")
      .replace(/\{\{nome_cliente\}\}/g, "João Silva")
      .replace(/\{\{data_agendamento\}\}/g, "15/03/2026")
      .replace(/\{\{horario_agendamento\}\}/g, "14:30")
      .replace(/\{\{servico\}\}/g, "Corte de Cabelo")
      .replace(/\{\{profissional\}\}/g, "Carlos");
    return replaced;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const conviteTemplate = templates.find((t) => t.tipo === "convite_usuario");
  const lembreteTemplate = templates.find((t) => t.tipo === "lembrete_agendamento");

  return (
    <div className="space-y-6">
      <Tabs defaultValue="convite" className="space-y-4">
        <TabsList className="bg-secondary/30">
          <TabsTrigger value="convite" className="gap-2">
            <UserPlus className="h-4 w-4" />
            Convite de Usuário
          </TabsTrigger>
          <TabsTrigger value="lembrete" className="gap-2">
            <Bell className="h-4 w-4" />
            Lembrete de Agendamento
          </TabsTrigger>
        </TabsList>

        {/* Convite Template */}
        <TabsContent value="convite">
          {conviteTemplate && (
            <TemplateEditor
              template={conviteTemplate}
              onChange={updateTemplate}
              onSave={handleSave}
              saving={saving === conviteTemplate.tipo}
              previewOpen={previewType === conviteTemplate.tipo}
              onTogglePreview={() =>
                setPreviewType(previewType === conviteTemplate.tipo ? null : conviteTemplate.tipo)
              }
              renderPreview={renderPreview}
              description="Email enviado quando um novo usuário é convidado para o sistema."
              variables={[
                { key: "{{nome_empresa}}", desc: "Nome da empresa" },
                { key: "{{cor_primaria}}", desc: "Cor primária do tema (HEX)" },
                { key: "{{logo_url}}", desc: "URL do logo da empresa" },
                { key: "{{link_acesso}}", desc: "Link para definir senha" },
              ]}
            />
          )}
        </TabsContent>




        {/* Lembrete Template */}
        <TabsContent value="lembrete">
          {lembreteTemplate && (
            <TemplateEditor
              template={lembreteTemplate}
              onChange={updateTemplate}
              onSave={handleSave}
              saving={saving === lembreteTemplate.tipo}
              previewOpen={previewType === lembreteTemplate.tipo}
              onTogglePreview={() =>
                setPreviewType(previewType === lembreteTemplate.tipo ? null : lembreteTemplate.tipo)
              }
              renderPreview={renderPreview}
              description="Email enviado automaticamente antes do horário agendado."
              showHorasAntes
              variables={[
                { key: "{{nome_empresa}}", desc: "Nome da empresa" },
                { key: "{{cor_primaria}}", desc: "Cor primária (HEX)" },
                { key: "{{logo_url}}", desc: "URL do logo da empresa" },
                { key: "{{nome_cliente}}", desc: "Nome do cliente" },
                { key: "{{data_agendamento}}", desc: "Data do agendamento" },
                { key: "{{horario_agendamento}}", desc: "Horário" },
                { key: "{{servico}}", desc: "Nome do serviço" },
                { key: "{{profissional}}", desc: "Nome do profissional" },
              ]}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface TemplateEditorProps {
  template: EmailTemplate;
  onChange: (tipo: string, field: keyof EmailTemplate, value: any) => void;
  onSave: (template: EmailTemplate) => void;
  saving: boolean;
  previewOpen: boolean;
  onTogglePreview: () => void;
  renderPreview: (html: string) => string;
  description: string;
  showHorasAntes?: boolean;
  variables: { key: string; desc: string }[];
}

function TemplateEditor({
  template,
  onChange,
  onSave,
  saving,
  previewOpen,
  onTogglePreview,
  renderPreview,
  description,
  showHorasAntes,
  variables,
}: TemplateEditorProps) {
  return (
    <div className="space-y-4">
      <Card className="panel">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-5 w-5 text-primary" />
                {template.tipo === "convite_usuario" ? "Email de Convite" : template.tipo === "convite_cliente" ? "Email de Boas-vindas" : "Email de Lembrete"}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Ativo</Label>
                <Switch
                  checked={template.ativo}
                  onCheckedChange={(v) => onChange(template.tipo, "ativo", v)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showHorasAntes && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
              <Bell className="h-4 w-4 text-primary flex-shrink-0" />
              <Label className="text-sm">Enviar</Label>
              <Input
                type="number"
                min={1}
                max={72}
                value={template.horas_antes || 24}
                onChange={(e) => onChange(template.tipo, "horas_antes", parseInt(e.target.value) || 24)}
                className="input-dark w-20"
              />
              <span className="text-sm text-muted-foreground">horas antes do agendamento</span>
            </div>
          )}

          <div className="space-y-2">
            <Label>Assunto do Email</Label>
            <Input
              value={template.assunto}
              onChange={(e) => onChange(template.tipo, "assunto", e.target.value)}
              className="input-dark"
              placeholder="Assunto do email..."
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Corpo do Email (HTML)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onTogglePreview}
                className="btn-soft gap-1.5"
              >
                <Eye className="h-3.5 w-3.5" />
                {previewOpen ? "Editar" : "Pré-visualizar"}
              </Button>
            </div>

            {previewOpen ? (
              <div className="border border-border rounded-lg p-4 bg-white min-h-[300px]">
                <div
                  dangerouslySetInnerHTML={{
                    __html: renderPreview(template.corpo_html),
                  }}
                />
              </div>
            ) : (
              <Textarea
                value={template.corpo_html}
                onChange={(e) => onChange(template.tipo, "corpo_html", e.target.value)}
                className="input-dark min-h-[300px] font-mono text-xs"
                placeholder="HTML do email..."
              />
            )}
          </div>

          {/* Variables reference */}
          <div className="p-3 rounded-lg bg-secondary/30 border border-border">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Variáveis disponíveis:</p>
            <div className="flex flex-wrap gap-2">
              {variables.map((v) => (
                <span
                  key={v.key}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-primary/10 text-primary font-mono cursor-help"
                  title={v.desc}
                >
                  {v.key}
                </span>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => onSave(template)} disabled={saving} className="btn-wine">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Template
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
