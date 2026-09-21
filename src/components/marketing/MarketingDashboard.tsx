import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import {
  Ticket, Bell, Users, TrendingUp, Star, Loader2,
  Facebook, Instagram, BarChart3, Link2, CheckCircle2, Copy, RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AdsEvolutionChart } from "./AdsEvolutionChart";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DashboardMetrics = {
  cuponsAtivos: number;
  totalCupons: number;
  campanhasAtivas: number;
  totalCampanhas: number;
  clientesNoFunil: number;
  taxaConversao: number;
  pontosDistribuidos: number;
  planosAtivos: number;
};

type AdsResume = {
  plataforma: string;
  impressoes: number;
  cliques: number;
  gasto: number;
  conversoes: number;
  roas: number;
  hasData: boolean;
};

export function MarketingDashboard() {
  const { empresaId } = useEmpresa();
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    cuponsAtivos: 0, totalCupons: 0, campanhasAtivas: 0, totalCampanhas: 0,
    clientesNoFunil: 0, taxaConversao: 0, pontosDistribuidos: 0, planosAtivos: 0,
  });
  const [adsData, setAdsData] = useState<Record<string, AdsResume>>({});
  const [loading, setLoading] = useState(true);
  const [webhookRelatorios, setWebhookRelatorios] = useState("");
  const [salvandoWebhook, setSalvandoWebhook] = useState(false);
  const [enviandoRelatorio, setEnviandoRelatorio] = useState(false);

  useEffect(() => { 
    if (empresaId) fetchAll(); 
  }, [empresaId]);

  async function fetchAll() {
    setLoading(true);
    try {
      await Promise.all([fetchMetrics(), fetchAdsMetrics(), fetchEmpresaConfig()]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchEmpresaConfig() {
    const { data } = await supabase.from("empresas").select("webhook_relatorios").eq("id", empresaId!).single();
    if (data && data.webhook_relatorios) {
      setWebhookRelatorios(data.webhook_relatorios);
    }
  }

  async function salvarWebhook() {
    setSalvandoWebhook(true);
    try {
      const { error } = await supabase.from("empresas").update({ webhook_relatorios: webhookRelatorios }).eq("id", empresaId!);
      if (error) throw error;
      toast.success("Webhook atualizado com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSalvandoWebhook(false);
    }
  }

  async function dispararRelatorio() {
    if (!webhookRelatorios) {
      toast.error("Configure uma URL de webhook primeiro.");
      return;
    }
    setEnviandoRelatorio(true);
    try {
      const payload = {
        empresa_id: empresaId,
        timestamp: new Date().toISOString(),
        relatorio: metrics,
      };
      const res = await fetch(webhookRelatorios, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Erro na resposta do n8n");
      toast.success("Relatório disparado com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao disparar relatório: " + err.message);
    } finally {
      setEnviandoRelatorio(false);
    }
  }

  async function fetchMetrics() {
    const [cuponsRes, campanhasRes, funilRes, estagiosRes, pontosRes, planosRes] = await Promise.all([
      supabase.from("cupons").select("id, status").eq("empresa_id", empresaId),
      supabase.from("campanhas").select("id, status").eq("empresa_id", empresaId),
      supabase.from("crm_funil_clientes").select("id, estagio_id").eq("empresa_id", empresaId),
      supabase.from("crm_funil_estagios").select("id, nome, ordem").eq("empresa_id", empresaId),
      supabase.from("cliente_pontos").select("total_acumulado").eq("empresa_id", empresaId),
      supabase.from("planos_fidelidade").select("id, status").eq("empresa_id", empresaId),
    ]);

    const cupons = cuponsRes.data || [];
    const campanhas = campanhasRes.data || [];
    const funilClientes = funilRes.data || [];
    const estagios = estagiosRes.data || [];
    const pontos = pontosRes.data || [];
    const planos = planosRes.data || [];

    const clienteEstagio = estagios.find(e => e.nome === "Cliente");
    const clientesConvertidos = clienteEstagio
      ? funilClientes.filter(fc => fc.estagio_id === clienteEstagio.id).length : 0;
    const taxaConversao = funilClientes.length > 0
      ? Math.round((clientesConvertidos / funilClientes.length) * 100) : 0;
    const totalPontos = pontos.reduce((acc, p) => acc + (p.total_acumulado || 0), 0);

    setMetrics({
      cuponsAtivos: cupons.filter(c => c.status === "active").length,
      totalCupons: cupons.length,
      campanhasAtivas: campanhas.filter(c => c.status === "active").length,
      totalCampanhas: campanhas.length,
      clientesNoFunil: funilClientes.length,
      taxaConversao,
      pontosDistribuidos: totalPontos,
      planosAtivos: planos.filter(p => p.status === "active").length,
    });
  }

  async function fetchAdsMetrics() {
    // Last 30 days aggregated per platform
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data } = await supabase
      .from("ads_metrics")
      .select("plataforma, impressoes, cliques, gasto, conversoes, roas")
      .eq("empresa_id", empresaId)
      .gte("data_referencia", thirtyDaysAgo.toISOString().split("T")[0]);

    const grouped: Record<string, AdsResume> = {};
    for (const row of data || []) {
      if (!grouped[row.plataforma]) {
        grouped[row.plataforma] = {
          plataforma: row.plataforma, impressoes: 0, cliques: 0,
          gasto: 0, conversoes: 0, roas: 0, hasData: true,
        };
      }
      const g = grouped[row.plataforma];
      g.impressoes += row.impressoes || 0;
      g.cliques += row.cliques || 0;
      g.gasto += Number(row.gasto) || 0;
      g.conversoes += row.conversoes || 0;
      g.roas = Number(row.roas) || g.roas;
    }
    setAdsData(grouped);
  }

  function copyWebhookUrl() {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ads-webhook`;
    navigator.clipboard.writeText(url);
    toast.success("URL do webhook copiada!");
  }

  const [syncingAds, setSyncingAds] = useState(false);

  async function handleSyncMetaAds() {
    setSyncingAds(true);
    try {
      const res = await fetch("https://khoeovszuixfwfkaaxaa.supabase.co/functions/v1/sync-meta-ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresa_id: empresaId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erro ao sincronizar anúncios");
      }
      toast.success(data.message || "Anúncios sincronizados com sucesso!");
      await fetchAdsMetrics();
    } catch (err: any) {
      toast.error(err.message || "Falha ao sincronizar anúncios");
    } finally {
      setSyncingAds(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const platformConfig = [
    {
      key: "meta",
      name: "Meta Ads",
      subtitle: "Facebook & Instagram",
      icon: Facebook,
      iconColor: "text-[#1877F2]",
      bgColor: "bg-[#1877F2]/10",
    },
    {
      key: "instagram",
      name: "Instagram Insights",
      subtitle: "Métricas orgânicas",
      icon: Instagram,
      iconColor: "text-[#E1306C]",
      bgColor: "bg-gradient-to-br from-[#833AB4]/10 via-[#FD1D1D]/10 to-[#F77737]/10",
    },
    {
      key: "google",
      name: "Google Ads",
      subtitle: "Search & Display",
      icon: TrendingUp,
      iconColor: "text-[#4285F4]",
      bgColor: "bg-[#4285F4]/10",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Cupons Ativos" value={metrics.cuponsAtivos}
          description={`${metrics.totalCupons} cupons cadastrados`} icon={Ticket} />
        <StatCard title="Campanhas Ativas" value={metrics.campanhasAtivas}
          description={`${metrics.totalCampanhas} campanhas no total`} icon={Bell} />
        <StatCard title="Clientes no Funil" value={metrics.clientesNoFunil}
          description={`${metrics.taxaConversao}% taxa de conversão`} icon={Users} />
        <StatCard title="Pontos Distribuídos" value={metrics.pontosDistribuidos.toLocaleString("pt-BR")}
          description={`${metrics.planosAtivos} plano(s) ativo(s)`} icon={Star} />
      </div>

      <Card className="panel">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-5 w-5 text-primary" />
              Integrações de Tráfego Pago
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-xs"
                onClick={copyWebhookUrl}
              >
                <Copy className="h-3 w-3" />
                Copiar URL Webhook
              </Button>
              <Button
                size="sm"
                className="gap-2 text-xs bg-[#1877F2] hover:bg-[#166fe5] text-white font-semibold shadow"
                disabled={syncingAds}
                onClick={handleSyncMetaAds}
              >
                <RefreshCw className={`h-3 w-3 ${syncingAds ? "animate-spin" : ""}`} />
                {syncingAds ? "Sincronizando..." : "Sincronizar Meta Ads"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-6">
            Envie dados das suas plataformas de anúncios via webhook (n8n, Zapier, etc). Últimos 30 dias.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {platformConfig.map((platform) => {
              const data = adsData[platform.key];
              const Icon = platform.icon;

              return (
                <div key={platform.key} className="bg-secondary/30 border border-border rounded-xl p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${platform.bgColor}`}>
                      <Icon className={`h-6 w-6 ${platform.iconColor}`} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">{platform.name}</h4>
                      <p className="text-xs text-muted-foreground">{platform.subtitle}</p>
                    </div>
                  </div>

                  {data?.hasData ? (
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Impressões</span>
                        <span className="font-medium">{data.impressoes.toLocaleString("pt-BR")}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cliques</span>
                        <span className="font-medium">{data.cliques.toLocaleString("pt-BR")}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Gasto</span>
                        <span className="font-medium">R$ {data.gasto.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Conversões</span>
                        <span className="font-medium">{data.conversoes}</span>
                      </div>
                      {data.roas > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">ROAS</span>
                          <span className="font-medium">{data.roas.toFixed(2)}x</span>
                        </div>
                      )}
                      <Badge variant="default" className="gap-1 text-xs mt-2">
                        <CheckCircle2 className="h-3 w-3" />
                        Conectado
                      </Badge>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2 text-xs text-muted-foreground">
                        <p>• Impressões e alcance</p>
                        <p>• Custo por clique (CPC)</p>
                        <p>• Conversões e ROAS</p>
                      </div>
                      <Badge variant="outline" className="gap-1 text-xs">
                        <Link2 className="h-3 w-3" />
                        Aguardando dados
                      </Badge>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Automação e Relatórios n8n */}
      <Card className="panel border-primary/20 bg-primary/5">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base text-primary">
            <Link2 className="h-5 w-5" />
            Exportação de Relatórios Direto (n8n, Zapier)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Configure uma URL de Webhook para enviar automaticamente os resumos de CRM e faturamento do dashboard para as suas automações no n8n.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 space-y-2 w-full">
              <Label className="text-xs">URL do Webhook (Recebimento dos Relatórios)</Label>
              <Input 
                value={webhookRelatorios} 
                onChange={(e) => setWebhookRelatorios(e.target.value)}
                placeholder="https://n8n.seudominio.com/webhook/relatorios"
                className="bg-black/20"
              />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={salvarWebhook} disabled={salvandoWebhook} className="flex-1 sm:flex-none">
                {salvandoWebhook ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar URL"}
              </Button>
              <Button onClick={dispararRelatorio} disabled={enviandoRelatorio} className="btn-wine flex-1 sm:flex-none gap-2">
                {enviandoRelatorio ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
                Disparar Resumo
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gráficos de evolução */}
      <AdsEvolutionChart />
    </div>
  );
}
