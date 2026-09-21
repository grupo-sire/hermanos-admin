import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wrench, Clock, CheckCircle2, AlertTriangle, Eye, Loader2, Camera, Upload, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { compressImage } from "@/lib/image-compressor";

interface SolicitacaoAdmin {
  id: string;
  empresa_id: string;
  unidade_id: string;
  titulo: string;
  categoria: string;
  prioridade: string;
  descricao: string;
  foto_solicitacao_url: string | null;
  observacao_manutencao: string | null;
  foto_conclusao_url: string | null;
  status: string;
  created_at: string;
  unidades?: { nome: string };
}

export default function AdminManutencao() {
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");

  const [selectedItem, setSelectedItem] = useState<SolicitacaoAdmin | null>(null);
  const [novoStatus, setNovoStatus] = useState("em_andamento");
  const [observacao, setObservacao] = useState("");
  const [fotoConclusaoUrl, setFotoConclusaoUrl] = useState("");
  const [compressing, setCompressing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSolicitacoes();
  }, []);

  const fetchSolicitacoes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("solicitacoes_manutencao" as any)
        .select("*, unidades(nome)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSolicitacoes(data || []);
    } catch (err: any) {
      console.error("Erro ao carregar chamados de manutenção:", err);
      toast.error("Erro ao carregar chamados de manutenção.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (item: SolicitacaoAdmin) => {
    setSelectedItem(item);
    setNovoStatus(item.status === "pendente" ? "em_andamento" : item.status);
    setObservacao(item.observacao_manutencao || "");
    setFotoConclusaoUrl(item.foto_conclusao_url || "");
  };

  const handleImageConclusaoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCompressing(true);
    try {
      const compressedBase64 = await compressImage(file, { maxWidth: 1200, quality: 0.75 });
      setFotoConclusaoUrl(compressedBase64);
      toast.success("Foto do reparo comprimida com sucesso!");
    } catch (err) {
      toast.error("Erro ao comprimir imagem.");
    } finally {
      setCompressing(false);
    }
  };

  const handleSaveResolution = async () => {
    if (!selectedItem) return;

    setSaving(true);
    try {
      const payload: any = {
        status: novoStatus,
        observacao_manutencao: observacao.trim() || null,
        foto_conclusao_url: fotoConclusaoUrl || null,
        updated_at: new Date().toISOString(),
      };

      if (novoStatus === "concluido") {
        payload.resolvido_em = new Date().toISOString();
      }

      const { error } = await supabase
        .from("solicitacoes_manutencao" as any)
        .update(payload)
        .eq("id", selectedItem.id);

      if (error) throw error;

      toast.success(novoStatus === "concluido" ? "Reparo concluído com OK dado!" : "Status da manutenção atualizado!");
      setSelectedItem(null);
      fetchSolicitacoes();
    } catch (err: any) {
      toast.error("Erro ao atualizar chamado: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = solicitacoes.filter((s) => {
    const matchesSearch =
      s.titulo.toLowerCase().includes(search.toLowerCase()) ||
      (s.unidades?.nome || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "todos" || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case "urgente":
        return <Badge className="bg-destructive text-destructive-foreground">🚨 URGENTE</Badge>;
      case "alta":
        return <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">🔴 Alta</Badge>;
      case "media":
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">🟡 Média</Badge>;
      default:
        return <Badge variant="secondary">🟢 Baixa</Badge>;
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case "concluido":
        return (
          <Badge className="bg-success/20 text-success border-success/30 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> OK / Concluído
          </Badge>
        );
      case "em_andamento":
        return (
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 flex items-center gap-1">
            <Clock className="h-3 w-3 animate-spin" /> Em Reparo
          </Badge>
        );
      default:
        return (
          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Pendente
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Painel Mestre de Manutenção & Reparos"
        description="Gerenciamento central das chamadas de infraestrutura de todas as 7 filiais com dar OK e anexo de fotos."
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Input
            placeholder="Buscar por título ou unidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-dark"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filtrar Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Status</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="em_andamento">Em Reparo</SelectItem>
            <SelectItem value="concluido">Concluído (OK)</SelectItem>
          </SelectContent>
        </Select>

        <Badge variant="secondary" className="h-10 px-4">
          {solicitacoes.length} Chamados Totais
        </Badge>
      </div>

      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.06] hover:bg-transparent">
              <TableHead className="text-muted-foreground font-semibold">Unidade</TableHead>
              <TableHead className="text-muted-foreground font-semibold">Problema / Título</TableHead>
              <TableHead className="text-muted-foreground font-semibold">Categoria</TableHead>
              <TableHead className="text-muted-foreground font-semibold">Prioridade</TableHead>
              <TableHead className="text-muted-foreground font-semibold">Status</TableHead>
              <TableHead className="text-muted-foreground font-semibold">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/40" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  Nenhum chamado de manutenção encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((item) => (
                <TableRow key={item.id} className="border-white/[0.06] hover:bg-white/[0.02]">
                  <TableCell className="font-semibold text-primary">
                    {item.unidades?.nome || "Unidade Central"}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-foreground">{item.titulo}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-xs">{item.descricao}</div>
                  </TableCell>
                  <TableCell className="text-sm">{item.categoria}</TableCell>
                  <TableCell>{getPriorityBadge(item.prioridade)}</TableCell>
                  <TableCell>{getStatusBadge(item.status)}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant={item.status === "concluido" ? "outline" : "default"}
                      className={item.status !== "concluido" ? "btn-wine text-xs" : "text-xs"}
                      onClick={() => handleOpenModal(item)}
                    >
                      <Wrench className="h-3.5 w-3.5 mr-1" />
                      {item.status === "concluido" ? "Ver / Editar OK" : "Atender / Concluir"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal de Atendimento / Conclusão pelo Manutencista */}
      {selectedItem && (
        <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                🛠️ Atendimento de Manutenção — {selectedItem.unidades?.nome}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 bg-secondary/30 rounded-xl space-y-1">
                <div className="flex justify-between font-bold text-foreground">
                  <span>{selectedItem.titulo}</span>
                  {getPriorityBadge(selectedItem.prioridade)}
                </div>
                <p className="text-muted-foreground leading-relaxed">{selectedItem.descricao}</p>
              </div>

              {/* Foto da Abertura */}
              {selectedItem.foto_solicitacao_url && (
                <div className="space-y-1">
                  <span className="font-bold text-muted-foreground">Foto Enviada pela Filial:</span>
                  <img
                    src={selectedItem.foto_solicitacao_url}
                    alt="Abertura"
                    className="w-full h-40 object-cover rounded-xl border border-white/10"
                  />
                </div>
              )}

              {/* Seleção de Status */}
              <div>
                <Label className="text-xs font-semibold">Status do Chamado</Label>
                <Select value={novoStatus} onValueChange={setNovoStatus}>
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">🟡 Pendente (Aguardando)</SelectItem>
                    <SelectItem value="em_andamento">🔵 Em Reparo (Equipe no local)</SelectItem>
                    <SelectItem value="concluido">🟢 Concluído (Dar OK Final)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Parecer Técnico */}
              <div>
                <Label className="text-xs font-semibold">Parecer Técnico / Observações da Manutenção</Label>
                <Textarea
                  placeholder="Ex: Trocado filtro do ar-condicionado, trocado pistão da cadeira..."
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  className="mt-1 resize-none h-20"
                />
              </div>

              {/* Upload da Foto da Conclusão com Compressor */}
              <div>
                <Label className="text-xs font-semibold">Subir Foto do Reparo Concluído (Compressor Leve)</Label>
                <div className="mt-1.5 flex items-center gap-3">
                  <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 p-3 border-2 border-dashed border-border hover:border-success/50 rounded-xl bg-secondary/20 transition-all text-xs font-medium text-muted-foreground hover:text-foreground">
                    {compressing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-success" />
                        Comprimindo foto...
                      </>
                    ) : (
                      <>
                        <Camera className="h-4 w-4 text-success" />
                        {fotoConclusaoUrl ? "Trocar Foto da Conclusão" : "Subir Foto do Reparo Pronto"}
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageConclusaoUpload}
                      className="hidden"
                      disabled={compressing}
                    />
                  </label>

                  {fotoConclusaoUrl && (
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-success flex-shrink-0">
                      <img src={fotoConclusaoUrl} alt="Conclusão" className="w-full h-full object-cover" />
                      <span className="absolute bottom-0 right-0 bg-success text-white text-[8px] p-0.5 rounded-tl">
                        <Check className="h-3 w-3" />
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedItem(null)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveResolution} disabled={saving || compressing} className="btn-wine">
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Salvar & Dar OK
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
