import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Users, DollarSign, ShoppingBag, AlertTriangle, Package, MapPin, Clock, ShieldAlert, CheckCircle2 } from "lucide-react";
import { getIncidentesCaixas, getAllCaixaSessoes } from "@/services/caixaService";
import { CaixaSessao } from "@/types/caixa";
import { format } from "date-fns";
import { StatCard } from "@/components/ui/stat-card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useEmpresa } from "@/contexts/EmpresaContext";

interface ProdutoBaixoEstoque {
  id: string;
  nome: string;
  estoque: number;
  estoque_minimo: number;
}

interface SuprimentoPendente {
  id: string;
  unidade_nome: string;
  created_at: string;
  qtd_itens: number;
}

export default function AdminDashboard() {
  const { empresaId } = useEmpresa();
  const [stats, setStats] = useState({
    faturamentoTotal: 0,
    totalAtendimentos: 0,
    filiaisAtivas: 0,
    pedidosPendentes: 0,
    incidentesCaixa: 0,
  });
  const [incidentesCaixaList, setIncidentesCaixaList] = useState<CaixaSessao[]>([]);
  const [produtosCriticos, setProdutosCriticos] = useState<ProdutoBaixoEstoque[]>([]);
  const [pedidosPendentesList, setPedidosPendentesList] = useState<SuprimentoPendente[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMasterStats();
  }, [empresaId]);

  const fetchMasterStats = async () => {
    setLoading(true);
    try {
      // 1. Faturamento total consolidado de comandas fechadas
      let comandasQuery = supabase.from("comandas").select("total").eq("status", "fechada");
      if (empresaId) comandasQuery = comandasQuery.eq("empresa_id", empresaId);
      const { data: comandas } = await comandasQuery;

      const faturamentoTotal = (comandas || []).reduce((sum, c) => sum + Number(c.total || 0), 0);
      const totalAtendimentos = comandas?.length || 0;

      // 2. Filiais ativas
      let filiaisQuery = supabase.from("unidades").select("id", { count: "exact", head: true }).eq("status", "active");
      if (empresaId) filiaisQuery = filiaisQuery.eq("empresa_id", empresaId);
      const { count: filiaisCount } = await filiaisQuery;

      // 3. Pedidos de suprimentos pendentes
      let pedQuery = supabase.from("pedidos_suprimentos" as any).select("id, created_at, unidades(nome), pedidos_suprimentos_itens(id)").eq("status", "pendente");
      if (empresaId) pedQuery = pedQuery.eq("empresa_id", empresaId);
      const { data: pedidos } = await pedQuery;

      // 4. Produtos com baixo estoque
      let prodQuery = supabase.from("produtos").select("id, nome, estoque, estoque_minimo").eq("status", "active");
      if (empresaId) prodQuery = prodQuery.eq("empresa_id", empresaId);
      const { data: prods } = await prodQuery;

      const criticos = (prods || []).filter(p => p.estoque <= (p.estoque_minimo || 5));

      const incidentes = getIncidentesCaixas();
      setIncidentesCaixaList(incidentes);

      setStats({
        faturamentoTotal,
        totalAtendimentos,
        filiaisAtivas: filiaisCount || 0,
        pedidosPendentes: pedidos?.length || 0,
        incidentesCaixa: incidentes.length,
      });

      setProdutosCriticos(criticos);
      setPedidosPendentesList((pedidos as any || []).map((p: any) => ({
        id: p.id,
        unidade_nome: p.unidades?.nome || "Filial N/I",
        created_at: p.created_at,
        qtd_itens: p.pedidos_suprimentos_itens?.length || 0,
      })));
    } catch (err) {
      console.error("Erro ao carregar estatísticas mestres:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  };

  return (
    <div className="space-y-6 animate-fade-in p-6">
      <PageHeader
        title="Painel Mestre Hermanos"
        description="Visão executiva 360° consolidada de todas as filiais e suprimentos"
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Faturamento Global"
          value={formatCurrency(stats.faturamentoTotal)}
          description="Total consolidado acumulado"
          icon={DollarSign}
        />
        <StatCard
          title="Atendimentos Realizados"
          value={stats.totalAtendimentos}
          description="Comandas concluídas"
          icon={Users}
        />
        <StatCard
          title="Filiais Ativas"
          value={stats.filiaisAtivas}
          description="Unidades operacionais"
          icon={MapPin}
        />
        <StatCard
          title="Pedidos Pendentes"
          value={stats.pedidosPendentes}
          description="Solicitações de suprimento"
          icon={ShoppingBag}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Painel Alerta de Suprimentos Pendentes */}
        <div className="panel border-warning/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-warning" />
              Solicitações de Suprimento Pendentes ({pedidosPendentesList.length})
            </h3>
          </div>

          {pedidosPendentesList.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              Nenhum pedido de suprimento aguardando despacho da Matriz.
            </div>
          ) : (
            <div className="rounded-xl border border-white/[0.06] overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/[0.06]">
                    <TableHead className="text-xs">Filial</TableHead>
                    <TableHead className="text-xs text-center">Itens Pedidos</TableHead>
                    <TableHead className="text-xs text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pedidosPendentesList.map(p => (
                    <TableRow key={p.id} className="border-white/[0.06]">
                      <TableCell className="text-xs font-semibold text-foreground">{p.unidade_nome}</TableCell>
                      <TableCell className="text-xs text-center font-bold text-primary">{p.qtd_itens}</TableCell>
                      <TableCell className="text-xs text-center">
                        <Badge variant="outline" className="bg-warning/20 text-warning border-warning/30">Aguardando Despacho</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Painel Alerta de Estoque Crítico */}
        <div className="panel border-destructive/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Alerta de Estoque Crítico ({produtosCriticos.length})
            </h3>
          </div>

          {produtosCriticos.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              Todos os produtos estão com níveis saudáveis de estoque.
            </div>
          ) : (
            <div className="rounded-xl border border-white/[0.06] overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/[0.06]">
                    <TableHead className="text-xs">Produto</TableHead>
                    <TableHead className="text-xs text-center">Qtd Atual</TableHead>
                    <TableHead className="text-xs text-center">Mínimo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {produtosCriticos.map(prod => (
                    <TableRow key={prod.id} className="border-white/[0.06]">
                      <TableCell className="text-xs font-medium text-foreground">{prod.nome}</TableCell>
                      <TableCell className="text-xs text-center font-bold text-destructive">{prod.estoque}</TableCell>
                      <TableCell className="text-xs text-center text-muted-foreground">{prod.estoque_minimo}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
      {/* AUDITORIA DE CAIXA: CAIXAS ESQUECIDOS OU NÃO FECHADOS NO EXPEDIENTE */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Auditoria de Conformidade de Caixa (Expediente & Horários)
            </h3>
            <p className="text-xs text-muted-foreground">
              Monitoramento diário de fechamentos. Gerentes que iniciaram o dia seguinte sem fechar o caixa anterior são auditados aqui.
            </p>
          </div>
          <Badge variant="outline" className="text-xs font-bold border-amber-500/40 text-amber-600 bg-amber-500/10">
            Processo Diário Obrigatório
          </Badge>
        </div>

        {incidentesCaixaList.length === 0 ? (
          <div className="p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-6 w-6 shrink-0" />
            <div>
              <p className="text-sm font-extrabold">100% de Conformidade nos Caixas</p>
              <p className="text-xs text-muted-foreground">Todos os gerentes homologaram o fechamento com 2FA no dia correto do expediente.</p>
            </div>
          </div>
        ) : (
          <div className="border border-amber-500/30 rounded-2xl overflow-hidden bg-background shadow-sm">
            <Table>
              <TableHeader className="bg-amber-500/10">
                <TableRow>
                  <TableHead className="font-bold text-xs text-foreground">Unidade / Filial</TableHead>
                  <TableHead className="font-bold text-xs text-foreground">Data do Caixa</TableHead>
                  <TableHead className="font-bold text-xs text-foreground">Gerente Abertura</TableHead>
                  <TableHead className="font-bold text-xs text-foreground">Horário Abertura</TableHead>
                  <TableHead className="font-bold text-xs text-foreground">Detectado Virada</TableHead>
                  <TableHead className="font-bold text-xs text-foreground">Status / Ocorrência</TableHead>
                  <TableHead className="font-bold text-xs text-foreground text-right">Fundo de Troco</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidentesCaixaList.map((inc, i) => (
                  <TableRow key={i} className="hover:bg-amber-500/5">
                    <TableCell className="font-bold text-xs text-foreground flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      {inc.unidade_nome}
                    </TableCell>
                    <TableCell className="text-xs font-mono font-bold text-foreground">
                      {inc.data}
                    </TableCell>
                    <TableCell className="text-xs text-foreground font-semibold">
                      {inc.aberto_por_nome || inc.aberto_por_email}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {inc.aberto_em ? format(new Date(inc.aberto_em), "dd/MM/yyyy HH:mm") : "--"}
                    </TableCell>
                    <TableCell className="text-xs text-amber-600 dark:text-amber-400 font-mono font-bold">
                      {inc.detectado_virada_em ? format(new Date(inc.detectado_virada_em), "dd/MM/yyyy HH:mm") : "--"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive" className="text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/40">
                        ⚠️ Caixa Não Fechado no Dia
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-bold text-foreground text-right">
                      {formatCurrency(inc.fundo_troco_inicial || 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
