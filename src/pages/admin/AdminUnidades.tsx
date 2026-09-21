import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Building2, MapPin, Clock, Calendar, Plus, Edit, Trash2, Loader2, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { toast } from "sonner";

interface DiaExpediente {
  dia: string;
  label: string;
  aberto: boolean;
  abertura: string;
  fechamento: string;
}

interface UnidadeAdmin {
  id: string;
  nome: string;
  endereco: string | null;
  telefone: string | null;
  horarios_semana?: Record<string, { aberto: boolean; abertura: string; fechamento: string }> | null;
  status: string;
}

interface Feriado {
  id: string;
  unidade_id: string | null;
  data: string;
  descricao: string;
  fechado: boolean;
  horario_abertura: string | null;
  horario_fechamento: string | null;
}

const DIAS_SEMANA_DEFAULT: DiaExpediente[] = [
  { dia: "segunda", label: "Segunda-feira", aberto: true, abertura: "09:00", fechamento: "20:00" },
  { dia: "terca", label: "Terça-feira", aberto: true, abertura: "09:00", fechamento: "20:00" },
  { dia: "quarta", label: "Quarta-feira", aberto: true, abertura: "09:00", fechamento: "20:00" },
  { dia: "quinta", label: "Quinta-feira", aberto: true, abertura: "09:00", fechamento: "20:00" },
  { dia: "sexta", label: "Sexta-feira", aberto: true, abertura: "09:00", fechamento: "20:00" },
  { dia: "sabado", label: "Sábado", aberto: true, abertura: "08:00", fechamento: "19:00" },
  { dia: "domingo", label: "Domingo", aberto: false, abertura: "09:00", fechamento: "14:00" },
];

export default function AdminUnidades() {
  const { empresaId } = useEmpresa();
  const defaultEmpresaId = empresaId || "93d24bc4-e371-4395-8ed8-636d02575de6";

  const [unidades, setUnidades] = useState<UnidadeAdmin[]>([]);
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [loading, setLoading] = useState(true);

  // Modais
  const [unidadeDialogOpen, setUnidadeDialogOpen] = useState(false);
  const [selectedUnidade, setSelectedUnidade] = useState<UnidadeAdmin | null>(null);
  const [nome, setNome] = useState("");
  const [endereco, setEndereco] = useState("");
  const [telefone, setTelefone] = useState("");
  const [expedienteSemana, setExpedienteSemana] = useState<DiaExpediente[]>(DIAS_SEMANA_DEFAULT);

  const [feriadoDialogOpen, setFeriadoDialogOpen] = useState(false);
  const [feriadoData, setFeriadoData] = useState("");
  const [feriadoDescricao, setFeriadoDescricao] = useState("");
  const [feriadoFechado, setFeriadoFechado] = useState(true);
  const [feriadoAbertura, setFeriadoAbertura] = useState("09:00");
  const [feriadoFechamento, setFeriadoFechamento] = useState("14:00");
  const [feriadoUnidadeId, setFeriadoUnidadeId] = useState<string>("todas");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [unidadesRes, feriadosRes] = await Promise.all([
        supabase.from("unidades").select("*").eq("empresa_id", defaultEmpresaId).order("nome"),
        supabase.from("horarios_feriados").select("*").order("data", { ascending: true }),
      ]);

      if (unidadesRes.error) throw unidadesRes.error;
      setUnidades(unidadesRes.data || []);
      setFeriados(feriadosRes.data || []);
    } catch (err: any) {
      console.error("Erro ao carregar unidades e feriados:", err);
      toast.error("Erro ao carregar dados de unidades.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenUnidadeModal = (u?: UnidadeAdmin) => {
    if (u) {
      setSelectedUnidade(u);
      setNome(u.nome);
      setEndereco(u.endereco || "");
      setTelefone(u.telefone || "");

      const savedExpedienteStr = localStorage.getItem(`hermanos_unidade_expediente_${u.id}`);
      const savedExpediente = savedExpedienteStr ? JSON.parse(savedExpedienteStr) : u.horarios_semana;

      setExpedienteSemana(
        DIAS_SEMANA_DEFAULT.map((d) => {
          const conf = savedExpediente?.[d.dia];
          if (conf) {
            return {
              ...d,
              aberto: conf.aberto ?? d.aberto,
              abertura: conf.abertura || d.abertura,
              fechamento: conf.fechamento || d.fechamento,
            };
          }
          return d;
        })
      );
    } else {
      setSelectedUnidade(null);
      setNome("");
      setEndereco("");
      setTelefone("");
      setExpedienteSemana(DIAS_SEMANA_DEFAULT);
    }
    setUnidadeDialogOpen(true);
  };

  const handleUpdateDiaExpediente = (index: number, field: keyof DiaExpediente, value: any) => {
    const updated = [...expedienteSemana];
    updated[index] = { ...updated[index], [field]: value };
    setExpedienteSemana(updated);
  };

  const handleSaveUnidade = async () => {
    if (!nome) {
      toast.error("O nome da unidade é obrigatório.");
      return;
    }

    setSaving(true);
    try {
      const horariosObject: Record<string, { aberto: boolean; abertura: string; fechamento: string }> = {};
      expedienteSemana.forEach((d) => {
        horariosObject[d.dia] = {
          aberto: d.aberto,
          abertura: d.abertura,
          fechamento: d.fechamento,
        };
      });

      const primeiroDiaAberto = expedienteSemana.find((d) => d.aberto) || expedienteSemana[0];
      const aberturaStr = primeiroDiaAberto ? `${primeiroDiaAberto.abertura}:00` : "09:00:00";
      const fechamentoStr = primeiroDiaAberto ? `${primeiroDiaAberto.fechamento}:00` : "20:00:00";

      const payload = {
        empresa_id: defaultEmpresaId,
        nome: nome.trim(),
        endereco: endereco.trim() || "Não informado",
        telefone: telefone.trim() || "",
        horario_abertura: aberturaStr,
        horario_fechamento: fechamentoStr,
        status: "active",
      };

      let targetId = selectedUnidade?.id;

      if (selectedUnidade) {
        const { error } = await supabase.from("unidades").update(payload).eq("id", selectedUnidade.id);
        if (error) throw error;
      } else {
        const { data: newU, error } = await supabase.from("unidades").insert([payload]).select("id").single();
        if (error) throw error;
        targetId = newU.id;
      }

      if (targetId) {
        localStorage.setItem(`hermanos_unidade_expediente_${targetId}`, JSON.stringify(horariosObject));
      }

      toast.success("Unidade e horários de funcionamento salvos com sucesso!");
      setUnidadeDialogOpen(false);
      fetchData();
    } catch (err: any) {
      console.error("Erro ao salvar unidade:", err);
      toast.error("Erro ao salvar unidade: " + (err.message || "Tente novamente"));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFeriado = async () => {
    if (!feriadoData || !feriadoDescricao) {
      toast.error("Informe a data e o nome do feriado/exceção.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        empresa_id: defaultEmpresaId,
        unidade_id: feriadoUnidadeId === "todas" ? null : feriadoUnidadeId,
        data: feriadoData,
        descricao: feriadoDescricao.trim(),
        fechado: feriadoFechado,
        horario_abertura: feriadoFechado ? null : feriadoAbertura,
        horario_fechamento: feriadoFechado ? null : feriadoFechamento,
      };

      const { error } = await supabase.from("horarios_feriados").insert([payload]);
      if (error) throw error;

      toast.success("Feriado / Exceção registrado! Refletido em todas as agendas.");
      setFeriadoDialogOpen(false);
      setFeriadoData("");
      setFeriadoDescricao("");
      fetchData();
    } catch (err: any) {
      toast.error("Erro ao registrar feriado: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFeriado = async (id: string) => {
    try {
      const { error } = await supabase.from("horarios_feriados").delete().eq("id", id);
      if (error) throw error;
      toast.success("Feriado removido!");
      fetchData();
    } catch (err: any) {
      toast.error("Erro ao remover feriado: " + err.message);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Gestão Mestre de Unidades & Horários"
        description="Cadastre as filiais da Barbearia Hermanos, endereços, quadro semanal dia a dia e exceções de calendário."
      />

      <Tabs defaultValue="unidades" className="space-y-6">
        <TabsList className="bg-secondary/40">
          <TabsTrigger value="unidades" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Filiais ({unidades.length})
          </TabsTrigger>
          <TabsTrigger value="feriados" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Feriados & Exceções ({feriados.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Filiais */}
        <TabsContent value="unidades" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Unidades Cadastradas</h3>
            <Button onClick={() => handleOpenUnidadeModal()} className="btn-wine">
              <Plus className="h-4 w-4 mr-2" /> Cadastrar Nova Filial
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {unidades.map((u) => (
                <Card key={u.id} className="bg-card border-white/[0.08] hover:border-primary/40 transition-all flex flex-col justify-between">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary" />
                        {u.nome}
                      </CardTitle>
                      <Badge className="bg-success/20 text-success border-success/30 text-[10px]">Ativa</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                      <span>{u.endereco || "Endereço não cadastrado"}</span>
                    </div>

                    <div className="pt-2 border-t border-white/[0.06] space-y-1">
                      <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3 text-amber-400" /> Expediente Semanal:
                      </span>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground pt-1">
                        {DIAS_SEMANA_DEFAULT.map((d) => {
                          const savedExpedienteStr = localStorage.getItem(`hermanos_unidade_expediente_${u.id}`);
                          const savedExpediente = savedExpedienteStr ? JSON.parse(savedExpedienteStr) : u.horarios_semana;
                          const conf = savedExpediente?.[d.dia];
                          const estaAberto = conf ? conf.aberto : d.aberto;
                          const ab = conf ? conf.abertura : d.abertura;
                          const fech = conf ? conf.fechamento : d.fechamento;

                          return (
                            <div key={d.dia} className="flex items-center justify-between">
                              <span>{d.label.split("-")[0]}:</span>
                              {estaAberto ? (
                                <span className="font-semibold text-foreground">{ab}-{fech}</span>
                              ) : (
                                <span className="text-destructive font-bold">Fechado</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center justify-end pt-3 border-t border-white/[0.06]">
                      <Button variant="ghost" size="sm" onClick={() => handleOpenUnidadeModal(u)} className="h-7 text-xs">
                        <Settings2 className="h-3.5 w-3.5 mr-1" /> Editar Horários & Dados
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Feriados */}
        <TabsContent value="feriados" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Exceções de Calendário & Feriados</h3>
              <p className="text-xs text-muted-foreground">Datas cadastradas aqui alteram/bloqueiam a agenda de clientes e filiais automaticamente.</p>
            </div>
            <Button onClick={() => setFeriadoDialogOpen(true)} className="btn-wine">
              <Plus className="h-4 w-4 mr-2" /> Adicionar Feriado / Exceção
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {feriados.map((f) => (
              <Card key={f.id} className="bg-card border-white/[0.08] flex items-center justify-between p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span>{f.descricao}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {new Date(f.data + "T00:00:00").toLocaleDateString()}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {f.fechado ? (
                      <span className="text-destructive font-semibold flex items-center gap-1">
                        🔴 Fechado o Dia Todo
                      </span>
                    ) : (
                      <span className="text-amber-400 font-semibold flex items-center gap-1">
                        🟡 Horário Especial: {f.horario_abertura} às {f.horario_fechamento}
                      </span>
                    )}
                    <span>• {f.unidade_id ? "Filial Específica" : "Todas as Unidades"}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                  onClick={() => handleDeleteFeriado(f.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal Editar/Criar Filial com Quadro de Horários por Dia */}
      <Dialog open={unidadeDialogOpen} onOpenChange={setUnidadeDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedUnidade ? "Configurar Unidade & Horários" : "Cadastrar Nova Filial"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold">Nome da Filial *</Label>
              <Input placeholder="Ex: Filial - Higienópolis" value={nome} onChange={(e) => setNome(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Endereço Completo</Label>
              <Input placeholder="Ex: Rua Apucarana, 1200 - Tatuapé, São Paulo - SP" value={endereco} onChange={(e) => setEndereco(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Telefone / WhatsApp</Label>
              <Input placeholder="Ex: (11) 98888-7777" value={telefone} onChange={(e) => setTelefone(e.target.value)} className="mt-1" />
            </div>

            {/* Configuração Dia a Dia da Semana */}
            <div className="pt-2">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5 mb-2">
                <Clock className="h-4 w-4 text-amber-400" /> Quadro de Expediente Semanal (Segunda a Domingo)
              </Label>
              <div className="space-y-2.5 bg-secondary/20 p-3 rounded-xl border border-white/[0.06]">
                {expedienteSemana.map((d, index) => (
                  <div key={d.dia} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-card/60 border border-white/[0.04]">
                    <div className="w-32 flex items-center gap-2">
                      <Switch
                        checked={d.aberto}
                        onCheckedChange={(checked) => handleUpdateDiaExpediente(index, "aberto", checked)}
                      />
                      <span className={`text-xs font-medium ${d.aberto ? "text-foreground" : "text-muted-foreground line-through"}`}>
                        {d.label}
                      </span>
                    </div>

                    {d.aberto ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={d.abertura}
                          onChange={(e) => handleUpdateDiaExpediente(index, "abertura", e.target.value)}
                          className="h-7 text-xs w-24 px-1.5"
                        />
                        <span className="text-xs text-muted-foreground">até</span>
                        <Input
                          type="time"
                          value={d.fechamento}
                          onChange={(e) => handleUpdateDiaExpediente(index, "fechamento", e.target.value)}
                          className="h-7 text-xs w-24 px-1.5"
                        />
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-destructive px-3">Fechado</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setUnidadeDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveUnidade} disabled={saving} className="btn-wine">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar Expediente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Feriado */}
      <Dialog open={feriadoDialogOpen} onOpenChange={setFeriadoDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Feriado ou Horário Especial</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Data do Feriado *</Label>
                <Input type="date" value={feriadoData} onChange={(e) => setFeriadoData(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Unidade Afetada</Label>
                <Select value={feriadoUnidadeId} onValueChange={setFeriadoUnidadeId}>
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as Filiais (Rede)</SelectItem>
                    {unidades.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Nome / Descrição *</Label>
              <Input placeholder="Ex: Feriado da Independência / Natal / Manutenção Predial" value={feriadoDescricao} onChange={(e) => setFeriadoDescricao(e.target.value)} className="mt-1" />
            </div>

            <div className="p-3 bg-secondary/30 rounded-xl space-y-3">
              <Label className="text-xs font-semibold">Expediente na Data</Label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input type="radio" checked={feriadoFechado} onChange={() => setFeriadoFechado(true)} />
                  🔴 Fechado o Dia Todo
                </label>
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input type="radio" checked={!feriadoFechado} onChange={() => setFeriadoFechado(false)} />
                  🟡 Horário Especial
                </label>
              </div>

              {!feriadoFechado && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <Label className="text-[11px]">Abertura</Label>
                    <Input type="time" value={feriadoAbertura} onChange={(e) => setFeriadoAbertura(e.target.value)} className="mt-1 h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[11px]">Fechamento</Label>
                    <Input type="time" value={feriadoFechamento} onChange={(e) => setFeriadoFechamento(e.target.value)} className="mt-1 h-8 text-xs" />
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeriadoDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveFeriado} disabled={saving} className="btn-wine">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Registrar Exceção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
