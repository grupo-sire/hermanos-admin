import { useState, useEffect } from "react";
import {
  UserCheck,
  Search,
  Filter,
  Phone,
  Instagram,
  Clock,
  Building2,
  Calendar,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Briefcase,
  Trash2,
  ExternalLink,
  ChevronRight,
  UserPlus
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useEmpresa } from "@/contexts/EmpresaContext";

export interface Candidato {
  id: string;
  empresa_id: string;
  whatsapp_phone: string;
  nome: string;
  unidades_interesse: string[];
  tempo_experiencia: string;
  instagram_portfolio: string;
  disponibilidade_inicio: string;
  status: "novo" | "em_analise" | "entrevistado" | "contratado" | "recusado" | "arquivado";
  observacoes: string;
  criado_em: string;
  atualizado_em: string;
}

const UNIDADES_LISTA = [
  "Higienópolis",
  "Osasco",
  "Mooca",
  "Tatuapé",
  "Freguesia do Ó",
  "São Caetano",
  "Itaim Bibi"
];

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  novo: { label: "Novo", color: "text-blue-500 border-blue-500/30", bg: "bg-blue-500/10" },
  em_analise: { label: "Em Análise", color: "text-amber-500 border-amber-500/30", bg: "bg-amber-500/10" },
  entrevistado: { label: "Entrevistado", color: "text-purple-500 border-purple-500/30", bg: "bg-purple-500/10" },
  contratado: { label: "Contratado", color: "text-emerald-500 border-emerald-500/30", bg: "bg-emerald-500/10" },
  recusado: { label: "Recusado", color: "text-red-500 border-red-500/30", bg: "bg-red-500/10" },
  arquivado: { label: "Arquivado", color: "text-slate-500 border-slate-500/30", bg: "bg-slate-500/10" },
};

export default function BancoTalentos() {
  const { config } = useEmpresa();
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [unidadeFiltro, setUnidadeFiltro] = useState<string>("todas");
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");

  // Modal de Observações
  const [modalObsOpen, setModalObsOpen] = useState(false);
  const [candidatoObs, setCandidatoObs] = useState<Candidato | null>(null);
  const [textoObs, setTextoObs] = useState("");
  const [salvandoObs, setSalvandoObs] = useState(false);

  useEffect(() => {
    carregarCandidatos();

    // Inscrição Realtime no Supabase para novas candidaturas via WhatsApp
    const channel = supabase
      .channel("candidatos_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "candidatos_barbeiros" },
        () => {
          carregarCandidatos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const carregarCandidatos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("candidatos_barbeiros")
        .select("*")
        .order("criado_em", { ascending: false });

      if (error) throw error;
      setCandidatos(data || []);
    } catch (err: any) {
      console.error("Erro ao carregar candidatos:", err.message);
      toast.error("Erro ao carregar lista de candidatos");
    } finally {
      setLoading(false);
    }
  };

  const handleAlterarStatus = async (id: string, novoStatus: string) => {
    try {
      const { error } = await supabase
        .from("candidatos_barbeiros")
        .update({ status: novoStatus, atualizado_em: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;

      setCandidatos((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: novoStatus as any } : c))
      );
      toast.success("Status do candidato atualizado!");
    } catch (err: any) {
      toast.error("Erro ao atualizar status: " + err.message);
    }
  };

  const handleAbrirObs = (cand: Candidato) => {
    setCandidatoObs(cand);
    setTextoObs(cand.observacoes || "");
    setModalObsOpen(true);
  };

  const handleSalvarObs = async () => {
    if (!candidatoObs) return;
    try {
      setSalvandoObs(true);
      const { error } = await supabase
        .from("candidatos_barbeiros")
        .update({ observacoes: textoObs, atualizado_em: new Date().toISOString() })
        .eq("id", candidatoObs.id);

      if (error) throw error;

      setCandidatos((prev) =>
        prev.map((c) => (c.id === candidatoObs.id ? { ...c, observacoes: textoObs } : c))
      );
      toast.success("Anotações salvas com sucesso!");
      setModalObsOpen(false);
    } catch (err: any) {
      toast.error("Erro ao salvar anotações: " + err.message);
    } finally {
      setSalvandoObs(false);
    }
  };

  const handleDeletarCandidato = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover esta candidatura?")) return;
    try {
      const { error } = await supabase.from("candidatos_barbeiros").delete().eq("id", id);
      if (error) throw error;
      setCandidatos((prev) => prev.filter((c) => c.id !== id));
      toast.success("Candidatura removida");
    } catch (err: any) {
      toast.error("Erro ao remover: " + err.message);
    }
  };

  const candidatosFiltrados = candidatos.filter((c) => {
    const termo = busca.toLowerCase();
    const bateBusca =
      !busca ||
      c.nome.toLowerCase().includes(termo) ||
      c.whatsapp_phone.includes(termo) ||
      (c.instagram_portfolio || "").toLowerCase().includes(termo) ||
      (c.tempo_experiencia || "").toLowerCase().includes(termo);

    const bateUnidade =
      unidadeFiltro === "todas" ||
      (c.unidades_interesse || []).some(
        (u) => u.toLowerCase().includes(unidadeFiltro.toLowerCase())
      );

    const bateStatus = statusFiltro === "todos" || c.status === statusFiltro;

    return bateBusca && bateUnidade && bateStatus;
  });

  const totalCandidatos = candidatos.length;
  const novos = candidatos.filter((c) => c.status === "novo").length;
  const emAnalise = candidatos.filter((c) => c.status === "em_analise").length;
  const contratados = candidatos.filter((c) => c.status === "contratado").length;

  const formatarWhatsappUrl = (phone: string) => {
    const numLimpo = phone.replace(/\D/g, "");
    return `https://wa.me/${numLimpo}`;
  };

  const formatarInstagramUrl = (insta: string) => {
    if (!insta) return "#";
    if (insta.startsWith("http")) return insta;
    const limpo = insta.replace("@", "").trim();
    return `https://instagram.com/${limpo}`;
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Briefcase className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Banco de Talentos & Recrutamento</h1>
              <p className="text-sm text-muted-foreground">
                Gestão de candidaturas de barbeiros enviadas via WhatsApp IA (Heloísa).
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={carregarCandidatos} variant="outline" size="sm" className="gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Atualizar Candidaturas
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Candidatos</CardTitle>
            <UserPlus className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCandidatos}</div>
            <p className="text-xs text-muted-foreground mt-1">Currículos cadastrados no banco</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-blue-500">Novos Recebidos</CardTitle>
            <AlertCircle className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{novos}</div>
            <p className="text-xs text-muted-foreground mt-1">Aguardando primeira triagem</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-amber-500">Em Análise / Entrevista</CardTitle>
            <Clock className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{emAnalise}</div>
            <p className="text-xs text-muted-foreground mt-1">Perfil em avaliação pela gerência</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-emerald-500">Contratados</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">{contratados}</div>
            <p className="text-xs text-muted-foreground mt-1">Admitidos na equipe Hermanos</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros e Busca */}
      <Card className="p-4 border-border">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone ou instagram..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <Select value={unidadeFiltro} onValueChange={setUnidadeFiltro}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Unidade de Interesse" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as Unidades</SelectItem>
                  {UNIDADES_LISTA.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Status</SelectItem>
                  <SelectItem value="novo">Novo</SelectItem>
                  <SelectItem value="em_analise">Em Análise</SelectItem>
                  <SelectItem value="entrevistado">Entrevistado</SelectItem>
                  <SelectItem value="contratado">Contratado</SelectItem>
                  <SelectItem value="recusado">Recusado</SelectItem>
                  <SelectItem value="arquivado">Arquivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </Card>

      {/* Lista / Grid de Candidatos */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          Carregando candidaturas do banco de talentos...
        </div>
      ) : candidatosFiltrados.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
          <h3 className="text-lg font-semibold">Nenhum candidato encontrado</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
            Quando barbeiros entrarem em contato pelo WhatsApp procurando por vagas, as fichas aparecerão aqui automaticamente.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {candidatosFiltrados.map((cand) => {
            const stObj = STATUS_MAP[cand.status] || STATUS_MAP.novo;
            const dataFmt = new Date(cand.criado_em).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <Card key={cand.id} className="border-border hover:shadow-md transition-shadow flex flex-col justify-between">
                <div>
                  <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                    <div>
                      <CardTitle className="text-lg font-bold flex items-center gap-2">
                        {cand.nome}
                      </CardTitle>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <Phone className="w-3.5 h-3.5" />
                        <span>{cand.whatsapp_phone}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className={`${stObj.color} ${stObj.bg} font-semibold px-2.5 py-0.5`}>
                      {stObj.label}
                    </Badge>
                  </CardHeader>

                  <CardContent className="space-y-4 text-sm">
                    {/* Unidades de Interesse */}
                    <div>
                      <span className="text-xs text-muted-foreground font-medium block mb-1.5 flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5" /> Unidades de Interesse:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {cand.unidades_interesse && cand.unidades_interesse.length > 0 ? (
                          cand.unidades_interesse.map((u, i) => (
                            <Badge key={i} variant="secondary" className="text-xs bg-secondary">
                              {u}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Todas as unidades</span>
                        )}
                      </div>
                    </div>

                    {/* Detalhes de Experiência e Disponibilidade */}
                    <div className="grid grid-cols-2 gap-2 bg-muted/30 p-3 rounded-lg border border-border/50">
                      <div>
                        <span className="text-[11px] text-muted-foreground block font-medium">Experiência:</span>
                        <span className="font-semibold text-xs text-foreground">
                          {cand.tempo_experiencia || "Não informado"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-muted-foreground block font-medium">Disponibilidade:</span>
                        <span className="font-semibold text-xs text-emerald-500">
                          {cand.disponibilidade_inicio || "Não informada"}
                        </span>
                      </div>
                    </div>

                    {/* Link do Instagram / Portfólio */}
                    {cand.instagram_portfolio && (
                      <div className="flex items-center justify-between bg-gradient-to-r from-purple-500/10 to-pink-500/10 p-2.5 rounded-lg border border-purple-500/20">
                        <div className="flex items-center gap-2 text-xs font-medium text-purple-400">
                          <Instagram className="w-4 h-4 text-pink-500" />
                          <span className="truncate max-w-[180px]">{cand.instagram_portfolio}</span>
                        </div>
                        <a
                          href={formatarInstagramUrl(cand.instagram_portfolio)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold text-pink-500 hover:underline flex items-center gap-1"
                        >
                          Ver Fotos <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}

                    {/* Observações da Gerência */}
                    {cand.observacoes && (
                      <div className="text-xs bg-card p-2.5 rounded border border-border/60 text-muted-foreground italic">
                        <span className="font-semibold text-foreground not-italic block mb-0.5">Anotações do Gerente:</span>
                        "{cand.observacoes}"
                      </div>
                    )}
                  </CardContent>
                </div>

                {/* Footer de Ações */}
                <div className="p-4 border-t border-border bg-muted/10 space-y-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> Recebido em {dataFmt}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Botão WhatsApp 1-Clique */}
                    <a
                      href={formatarWhatsappUrl(cand.whatsapp_phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full"
                    >
                      <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs font-semibold">
                        <MessageSquare className="w-3.5 h-3.5" /> Entrar em Contato
                      </Button>
                    </a>

                    {/* Botão de Anotações */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAbrirObs(cand)}
                      className="w-full gap-1 text-xs"
                    >
                      Anotações
                    </Button>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    {/* Seletor Rápido de Status */}
                    <Select
                      value={cand.status}
                      onValueChange={(val) => handleAlterarStatus(cand.id, val)}
                    >
                      <SelectTrigger className="h-8 text-xs w-[170px]">
                        <SelectValue placeholder="Mudar Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="novo">Novo</SelectItem>
                        <SelectItem value="em_analise">Em Análise</SelectItem>
                        <SelectItem value="entrevistado">Entrevistado</SelectItem>
                        <SelectItem value="contratado">Contratado</SelectItem>
                        <SelectItem value="recusado">Recusado</SelectItem>
                        <SelectItem value="arquivado">Arquivado</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-red-500"
                      onClick={() => handleDeletarCandidato(cand.id)}
                      title="Excluir candidatura"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal de Anotações Internas */}
      <Dialog open={modalObsOpen} onOpenChange={setModalObsOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Anotações do Gerente</DialogTitle>
            <DialogDescription>
              Adicione feedbacks de entrevista, pretensão salarial ou observações sobre o candidato {candidatoObs?.nome}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <Textarea
              placeholder="Digite aqui anotações internas (ex: Barbeiro muito proativo, agendada entrevista presencial para quinta-feira)..."
              value={textoObs}
              onChange={(e) => setTextoObs(e.target.value)}
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalObsOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvarObs} disabled={salvandoObs}>
              {salvandoObs ? "Salvando..." : "Salvar Anotações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
