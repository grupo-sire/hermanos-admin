import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface Plano {
  id: string;
  nome: string;
  slug: string;
  preco: number;
  preco_original: number | null;
  descricao: string | null;
  ordem: number;
  ativo: boolean;
}

interface Feature {
  id: string;
  plano_id: string;
  feature: string;
  habilitado: boolean;
  limite: number | null;
}

const FEATURE_LABELS: Record<string, string> = {
  agenda: "Agenda",
  clientes: "Clientes",
  servicos: "Serviços",
  checkout: "Checkout / Comanda",
  produtos: "Produtos",
  estoque: "Estoque",
  categorias: "Categorias",
  marketing: "Marketing",
  crm: "CRM",
  campanhas: "Campanhas",
  cupons: "Cupons",
  fidelidade: "Fidelidade",
  whatsapp: "WhatsApp",
  chatbot: "Chatbot",
  relatorios: "Relatórios",
  assistente_ia: "Assistente IA",
  unidades: "Multi-Unidades",
  ads_metrics: "Métricas de Ads",
  email_marketing: "Email Marketing",
};

export default function AdminPlanos() {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: planosData }, { data: featuresData }] = await Promise.all([
      supabase.from("planos").select("*").order("ordem"),
      supabase.from("plano_features").select("*"),
    ]);
    setPlanos((planosData as Plano[]) || []);
    setFeatures((featuresData as Feature[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleFeature = async (featureId: string, habilitado: boolean) => {
    const { error } = await supabase
      .from("plano_features")
      .update({ habilitado })
      .eq("id", featureId);

    if (error) {
      toast.error("Erro ao atualizar feature");
    } else {
      setFeatures((prev) =>
        prev.map((f) => (f.id === featureId ? { ...f, habilitado } : f))
      );
      toast.success("Feature atualizada");
    }
  };

  // Get unique feature names
  const allFeatures = [...new Set(features.map((f) => f.feature))].sort();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Planos"
        description="Gerencie os planos e suas funcionalidades"
      />

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {planos.map((plano) => (
          <Card key={plano.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{plano.nome}</CardTitle>
                <Badge variant={plano.ativo ? "default" : "secondary"}>
                  {plano.ativo ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{plano.descricao}</p>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {plano.preco.toFixed(2)}
                <span className="text-sm font-normal text-muted-foreground">/mês</span>
              </div>
              {plano.preco_original && (
                <div className="text-sm text-muted-foreground line-through">
                  R$ {plano.preco_original.toFixed(2)}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Feature matrix */}
      <Card>
        <CardHeader>
          <CardTitle>Matriz de Funcionalidades</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-2 font-medium">Funcionalidade</th>
                  {planos.map((p) => (
                    <th key={p.id} className="text-center py-3 px-4 font-medium">
                      {p.nome}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allFeatures.map((featureName) => (
                  <tr key={featureName} className="border-b border-border/50">
                    <td className="py-3 px-2">{FEATURE_LABELS[featureName] || featureName}</td>
                    {planos.map((plano) => {
                      const feat = features.find(
                        (f) => f.plano_id === plano.id && f.feature === featureName
                      );
                      if (!feat) return <td key={plano.id} className="text-center py-3 px-4"><X className="h-4 w-4 text-muted-foreground mx-auto" /></td>;
                      return (
                        <td key={plano.id} className="text-center py-3 px-4">
                          <Switch
                            checked={feat.habilitado}
                            onCheckedChange={(checked) => toggleFeature(feat.id, checked)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
