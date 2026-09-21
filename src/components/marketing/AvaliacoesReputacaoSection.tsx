import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Star, RefreshCw, CheckCircle2, Calendar, Building2, Search, Filter } from "lucide-react";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

export default function AvaliacoesReputacaoSection() {
  const [syncing, setSyncing] = useState(false);
  const [unidadeSelecionada, setUnidadeSelecionada] = useState("todas");
  const [periodo, setPeriodo] = useState<"7d" | "30d" | "mes" | "custom">("30d");
  const [dataInicio, setDataInicio] = useState("2026-08-01");
  const [dataFim, setDataFim] = useState("2026-08-21");
  const [search, setSearch] = useState("");

  const handleSyncGoogle = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      toast({
        title: "⭐ Google Business API Sincronizado",
        description: "Avaliações e estatísticas do Google Maps atualizadas em tempo real!",
      });
    }, 1500);
  };

  const avaliacoesGoogle = [
    {
      id: "a1",
      cliente: "Carlos Eduardo Lima",
      foto: "C",
      nota: 5,
      data: "18/08/2026",
      comentario: "Atendimento impecável! O Barbeiro H1 manda muito no degradê. Ambiente de primeira e toalha quente sensacional.",
      unidadeId: "higienopolis",
      unidadeNome: "Unidade Higienópolis",
      plano: "Infinite Cuts",
      respondida: true
    },
    {
      id: "a2",
      cliente: "Bruno Cardoso",
      foto: "B",
      nota: 5,
      data: "15/08/2026",
      comentario: "Assinei o plano Infinite Duos e estou achando o melhor investimento da vida. Corto toda semana e a barba fica perfeita.",
      unidadeId: "moema",
      unidadeNome: "Unidade Moema",
      plano: "Infinite Duos",
      respondida: true
    },
    {
      id: "a3",
      cliente: "Felipe Camargo",
      foto: "F",
      nota: 5,
      data: "12/08/2026",
      comentario: "Recepção atenciosa, agendamento pelo WhatsApp rápido com a IA e pontualidade máxima no horário.",
      unidadeId: "higienopolis",
      unidadeNome: "Unidade Higienópolis",
      plano: "Infinite Cuts",
      respondida: true
    },
    {
      id: "a4",
      cliente: "André Nascimento",
      foto: "A",
      nota: 4,
      data: "05/08/2026",
      comentario: "Muito boa a barbearia, atendimento rápido e organizado.",
      unidadeId: "itaim",
      unidadeNome: "Unidade Itaim",
      plano: null,
      respondida: true
    }
  ];

  const avaliacoesFiltradas = avaliacoesGoogle.filter(a => {
    const matchUnidade = unidadeSelecionada === "todas" || a.unidadeId === unidadeSelecionada;
    const matchSearch = a.cliente.toLowerCase().includes(search.toLowerCase()) ||
                        a.comentario.toLowerCase().includes(search.toLowerCase()) ||
                        a.unidadeNome.toLowerCase().includes(search.toLowerCase());
    return matchUnidade && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* BARRA SUPERIOR DE FILTROS: SELETOR DE UNIDADE + FILTRO DE DATAS IDÊNTICO AO ORIGEM */}
      <div className="p-4 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-200 dark:border-zinc-800/80 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4 shadow-md">
        {/* SELETOR DE UNIDADES */}
        <div className="flex items-center gap-2 w-full lg:w-auto">
          <Building2 className="h-4 w-4 text-amber-400 shrink-0" />
          <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 shrink-0">Unidade Google Business:</span>
          <select
            value={unidadeSelecionada}
            onChange={(e) => setUnidadeSelecionada(e.target.value)}
            className="h-8 text-xs bg-zinc-50 dark:bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-950 dark:text-zinc-100 rounded-lg px-3 font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500/50"
          >
            <option value="todas">🏢 Todas as Unidades Hermanos</option>
            <option value="higienopolis">📍 Unidade Higienópolis</option>
            <option value="moema">📍 Unidade Moema</option>
            <option value="itaim">📍 Unidade Itaim</option>
          </select>
        </div>

        {/* FILTRO DE DATAS E PERÍODOS */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto justify-end">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-emerald-500 shrink-0" />
            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 shrink-0">Período:</span>
            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-100 dark:bg-zinc-900 p-1 rounded-lg border border-zinc-200 dark:border-zinc-200 dark:border-zinc-800 text-xs">
              <button
                onClick={() => setPeriodo("7d")}
                className={`px-3 py-1 rounded-md font-medium transition-all ${periodo === "7d" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-950 dark:text-zinc-100 font-bold border border-zinc-300 dark:border-zinc-700 shadow-sm" : "text-zinc-600 dark:text-zinc-800 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-zinc-200"}`}
              >
                Últimos 7 dias
              </button>
              <button
                onClick={() => setPeriodo("30d")}
                className={`px-3 py-1 rounded-md font-medium transition-all ${periodo === "30d" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-950 dark:text-zinc-100 font-bold border border-zinc-300 dark:border-zinc-700 shadow-sm" : "text-zinc-600 dark:text-zinc-800 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-zinc-200"}`}
              >
                Últimos 30 dias
              </button>
              <button
                onClick={() => setPeriodo("mes")}
                className={`px-3 py-1 rounded-md font-medium transition-all ${periodo === "mes" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-950 dark:text-zinc-100 font-bold border border-zinc-300 dark:border-zinc-700 shadow-sm" : "text-zinc-600 dark:text-zinc-800 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-zinc-200"}`}
              >
                Este Mês
              </button>
              <button
                onClick={() => setPeriodo("custom")}
                className={`px-3 py-1 rounded-md font-medium transition-all ${periodo === "custom" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-950 dark:text-zinc-100 font-bold border border-zinc-300 dark:border-zinc-700 shadow-sm" : "text-zinc-600 dark:text-zinc-800 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-zinc-200"}`}
              >
                Personalizado
              </button>
            </div>
          </div>

          {periodo === "custom" && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-zinc-800 dark:text-zinc-200">De:</span>
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="h-8 w-36 text-xs bg-white dark:bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-200"
              />
              <span className="text-zinc-800 dark:text-zinc-200">Até:</span>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="h-8 w-36 text-xs bg-white dark:bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-200"
              />
            </div>
          )}
        </div>
      </div>

      {/* CABEÇALHO COM NOTA MÉDIA GOOGLE BUSINESS E SINCRONIZAÇÃO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-200 dark:border-zinc-800/80 shadow-sm col-span-1 md:col-span-2">
          <CardContent className="pt-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col items-center justify-center shrink-0">
                <span className="text-3xl font-extrabold text-amber-400 font-mono">4.9</span>
                <div className="flex items-center gap-0.5 mt-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-3 w-3 text-amber-500 fill-amber-500" />
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-950 dark:text-zinc-100 flex items-center gap-2">
                  Google Business Profile <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">API Live</Badge>
                </h3>
                <p className="text-xs text-zinc-800 dark:text-zinc-200 mt-1">
                  Reputação oficial da <strong className="text-amber-400">{unidadeSelecionada === "todas" ? "Todas as Unidades" : `Unidade ${unidadeSelecionada.toUpperCase()}`}</strong> no Google Maps.
                </p>
                <div className="flex items-center gap-4 mt-3 text-xs font-medium text-zinc-800 dark:text-zinc-200">
                  <span>⭐ <strong>284</strong> Avaliações Totais</span>
                  <span>🔥 <strong>+38</strong> este mês</span>
                  <span>📍 <strong>Google Maps API</strong> Sincronizada</span>
                </div>
              </div>
            </div>

            <Button
              onClick={handleSyncGoogle}
              disabled={syncing}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-sm gap-2 shrink-0"
            >
              <RefreshCw className={`h-4 w-4 text-white ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sincronizando API..." : "Sincronizar Google Business"}
            </Button>
          </CardContent>
        </Card>

        {/* DISTRIBUIÇÃO DE NOTAS */}
        <Card className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-200 dark:border-zinc-800/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">Distribuição de Estrelas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="w-8 text-zinc-800 dark:text-zinc-200">5 ★</span>
              <div className="flex-1 bg-zinc-100 dark:bg-zinc-900 rounded-full h-2 overflow-hidden">
                <div className="bg-amber-500 h-full w-[93%]" />
              </div>
              <span className="w-8 text-right font-bold text-zinc-200">265</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-8 text-zinc-800 dark:text-zinc-200">4 ★</span>
              <div className="flex-1 bg-zinc-100 dark:bg-zinc-900 rounded-full h-2 overflow-hidden">
                <div className="bg-amber-500/70 h-full w-[5%]" />
              </div>
              <span className="w-8 text-right font-bold text-zinc-200">15</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-8 text-zinc-800 dark:text-zinc-200">3 ★</span>
              <div className="flex-1 bg-zinc-100 dark:bg-zinc-900 rounded-full h-2 overflow-hidden">
                <div className="bg-amber-500/40 h-full w-[2%]" />
              </div>
              <span className="w-8 text-right font-bold text-zinc-200">4</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FEED DE AVALIAÇÕES REAL-TIME */}
      <Card className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-200 dark:border-zinc-800/80 shadow-sm">
        <CardHeader className="border-b border-zinc-200 dark:border-zinc-800/60 pb-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <CardTitle className="text-lg font-bold text-zinc-950 dark:text-zinc-100 flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500 fill-amber-500" /> Avaliações Recebidas no Google Business em Tempo Real
          </CardTitle>
          <div className="relative w-64">
            <Search className="h-4 w-4 text-zinc-800 dark:text-zinc-200 absolute left-3 top-2.5" />
            <Input
              placeholder="Buscar por cliente ou texto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs bg-zinc-100 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 text-zinc-200"
            />
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {avaliacoesFiltradas.length === 0 ? (
            <div className="text-center py-8 text-xs text-zinc-500">
              Nenhuma avaliação encontrada para os filtros selecionados.
            </div>
          ) : (
            avaliacoesFiltradas.map((a) => (
              <div key={a.id} className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500/40 to-amber-500/10 flex items-center justify-center font-bold text-amber-300">
                      {a.foto}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-950 dark:text-zinc-100">{a.cliente}</span>
                      </div>
                      <span className="text-xs text-zinc-800 dark:text-zinc-200">{a.unidadeNome} • {a.data}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {[...Array(a.nota)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 text-amber-500 fill-amber-500" />
                    ))}
                  </div>
                </div>

                <p className="text-xs text-zinc-800 dark:text-zinc-200 italic bg-zinc-100 dark:bg-zinc-900/60 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800/40">
                  "{a.comentario}"
                </p>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-zinc-800 dark:text-zinc-200 font-medium flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Registro Sincronizado do Google Maps
                  </span>
                  <span className="text-zinc-500">Google Business Profile API</span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
