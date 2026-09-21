import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, BarChart3, TrendingUp, Eye, MousePointerClick, DollarSign, Target, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar
} from "recharts";
import { format, subDays, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

type MetricRow = {
  plataforma: string;
  data_referencia: string;
  impressoes: number;
  cliques: number;
  gasto: number;
  conversoes: number;
  alcance: number;
};

const METRIC_OPTIONS = [
  { value: "impressoes", label: "Impressões", icon: Eye, color: "hsl(var(--primary))" },
  { value: "cliques", label: "Cliques", icon: MousePointerClick, color: "#3b82f6" },
  { value: "conversoes", label: "Conversões", icon: Target, color: "#10b981" },
  { value: "gasto", label: "Gasto (R$)", icon: DollarSign, color: "#f59e0b" },
  { value: "alcance", label: "Alcance", icon: TrendingUp, color: "#8b5cf6" },
];

const PERIOD_OPTIONS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "15", label: "Últimos 15 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "60", label: "Últimos 60 dias" },
  { value: "90", label: "Últimos 90 dias" },
];

const CHART_TYPE_OPTIONS = [
  { value: "area", label: "Área" },
  { value: "bar", label: "Barras" },
];

export function AdsEvolutionChart() {
  const [data, setData] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["impressoes", "cliques"]);
  const [selectedPlatform, setSelectedPlatform] = useState<string>("todas");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("30");
  const [chartType, setChartType] = useState<string>("area");
  const [platforms, setPlatforms] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, [selectedPeriod, selectedPlatform]);

  async function fetchData() {
    setLoading(true);
    try {
      const startDate = subDays(new Date(), Number(selectedPeriod));
      let query = supabase
        .from("ads_metrics")
        .select("plataforma, data_referencia, impressoes, cliques, gasto, conversoes, alcance")
        .gte("data_referencia", format(startDate, "yyyy-MM-dd"))
        .order("data_referencia", { ascending: true });

      if (selectedPlatform !== "todas") {
        query = query.eq("plataforma", selectedPlatform);
      }

      const { data: rows } = await query;
      setData(rows || []);

      // Get distinct platforms
      const uniquePlatforms = [...new Set((rows || []).map(r => r.plataforma))];
      setPlatforms(uniquePlatforms);
    } catch (error) {
      console.error("Erro ao carregar dados de ads:", error);
    } finally {
      setLoading(false);
    }
  }

  const chartData = useMemo(() => {
    // Group by date, summing metrics
    const grouped: Record<string, Record<string, number>> = {};

    for (const row of data) {
      const dateKey = row.data_referencia;
      if (!grouped[dateKey]) {
        grouped[dateKey] = { impressoes: 0, cliques: 0, gasto: 0, conversoes: 0, alcance: 0 };
      }
      grouped[dateKey].impressoes += row.impressoes || 0;
      grouped[dateKey].cliques += row.cliques || 0;
      grouped[dateKey].gasto += Number(row.gasto) || 0;
      grouped[dateKey].conversoes += row.conversoes || 0;
      grouped[dateKey].alcance += row.alcance || 0;
    }

    return Object.entries(grouped)
      .map(([date, metrics]) => ({
        date,
        dateLabel: format(new Date(date + "T00:00:00"), "dd/MM", { locale: ptBR }),
        impressoes: metrics.impressoes,
        cliques: metrics.cliques,
        gasto: metrics.gasto,
        conversoes: metrics.conversoes,
        alcance: metrics.alcance,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  // Summary stats
  const summary = useMemo(() => {
    const totals = { impressoes: 0, cliques: 0, gasto: 0, conversoes: 0, alcance: 0 };
    for (const row of chartData) {
      totals.impressoes += row.impressoes;
      totals.cliques += row.cliques;
      totals.gasto += row.gasto;
      totals.conversoes += row.conversoes;
      totals.alcance += row.alcance;
    }
    return {
      ...totals,
      ctr: totals.impressoes > 0 ? ((totals.cliques / totals.impressoes) * 100).toFixed(2) : "0.00",
      cpc: totals.cliques > 0 ? (totals.gasto / totals.cliques).toFixed(2) : "0.00",
    };
  }, [chartData]);

  function toggleMetric(metric: string) {
    setSelectedMetrics(prev =>
      prev.includes(metric)
        ? prev.length > 1 ? prev.filter(m => m !== metric) : prev
        : [...prev, metric]
    );
  }

  const formatTooltipValue = (value: number, name: string) => {
    if (name === "gasto") return [`R$ ${value.toFixed(2)}`, "Gasto"];
    const option = METRIC_OPTIONS.find(m => m.value === name);
    return [value.toLocaleString("pt-BR"), option?.label || name];
  };

  if (loading && data.length === 0) {
    return (
      <Card className="panel">
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-5 w-5 text-primary" />
            Evolução de Métricas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum dado de anúncios ainda</p>
            <p className="text-sm mt-1">Envie dados via webhook para ver os gráficos aqui.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="panel">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-5 w-5 text-primary" />
            Evolução de Métricas
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {platforms.map(p => (
                  <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-[150px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={chartType} onValueChange={setChartType}>
              <SelectTrigger className="w-[100px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHART_TYPE_OPTIONS.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Metric toggles */}
        <div className="flex flex-wrap gap-2">
          {METRIC_OPTIONS.map(metric => {
            const isActive = selectedMetrics.includes(metric.value);
            const Icon = metric.icon;
            return (
              <Button
                key={metric.value}
                variant={isActive ? "default" : "outline"}
                size="sm"
                className="gap-1.5 text-xs h-7"
                onClick={() => toggleMetric(metric.value)}
                style={isActive ? { backgroundColor: metric.color, borderColor: metric.color } : {}}
              >
                <Icon className="h-3 w-3" />
                {metric.label}
              </Button>
            );
          })}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-secondary/30 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Impressões</p>
            <p className="text-lg font-bold">{summary.impressoes.toLocaleString("pt-BR")}</p>
          </div>
          <div className="bg-secondary/30 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Cliques</p>
            <p className="text-lg font-bold">{summary.cliques.toLocaleString("pt-BR")}</p>
          </div>
          <div className="bg-secondary/30 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Gasto Total</p>
            <p className="text-lg font-bold">R$ {summary.gasto.toFixed(2)}</p>
          </div>
          <div className="bg-secondary/30 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">CTR</p>
            <p className="text-lg font-bold">{summary.ctr}%</p>
          </div>
        </div>

        {/* Chart */}
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === "area" ? (
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={formatTooltipValue}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                {selectedMetrics.map(metric => {
                  const opt = METRIC_OPTIONS.find(m => m.value === metric)!;
                  return (
                    <Area
                      key={metric}
                      type="monotone"
                      dataKey={metric}
                      name={opt.label}
                      stroke={opt.color}
                      fill={opt.color}
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                  );
                })}
              </AreaChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={formatTooltipValue}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                {selectedMetrics.map(metric => {
                  const opt = METRIC_OPTIONS.find(m => m.value === metric)!;
                  return (
                    <Bar
                      key={metric}
                      dataKey={metric}
                      name={opt.label}
                      fill={opt.color}
                      radius={[4, 4, 0, 0]}
                    />
                  );
                })}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
