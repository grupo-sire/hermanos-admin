import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  History, Calendar, FileText, Printer, Download, Search, CheckCircle2,
  ShieldCheck, AlertTriangle, Lock, LockOpen, ArrowUpRight, ArrowDownRight,
  Eye, RefreshCw
} from "lucide-react";
import { getAllCaixaSessoes } from "@/services/caixaService";
import { CaixaSessao } from "@/types/caixa";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface HistoricoCaixasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HistoricoCaixasDialog({ open, onOpenChange }: HistoricoCaixasDialogProps) {
  const [sessoes, setSessoes] = useState<CaixaSessao[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSessao, setSelectedSessao] = useState<CaixaSessao | null>(null);
  const [detalhesOpen, setDetalhesOpen] = useState(false);

  useEffect(() => {
    if (open) {
      carregarHistorico();
    }
  }, [open]);

  const carregarHistorico = () => {
    const list = getAllCaixaSessoes();
    setSessoes(list);
  };

  const filtered = sessoes.filter((s) => {
    const q = searchTerm.toLowerCase();
    return (
      (s.protocolo && s.protocolo.toLowerCase().includes(q)) ||
      (s.unidade_nome && s.unidade_nome.toLowerCase().includes(q)) ||
      (s.fechado_por_nome && s.fechado_por_nome.toLowerCase().includes(q)) ||
      (s.aberto_por_nome && s.aberto_por_nome.toLowerCase().includes(q)) ||
      s.data.includes(q)
    );
  });

  const totalFaturadoHistorico = sessoes.reduce((acc, s) => acc + (s.resumo_vendas?.total_faturado || 0), 0);
  const totalFechamentos = sessoes.filter((s) => s.status === "fechado" || s.status === "reaberto").length;

  const handleExportCSV = () => {
    const headers = ["Protocolo", "Data", "Unidade", "Status", "Aberto Por", "Fundo Troco", "Fechado Por", "Total Faturado", "Gaveta Contada", "Diferenca"];
    const rows = filtered.map((s) => [
      s.protocolo || s.id,
      s.data,
      s.unidade_nome,
      s.status.toUpperCase(),
      s.aberto_por_nome,
      (s.fundo_troco_inicial || 0).toFixed(2),
      s.fechado_por_nome || "-",
      (s.resumo_vendas?.total_faturado || 0).toFixed(2),
      (s.valor_contado_gaveta || 0).toFixed(2),
      (s.diferenca_gaveta || 0).toFixed(2),
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `historico_caixas_${format(new Date(), "yyyyMMdd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleVerDetalhes = (sessao: CaixaSessao) => {
    setSelectedSessao(sessao);
    setDetalhesOpen(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto bg-background text-foreground border border-border p-6 shadow-2xl rounded-2xl">
          <DialogHeader className="space-y-2 border-b border-border pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-bold">
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-black text-foreground">
                    Relatório & Histórico Geral de Caixas
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Registro contábil de aberturas, fechamentos com 2FA e reaberturas auditadas.
                  </DialogDescription>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={carregarHistorico} className="btn-soft text-xs h-8">
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Atualizar
                </Button>
                <Button size="sm" onClick={handleExportCSV} className="btn-wine text-xs h-8">
                  <Download className="h-3.5 w-3.5 mr-1" /> Exportar CSV
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-2">
            <div className="p-3 bg-card rounded-xl border border-border">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Total Fechamentos Homologados</span>
              <div className="text-xl font-black text-foreground">{totalFechamentos} caixas</div>
            </div>
            <div className="p-3 bg-card rounded-xl border border-border">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Faturamento Consolidado</span>
              <div className="text-xl font-black text-emerald-500">R$ {totalFaturadoHistorico.toFixed(2)}</div>
            </div>
            <div className="p-3 bg-card rounded-xl border border-border">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Sessões Registradas</span>
              <div className="text-xl font-black text-primary">{sessoes.length} sessões</div>
            </div>
          </div>

          {/* Filtro de Busca */}
          <div className="flex items-center gap-2 my-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por protocolo, data (AAAA-MM-DD), responsável ou unidade..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 text-xs h-9"
              />
            </div>
          </div>

          {/* Tabela de Histórico */}
          <div className="rounded-xl border border-border overflow-hidden bg-card">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-xs">Data / Protocolo</TableHead>
                  <TableHead className="text-xs">Unidade</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Abertura</TableHead>
                  <TableHead className="text-xs">Fechamento</TableHead>
                  <TableHead className="text-xs">Faturamento</TableHead>
                  <TableHead className="text-xs">Diferença Gaveta</TableHead>
                  <TableHead className="text-xs text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-xs text-muted-foreground">
                      Nenhum fechamento de caixa registrado no histórico ainda.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((s) => (
                    <TableRow key={s.id} className="border-border hover:bg-muted/30">
                      <TableCell className="text-xs">
                        <div className="font-bold text-foreground">{s.protocolo || s.id}</div>
                        <div className="text-[10px] text-muted-foreground">{s.data}</div>
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-foreground">
                        {s.unidade_nome}
                      </TableCell>
                      <TableCell>
                        {s.status === "aberto" && (
                          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-[10px]">
                            Aberto
                          </Badge>
                        )}
                        {s.status === "fechado" && (
                          <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]">
                            Fechado (2FA)
                          </Badge>
                        )}
                        {s.status === "reaberto" && (
                          <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-[10px]">
                            Reaberto
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="text-foreground">{s.aberto_por_nome}</div>
                        <div className="text-[10px] text-muted-foreground">Fundo: R$ {(s.fundo_troco_inicial || 0).toFixed(2)}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {s.fechado_por_nome ? (
                          <>
                            <div className="text-foreground">{s.fechado_por_nome}</div>
                            <div className="text-[10px] text-muted-foreground">{s.fechado_em ? format(new Date(s.fechado_em), "HH:mm") : "--"}</div>
                          </>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-black text-emerald-500">
                        R$ {(s.resumo_vendas?.total_faturado || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-xs font-bold">
                        {s.diferenca_gaveta !== undefined ? (
                          s.diferenca_gaveta === 0 ? (
                            <span className="text-emerald-500">Bateu R$ 0,00</span>
                          ) : s.diferenca_gaveta > 0 ? (
                            <span className="text-blue-400">+ R$ {s.diferenca_gaveta.toFixed(2)} (Sobra)</span>
                          ) : (
                            <span className="text-destructive">- R$ {Math.abs(s.diferenca_gaveta).toFixed(2)} (Falta)</span>
                          )
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleVerDetalhes(s)}
                          className="btn-soft text-xs h-7 px-2"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" /> Detalhes
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalhes da Sessão / Impressão */}
      {selectedSessao && (
        <Dialog open={detalhesOpen} onOpenChange={setDetalhesOpen}>
          <DialogContent className="sm:max-w-2xl bg-background text-foreground border border-border p-6 shadow-2xl rounded-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader className="border-b border-border pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-lg font-black text-foreground">
                    Comprovante Oficial de Caixa
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Protocolo: <strong className="text-foreground">{selectedSessao.protocolo || selectedSessao.id}</strong>
                  </DialogDescription>
                </div>
                <Button size="sm" onClick={() => window.print()} className="btn-wine text-xs h-8">
                  <Printer className="h-3.5 w-3.5 mr-1" /> Imprimir
                </Button>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-xl border border-border">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Unidade:</span>
                  <span className="font-bold text-foreground">{selectedSessao.unidade_nome}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Data da Operação:</span>
                  <span className="font-bold text-foreground">{selectedSessao.data}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Abertura:</span>
                  <span className="text-foreground">{selectedSessao.aberto_por_nome} (Fundo R$ {(selectedSessao.fundo_troco_inicial || 0).toFixed(2)})</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Fechamento (2FA):</span>
                  <span className="text-foreground">{selectedSessao.fechado_por_nome || "Não fechado"}</span>
                </div>
              </div>

              {selectedSessao.motivo_reabertura && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-500">
                  <span className="font-bold block text-[10px] uppercase">Motivo da Reabertura:</span>
                  <p className="text-xs mt-0.5">{selectedSessao.motivo_reabertura}</p>
                </div>
              )}

              {selectedSessao.resumo_vendas && (
                <div className="space-y-2">
                  <h4 className="font-bold text-foreground text-xs uppercase">Detalhamento Financeiro:</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="p-2.5 bg-card border border-border rounded-lg text-center">
                      <span className="text-[10px] text-muted-foreground block">Dinheiro:</span>
                      <span className="font-bold text-foreground">R$ {(selectedSessao.resumo_vendas.total_dinheiro || 0).toFixed(2)}</span>
                    </div>
                    <div className="p-2.5 bg-card border border-border rounded-lg text-center">
                      <span className="text-[10px] text-muted-foreground block">Pix:</span>
                      <span className="font-bold text-foreground">R$ {(selectedSessao.resumo_vendas.total_pix || 0).toFixed(2)}</span>
                    </div>
                    <div className="p-2.5 bg-card border border-border rounded-lg text-center">
                      <span className="text-[10px] text-muted-foreground block">Cartões:</span>
                      <span className="font-bold text-foreground">R$ {(selectedSessao.resumo_vendas.total_cartao || 0).toFixed(2)}</span>
                    </div>
                    <div className="p-2.5 bg-card border border-border rounded-lg text-center">
                      <span className="text-[10px] text-muted-foreground block">Planos Infinite:</span>
                      <span className="font-bold text-purple-400">{selectedSessao.resumo_vendas.total_planos_infinite || 0} atends.</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
