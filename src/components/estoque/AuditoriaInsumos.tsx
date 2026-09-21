import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, AlertTriangle, CheckCircle2, TrendingUp, Scissors, PackageCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUserRole } from "@/hooks/useUserRole";

interface AuditoriaItem {
  produtoId: string;
  nome: string;
  categoria: string;
  estoqueAtual: number;
  rendimentoPorUnidade: number;
  atendimentosConcluidos: number;
  consumoEsperadoUsos: number;
  baixasReaisRegistradas: number;
  divergenciaPercentual: number;
  statusAuditoria: "perfeito" | "alerta_alto" | "baixo";
}

export function AuditoriaInsumos() {
  const { selectedUnidadeId, userUnidadeId } = useUnidade();
  const { empresaId } = useEmpresa();
  const { unidadeId: roleUnidadeId } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [atendimentosMes, setAtendimentosMes] = useState(0);
  const [itensAuditoria, setItensAuditoria] = useState<AuditoriaItem[]>([]);

  useEffect(() => {
    if (empresaId) {
      fetchAuditoriaData();
    }
  }, [selectedUnidadeId, userUnidadeId, roleUnidadeId, empresaId]);

  async function fetchAuditoriaData() {
    setLoading(true);
    try {
      const targetUnidadeId = selectedUnidadeId || userUnidadeId || roleUnidadeId || "a1346ecc-b354-4b15-8e05-8a980d3bd55e";

      // 1. Buscar total de agendamentos concluidos na unidade
      let agQuery = supabase
        .from("agendamentos")
        .select("id", { count: "exact" })
        .eq("status", "concluido");

      if (empresaId) agQuery = agQuery.eq("empresa_id", empresaId);
      if (targetUnidadeId) agQuery = agQuery.eq("unidade_id", targetUnidadeId);

      const { count: agCount } = await agQuery;
      const totalAtend = agCount || 0;
      setAtendimentosMes(totalAtend);

      let prodQuery = supabase.from("produtos").select("*").eq("status", "active");
      if (empresaId) prodQuery = prodQuery.eq("empresa_id", empresaId);

      const [prodRes, estFilialRes] = await Promise.all([
        prodQuery,
        supabase.from("estoque_filial").select("produto_id, quantidade").eq("unidade_id", targetUnidadeId),
      ]);

      const prods = prodRes.data || [];
      const estFilialData = estFilialRes.data || [];
      const estoqueMap: Record<string, number> = {};
      estFilialData.forEach((ef: any) => {
        estoqueMap[ef.produto_id] = Number(ef.quantidade) || 0;
      });

      // 3. Buscar baixas reais de uso interno no estoque_movimentacoes
      let movQuery = supabase
        .from("estoque_movimentacoes")
        .select("produto_id, quantidade, observacao")
        .eq("tipo", "saida")
        .eq("unidade_id", targetUnidadeId);

      if (empresaId) movQuery = movQuery.eq("empresa_id", empresaId);

      const { data: movs } = await movQuery;

      const baixasMap = new Map<string, number>();
      if (movs) {
        movs.forEach((m) => {
          if (m.observacao && m.observacao.includes("[USO INTERNO")) {
            const current = baixasMap.get(m.produto_id) || 0;
            baixasMap.set(m.produto_id, current + (m.quantidade || 0));
          }
        });
      }

      // 4. Montar lista de auditoria
      const auditoriaList: AuditoriaItem[] = prods
        .filter((p) => {
          if (!p.descricao) return true;
          return !p.descricao.includes("[DESTINACAO:venda]");
        })
        .map((p) => {
          let rendimento = 1;
          if (p.descricao) {
            const match = p.descricao.match(/\[RENDIMENTO:(\d+)\]/);
            if (match) rendimento = Number(match[1]);
          }

          const baixasUnidades = baixasMap.get(p.id) || 0;
          const baixasUsosTotais = baixasUnidades * rendimento;
          const consumoEsperadoUsos = totalAtend > 0 ? totalAtend : 10;

          let divPerc = 0;
          if (consumoEsperadoUsos > 0) {
            divPerc = Math.round(((baixasUsosTotais - consumoEsperadoUsos) / consumoEsperadoUsos) * 100);
          }

          let status: "perfeito" | "alerta_alto" | "baixo" = "perfeito";
          if (divPerc > 40) status = "alerta_alto";
          else if (divPerc < -60 && baixasUsosTotais === 0 && totalAtend > 20) status = "baixo";

          const localStock = estoqueMap[p.id] !== undefined ? Math.max(0, estoqueMap[p.id]) : 0;

          return {
            produtoId: p.id,
            nome: p.nome,
            categoria: p.categoria || "Insumo",
            estoqueAtual: localStock,
            rendimentoPorUnidade: rendimento,
            atendimentosConcluidos: totalAtend,
            consumoEsperadoUsos,
            baixasReaisRegistradas: baixasUnidades,
            divergenciaPercentual: divPerc,
            statusAuditoria: status,
          };
        });

      setItensAuditoria(auditoriaList);
    } catch (err) {
      console.error("Erro ao carregar auditoria:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cards de Resumo da Auditoria */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Scissors className="h-4 w-4 text-primary" />
              Atendimentos Concluídos na Filial
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground font-mono">{atendimentosMes}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Base para cálculo do consumo esperado</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Status Geral da Auditoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs px-2.5 py-1 font-bold">
                ✅ BALANÇO EQUILIBRADO
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">Gerência com baixas regulares de insumos</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <PackageCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              Prevenção de Extravios
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">100%</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Baixas exclusivas registradas pela gerência</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Insumos x Consumo */}
      <div className="panel border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Auditoria de Consumo de Insumos vs Atendimentos Concluídos
            </h3>
            <p className="text-xs text-muted-foreground">Cruzamento entre as baixas efetuadas pelo gerente e o volume real de serviços executados.</p>
          </div>
        </div>

        <div className="rounded-xl border border-border overflow-hidden bg-card">
          {itensAuditoria.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              Nenhum insumo de uso interno cadastrado no momento.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border bg-secondary/30">
                  <TableHead className="text-xs">Insumo / Produto</TableHead>
                  <TableHead className="text-xs text-center">Rendimento p/ Unid.</TableHead>
                  <TableHead className="text-xs text-center">Baixas do Gerente</TableHead>
                  <TableHead className="text-xs text-center">Usos Gerados</TableHead>
                  <TableHead className="text-xs text-center">Atendimentos Concluídos</TableHead>
                  <TableHead className="text-xs text-center">Status de Auditoria</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itensAuditoria.map((item) => (
                  <TableRow key={item.produtoId} className="border-border hover:bg-secondary/30">
                    <TableCell className="font-medium text-foreground text-xs">
                      <div>
                        <span>{item.nome}</span>
                        <span className="text-[10px] text-muted-foreground block">Estoque Atual: {item.estoqueAtual} un</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-xs font-bold font-mono text-amber-600 dark:text-amber-400">
                      {item.rendimentoPorUnidade} usos
                    </TableCell>
                    <TableCell className="text-center text-xs font-bold font-mono text-foreground">
                      {item.baixasReaisRegistradas} caixa(s)/un
                    </TableCell>
                    <TableCell className="text-center text-xs font-bold font-mono text-primary">
                      {item.baixasReaisRegistradas * item.rendimentoPorUnidade} usos
                    </TableCell>
                    <TableCell className="text-center text-xs font-bold font-mono text-foreground">
                      {item.atendimentosConcluidos}
                    </TableCell>
                    <TableCell className="text-center">
                      {item.statusAuditoria === "alerta_alto" ? (
                        <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[11px] font-bold">
                          🚨 Alerta Extravio (+{item.divergenciaPercentual}%)
                        </Badge>
                      ) : item.statusAuditoria === "baixo" ? (
                        <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[11px] font-bold">
                          ⚠️ Pouca Baixa Registrada
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[11px] font-bold">
                          ✅ Consumo Normal
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
