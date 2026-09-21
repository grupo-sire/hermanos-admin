import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Percent, Sparkles, Plus, Save, Trash2, Building2, User, Scissors, AlertCircle, CheckCircle2, ShieldAlert
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  getCommissionConfig,
  saveCommissionConfigAsync,
  fetchCommissionConfigAsync,
  CommissionConfig,
  CampaignOverride,
} from "@/lib/commissionEngine";
import { useEmpresa } from "@/contexts/EmpresaContext";

export default function ComissionamentoConfigSection() {
  const { empresaId } = useEmpresa();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<CommissionConfig>(getCommissionConfig());
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Listas de unidades e barbeiros para seleção de alvos de campanha
  const [unidades, setUnidades] = useState<{ id: string; nome: string }[]>([]);
  const [barbeiros, setBarbeiros] = useState<{ id: string; nome: string; unidade_id: string }[]>([]);

  // Formulário da Nova Campanha
  const [tipoCampanha, setTipoCampanha] = useState<"unidade" | "gestor" | "barbeiro">("unidade");
  const [targetId, setTargetId] = useState("");
  const [gestorProdPerc, setGestorProdPerc] = useState(20);
  const [barbeiroServPerc, setBarbeiroServPerc] = useState(35);
  const [barbeiroProdPoolPerc, setBarbeiroProdPoolPerc] = useState(30);
  const [motivoCampanha, setMotivoCampanha] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  useEffect(() => {
    fetchOptions();
    fetchCommissionConfigAsync(empresaId).then((c) => setConfig(c));
  }, [empresaId]);

  const fetchOptions = async () => {
    let unQ = supabase.from("unidades").select("id, nome").order("nome");
    if (empresaId) unQ = unQ.eq("empresa_id", empresaId);
    const { data: unData } = await unQ;
    setUnidades(unData || []);

    let barbQ = supabase.from("barbeiros").select("id, nome, unidade_id").eq("status", "active").order("nome");
    if (empresaId) barbQ = barbQ.eq("empresa_id", empresaId);
    const { data: barbData } = await barbQ;
    setBarbeiros(barbData || []);
  };

  const notifyUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    queryClient.invalidateQueries({ queryKey: ["relatorio"] });
  };

  const handleSaveDefaults = async () => {
    setSaving(true);
    try {
      await saveCommissionConfigAsync(config, empresaId);
      notifyUpdate();
      toast.success("Regras padrão de comissionamento salvas e sincronizadas!");
    } catch {
      toast.error("Erro ao salvar regras de comissionamento.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddCampanha = async () => {
    if (!targetId) {
      toast.error("Selecione a unidade, gestor ou barbeiro alvo da campanha.");
      return;
    }

    let targetNome = "";
    if (tipoCampanha === "unidade" || tipoCampanha === "gestor") {
      targetNome = unidades.find((u) => u.id === targetId)?.nome || "Unidade";
    } else {
      targetNome = barbeiros.find((b) => b.id === targetId)?.nome || "Barbeiro";
    }

    const newCampanha: CampaignOverride = {
      id: "camp_" + Date.now(),
      tipo: tipoCampanha,
      target_id: targetId,
      target_nome: targetNome,
      gestor_produto_perc: Number(gestorProdPerc),
      barbeiro_servico_perc: Number(barbeiroServPerc),
      barbeiro_produto_pool_perc: Number(barbeiroProdPoolPerc),
      motivo: motivoCampanha || "Campanha Promocional Interna",
      ativa: true,
      data_inicio: dataInicio || undefined,
      data_fim: dataFim || undefined,
    };

    const updatedConfig = {
      ...config,
      campanhas: [...(config.campanhas || []), newCampanha],
    };

    setConfig(updatedConfig);
    await saveCommissionConfigAsync(updatedConfig, empresaId);
    notifyUpdate();
    toast.success("Campanha interna cadastrada com sucesso!");

    setDialogOpen(false);
    setTargetId("");
    setMotivoCampanha("");
    setDataInicio("");
    setDataFim("");
  };

  const handleToggleCampanha = async (id: string, ativa: boolean) => {
    const updatedCampanhas = (config.campanhas || []).map((c) =>
      c.id === id ? { ...c, ativa } : c
    );
    const updatedConfig = { ...config, campanhas: updatedCampanhas };
    setConfig(updatedConfig);
    await saveCommissionConfigAsync(updatedConfig, empresaId);
    notifyUpdate();
    toast.success(`Campanha ${ativa ? "ativada" : "desativada"}!`);
  };

  const handleDeleteCampanha = async (id: string) => {
    const updatedCampanhas = (config.campanhas || []).filter((c) => c.id !== id);
    const updatedConfig = { ...config, campanhas: updatedCampanhas };
    setConfig(updatedConfig);
    await saveCommissionConfigAsync(updatedConfig, empresaId);
    notifyUpdate();
    toast.success("Campanha removida!");
  };

  return (
    <div className="space-y-6">
      {/* Resumo da Regra Vigente */}
      <Card className="bg-zinc-950/80 border-zinc-800 shadow-xl">
        <CardHeader className="border-b border-zinc-800/80 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Percent className="h-5 w-5 text-red-500" />
              <CardTitle className="text-base font-extrabold text-zinc-100">
                Regras de Comissionamento Padronizadas
              </CardTitle>
            </div>
            <Badge className="bg-red-950/60 text-red-400 border-red-500/40 text-[10px] font-mono">
              MOTOR 2.0 ATIVO
            </Badge>
          </div>
          <p className="text-xs text-zinc-400">
            Defina as taxas corporativas padrão de comissão para Gestores e Barbeiros de todas as filiais.
          </p>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Gestor */}
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" /> Gestor da Filial
                </span>
                <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-[9px]">
                  Produtos
                </Badge>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-zinc-300">% sobre Produtos da Filial</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={config.gestor_produto_perc}
                    onChange={(e) =>
                      setConfig({ ...config, gestor_produto_perc: Number(e.target.value) })
                    }
                    className="bg-zinc-950 border-zinc-800 text-zinc-100 font-mono font-bold text-sm h-9"
                  />
                  <span className="text-sm font-bold text-zinc-400">%</span>
                </div>
              </div>
              <p className="text-[10px] text-zinc-500">
                Incide sobre o faturamento total de produtos vendidos na unidade.
              </p>
            </div>

            {/* Barbeiro - Serviços e Assinaturas */}
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Scissors className="h-3.5 w-3.5" /> Barbeiro - Serviços & Assinaturas
                </span>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-zinc-300">% em Serviços & Novas Assinaturas</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={config.barbeiro_servico_perc}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        barbeiro_servico_perc: Number(e.target.value),
                        barbeiro_assinatura_perc: Number(e.target.value),
                      })
                    }
                    className="bg-zinc-950 border-zinc-800 text-zinc-100 font-mono font-bold text-sm h-9"
                  />
                  <span className="text-sm font-bold text-zinc-400">%</span>
                </div>
              </div>
              <p className="text-[10px] text-zinc-500">
                Incide sobre cortes avulsos, serviços extras e novas assinaturas do mês.
              </p>
            </div>

            {/* Barbeiro - Pool de Produtos Proporcional */}
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Bolo Produtos (Barbeiros)
                </span>
                <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[9px]">
                  Proporcional
                </Badge>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-zinc-300">% Bolo de Produtos da Filial</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={config.barbeiro_produto_pool_perc}
                    onChange={(e) =>
                      setConfig({ ...config, barbeiro_produto_pool_perc: Number(e.target.value) })
                    }
                    className="bg-zinc-950 border-zinc-800 text-zinc-100 font-mono font-bold text-sm h-9"
                  />
                  <span className="text-sm font-bold text-zinc-400">%</span>
                </div>
              </div>
              <p className="text-[10px] text-zinc-500">
                Bolo dividido entre os barbeiros proporcionalmente ao volume de atendimentos de cada um.
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSaveDefaults}
              disabled={saving}
              className="bg-red-600 hover:bg-red-500 text-zinc-950 font-bold text-xs gap-1.5 h-9"
            >
              <Save className="h-4 w-4" /> Salvar Regras Padrão
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Campanhas Internas e Sobrescritas Especiais */}
      <Card className="bg-zinc-950/80 border-zinc-800 shadow-xl">
        <CardHeader className="border-b border-zinc-800/80 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-400" />
              <div>
                <CardTitle className="text-base font-extrabold text-zinc-100">
                  Campanhas Internas & Exceções Temporárias
                </CardTitle>
                <p className="text-xs text-zinc-400">
                  Configure incentivos ou aumentos temporários de comissão por Unidade, Gestor ou Barbeiro.
                </p>
              </div>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-amber-600 hover:bg-amber-500 text-zinc-950 font-bold text-xs gap-1.5 h-8">
                  <Plus className="h-4 w-4" /> Nova Campanha / Sobrescrita
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 max-w-md p-6 rounded-2xl">
                <DialogHeader className="border-b border-zinc-800 pb-3">
                  <DialogTitle className="text-base font-bold flex items-center gap-2 text-amber-400">
                    <Sparkles className="h-4 w-4" /> Cadastrar Campanha / Exceção
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 pt-3 text-xs">
                  <div className="space-y-1">
                    <Label className="text-zinc-300">Tipo da Sobrescrita *</Label>
                    <Select
                      value={tipoCampanha}
                      onValueChange={(val: any) => {
                        setTipoCampanha(val);
                        setTargetId("");
                      }}
                    >
                      <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-950 border-zinc-800">
                        <SelectItem value="unidade">Por Unidade / Filial</SelectItem>
                        <SelectItem value="gestor">Por Gestor de Filial</SelectItem>
                        <SelectItem value="barbeiro">Por Barbeiro Específico</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-zinc-300">Alvo da Campanha *</Label>
                    <Select value={targetId} onValueChange={setTargetId}>
                      <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100">
                        <SelectValue placeholder="Selecione o alvo..." />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-950 border-zinc-800">
                        {(tipoCampanha === "unidade" || tipoCampanha === "gestor") &&
                          unidades.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.nome}
                            </SelectItem>
                          ))}
                        {tipoCampanha === "barbeiro" &&
                          barbeiros.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.nome}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-zinc-300">Motivo / Nome da Campanha</Label>
                    <Input
                      placeholder="Ex: Campanha de Primavera / Destaque do Mês"
                      value={motivoCampanha}
                      onChange={(e) => setMotivoCampanha(e.target.value)}
                      className="bg-zinc-900 border-zinc-800 text-zinc-100 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-zinc-300">Data de Início</Label>
                      <Input
                        type="date"
                        value={dataInicio}
                        onChange={(e) => setDataInicio(e.target.value)}
                        className="bg-zinc-900 border-zinc-800 text-zinc-100 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-zinc-300">Data de Fim (Opções)</Label>
                      <Input
                        type="date"
                        value={dataFim}
                        onChange={(e) => setDataFim(e.target.value)}
                        className="bg-zinc-900 border-zinc-800 text-zinc-100 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    {(tipoCampanha === "unidade" || tipoCampanha === "barbeiro") && (
                      <div className="space-y-1">
                        <Label className="text-zinc-300">% Serviços / Assinaturas</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={barbeiroServPerc}
                          onChange={(e) => setBarbeiroServPerc(Number(e.target.value))}
                          className="bg-zinc-900 border-zinc-800 text-zinc-100 font-mono font-bold text-xs"
                        />
                      </div>
                    )}

                    {(tipoCampanha === "unidade" || tipoCampanha === "gestor") && (
                      <div className="space-y-1">
                        <Label className="text-zinc-300">% Gestor (Produtos)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={gestorProdPerc}
                          onChange={(e) => setGestorProdPerc(Number(e.target.value))}
                          className="bg-zinc-900 border-zinc-800 text-zinc-100 font-mono font-bold text-xs"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      variant="ghost"
                      onClick={() => setDialogOpen(false)}
                      className="text-xs text-zinc-400 hover:text-zinc-200"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleAddCampanha}
                      className="bg-amber-600 hover:bg-amber-500 text-zinc-950 font-bold text-xs"
                    >
                      Criar Campanha
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {(!config.campanhas || config.campanhas.length === 0) ? (
            <div className="text-center py-8 text-zinc-500 text-xs">
              Nenhuma campanha ou exceção temporária cadastrada. O sistema utilizará as regras corporativas padrão.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-zinc-900/60">
                <TableRow className="border-zinc-800">
                  <TableHead className="text-zinc-400 text-xs font-bold">Tipo</TableHead>
                  <TableHead className="text-zinc-400 text-xs font-bold">Alvo</TableHead>
                  <TableHead className="text-zinc-400 text-xs font-bold">Motivo</TableHead>
                  <TableHead className="text-zinc-400 text-xs font-bold">Período / Vigência</TableHead>
                  <TableHead className="text-zinc-400 text-xs font-bold">Taxas Aplicadas</TableHead>
                  <TableHead className="text-zinc-400 text-xs font-bold">Status</TableHead>
                  <TableHead className="text-zinc-400 text-xs font-bold text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {config.campanhas.map((camp) => (
                  <TableRow key={camp.id} className="border-zinc-800/60 hover:bg-zinc-900/40">
                    <TableCell>
                      <Badge variant="outline" className="border-zinc-700 text-zinc-300 text-[10px] uppercase font-mono">
                        {camp.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold text-xs text-zinc-100">
                      {camp.target_nome}
                    </TableCell>
                    <TableCell className="text-xs text-zinc-400">
                      {camp.motivo}
                    </TableCell>
                    <TableCell className="text-xs text-zinc-300 font-mono">
                      {camp.data_inicio || camp.data_fim ? (
                        <span>
                          {camp.data_inicio ? camp.data_inicio.split("-").reverse().join("/") : "Início"}
                          {" até "}
                          {camp.data_fim ? camp.data_fim.split("-").reverse().join("/") : "Indeterminado"}
                        </span>
                      ) : (
                        <span className="text-zinc-500">Indeterminado</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-amber-400">
                      {camp.barbeiro_servico_perc !== undefined && `Serv/Assin: ${camp.barbeiro_servico_perc}% `}
                      {camp.gestor_produto_perc !== undefined && `Gestor Prod: ${camp.gestor_produto_perc}%`}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={camp.ativa}
                          onCheckedChange={(val) => handleToggleCampanha(camp.id, val)}
                        />
                        <span className={`text-[10px] font-bold ${camp.ativa ? "text-emerald-400" : "text-zinc-500"}`}>
                          {camp.ativa ? "Ativa" : "Inativa"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteCampanha(camp.id)}
                        className="h-7 w-7 text-zinc-500 hover:text-red-400 hover:bg-red-950/30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
