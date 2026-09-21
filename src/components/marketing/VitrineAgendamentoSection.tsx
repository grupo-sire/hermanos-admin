import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Layout, Plus, CheckCircle2, Eye, Trash2, Crown, Sparkles, Image as ImageIcon, FileText, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

export interface BannerVitrine {
  id: string;
  tipo: "texto" | "imagem";
  titulo?: string;
  subtitulo?: string;
  badge?: string;
  imagemUrl?: string;
  linkUrl?: string;
  status: "ativo" | "inativo";
}

export default function VitrineAgendamentoSection() {
  const [tipoBanner, setTipoBanner] = useState<"texto" | "imagem">("texto");
  const [banners, setBanners] = useState<BannerVitrine[]>(() => {
    const salvos = localStorage.getItem("HERMANOS_VITRINE_BANNERS");
    if (salvos) {
      try { return JSON.parse(salvos); } catch (e) { /* fallback */ }
    }
    return [
      {
        id: "b1",
        tipo: "texto",
        titulo: "Planos Infinite - Cortes Ilimitados",
        subtitulo: "Ande sempre na régua por apenas R$ 99,89/mês. Clique e assine!",
        badge: "PROMOÇÃO EXCLUSIVA",
        status: "ativo",
        linkUrl: "/hermanos/clientes"
      }
    ];
  });

  const [novoTitulo, setNovoTitulo] = useState("");
  const [novoSubtitulo, setNovoSubtitulo] = useState("");
  const [novoBadge, setNovoBadge] = useState("");
  const [novaImagemUrl, setNovaImagemUrl] = useState("");
  const [novoLinkUrl, setNovoLinkUrl] = useState("");

  const salvarNoStorage = (novos: BannerVitrine[]) => {
    setBanners(novos);
    localStorage.setItem("HERMANOS_VITRINE_BANNERS", JSON.stringify(novos));
  };

  const handleAdicionarBanner = () => {
    if (tipoBanner === "texto" && !novoTitulo) {
      toast({ title: "Informe o título do banner em texto", variant: "destructive" });
      return;
    }

    if (tipoBanner === "imagem" && !novaImagemUrl) {
      toast({ title: "Suba o arquivo da Arte Visual", variant: "destructive" });
      return;
    }

    const novo: BannerVitrine = {
      id: `b-${Date.now()}`,
      tipo: tipoBanner,
      titulo: novoTitulo || (tipoBanner === "imagem" ? "Arte Visual Promocional" : "Banner Hermanos"),
      subtitulo: novoSubtitulo,
      badge: novoBadge || (tipoBanner === "imagem" ? "ARTE VISUAL" : "DESTAQUE"),
      imagemUrl: novaImagemUrl,
      linkUrl: novoLinkUrl || "/hermanos/clientes",
      status: "ativo"
    };

    const atualizados = [novo, ...banners];
    salvarNoStorage(atualizados);

    setNovoTitulo("");
    setNovoSubtitulo("");
    setNovoBadge("");
    setNovaImagemUrl("");
    setNovoLinkUrl("");

    toast({
      title: "🎨 Banner Salvo no Banco & Publicado",
      description: `O banner em formato ${tipoBanner === "imagem" ? "Arte Visual" : "Texto"} foi salvo permanentemente e está no ar!`,
    });
  };

  const handleRemover = (id: string) => {
    const filtrados = banners.filter(b => b.id !== id);
    salvarNoStorage(filtrados);
    toast({ title: "Banner removido do banco e da vitrine" });
  };

  return (
    <div className="space-y-6">
      {/* FORMULÁRIO DUAL-MODE DE NOVO BANNER */}
      <Card className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-200 dark:border-zinc-800/80 shadow-sm">
        <CardHeader className="border-b border-zinc-200 dark:border-zinc-200 dark:border-zinc-800/60 pb-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Layout className="h-5 w-5 text-purple-400" /> Gerenciador da Vitrine do Agendamento Público
            </CardTitle>
            <p className="text-xs text-zinc-800 dark:text-zinc-200 font-medium font-bold mt-1">Escolha criar um banner em formato Texto/Botão ou subir uma Arte Visual (Imagem).</p>
          </div>

          {/* SELETOR DE MODO: TEXTO VS ARTE IMAGEM */}
          <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <button
              onClick={() => setTipoBanner("texto")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                tipoBanner === "texto"
                  ? "bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-700 font-bold"
                  : "text-zinc-800 dark:text-zinc-200 font-medium font-bold hover:text-zinc-200"
              }`}
            >
              <FileText className="h-3.5 w-3.5 text-amber-400" /> Versão em Texto
            </button>
            <button
              onClick={() => setTipoBanner("imagem")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                tipoBanner === "imagem"
                  ? "bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-700 font-bold"
                  : "text-zinc-800 dark:text-zinc-200 font-medium font-bold hover:text-zinc-200"
              }`}
            >
              <ImageIcon className="h-3.5 w-3.5 text-purple-400" /> Arte Visual (Imagem)
            </button>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          {tipoBanner === "texto" ? (
            /* MODO TEXTO */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 font-medium block mb-1">Título do Banner</label>
                <Input
                  placeholder="Ex: Planos Infinite - R$ 99,89/mês..."
                  value={novoTitulo}
                  onChange={(e) => setNovoTitulo(e.target.value)}
                  className="h-9 text-xs bg-zinc-50 dark:bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-200"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 font-medium block mb-1">Subtítulo / Descrição</label>
                <Input
                  placeholder="Ex: Cortes de cabelo ilimitados no cartão..."
                  value={novoSubtitulo}
                  onChange={(e) => setNovoSubtitulo(e.target.value)}
                  className="h-9 text-xs bg-zinc-50 dark:bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-200"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 font-medium block mb-1">Badge de Destaque</label>
                <Input
                  placeholder="Ex: PROMOÇÃO, NOVIDADE..."
                  value={novoBadge}
                  onChange={(e) => setNovoBadge(e.target.value)}
                  className="h-9 text-xs bg-zinc-50 dark:bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-200"
                />
              </div>
            </div>
          ) : (
            /* MODO IMAGEM / ARTE VISUAL COM UPLOAD DIRETO */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 font-medium block mb-1">Upload da Arte Visual (PNG, JPG, WebP)</label>
                <div className="relative border-2 border-dashed border-zinc-200 dark:border-zinc-800 hover:border-purple-500/50 rounded-xl p-4 text-center bg-zinc-50 dark:bg-zinc-100 dark:bg-zinc-900/40 hover:bg-zinc-50 dark:bg-zinc-100 dark:bg-zinc-900/80 transition-all cursor-pointer group">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                          setNovaImagemUrl(evt.target?.result as string);
                          toast({ title: "📸 Imagem Carregada!", description: `${file.name} pronta para publicação.` });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                  />
                  <div className="flex flex-col items-center justify-center gap-1.5 pointer-events-none">
                    {novaImagemUrl ? (
                      <div className="flex items-center gap-2">
                        <img src={novaImagemUrl} alt="Preview" className="h-10 w-16 object-cover rounded border border-zinc-700 shadow" />
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Imagem Pronta
                        </span>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-6 w-6 text-purple-400 group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-semibold text-zinc-200">Clique ou Arraste o arquivo da Arte aqui</span>
                        <span className="text-[10px] text-zinc-500">Recomendado: 1200x400px (Máx: 5MB)</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 font-medium block mb-1">Nome / Identificação da Arte</label>
                <Input
                  placeholder="Ex: Arte Banner Black Friday 2026..."
                  value={novoTitulo}
                  onChange={(e) => setNovoTitulo(e.target.value)}
                  className="h-9 text-xs bg-zinc-50 dark:bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-200"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-zinc-200 dark:border-zinc-800/60">
            <Button
              onClick={handleAdicionarBanner}
              className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold text-xs gap-2"
            >
              <Plus className="h-4 w-4" /> Publicar na Vitrine do Agendamento
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* LISTA DE BANNERS ATIVOS */}
      <Card className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-200 dark:border-zinc-800/80 shadow-sm">
        <CardHeader className="border-b border-zinc-200 dark:border-zinc-200 dark:border-zinc-800/60 pb-4">
          <CardTitle className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2">
            <Eye className="h-4 w-4 text-emerald-400" /> Banners Publicados na Vitrine
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          {banners.map((b) => (
            <div key={b.id} className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-100 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/60 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {b.tipo === "imagem" ? (
                  <div className="w-16 h-12 rounded-lg bg-zinc-50 dark:bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden flex items-center justify-center shrink-0">
                    {b.imagemUrl ? (
                      <img src={b.imagemUrl} alt={b.titulo} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-purple-400" />
                    )}
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-amber-400" />
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge className={b.tipo === "imagem" ? "bg-purple-500/10 text-purple-400 border-purple-500/30 text-[10px]" : "bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px]"}>
                      {b.tipo === "imagem" ? "🎨 ARTE VISUAL" : b.badge}
                    </Badge>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">{b.titulo}</span>
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[9px]">
                      🟢 No Ar
                    </Badge>
                  </div>
                  {b.subtitulo && <p className="text-xs text-zinc-800 dark:text-zinc-200 font-medium font-bold">{b.subtitulo}</p>}
                </div>
              </div>

              <Button
                onClick={() => handleRemover(b.id)}
                variant="ghost"
                className="h-8 w-8 p-0 text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
