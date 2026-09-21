import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Camera, 
  QrCode, 
  Search, 
  Loader2, 
  CheckCircle2, 
  Truck, 
  Package, 
  AlertTriangle, 
  MapPin, 
  ArrowRight,
  Upload,
  RefreshCw,
  X
} from "lucide-react";
import { ConferirRecebimentoDialog } from "./ConferirRecebimentoDialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function QrScannerDialog({ open, onOpenChange, onSuccess }: Props) {
  const [activeTab, setActiveTab] = useState<"camera" | "manual">("camera");
  const [manualCode, setManualCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [loadingPedido, setLoadingPedido] = useState(false);
  const [pedidoEncontrado, setPedidoEncontrado] = useState<any | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [fotoEntrega, setFotoEntrega] = useState<string | null>(null);
  const [conferirOpen, setConferirOpen] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerId = "hermanos-qr-reader";

  // Iniciar scanner quando abrir no modo câmera
  useEffect(() => {
    let isMounted = true;

    if (open && activeTab === "camera" && !pedidoEncontrado) {
      const timer = setTimeout(() => {
        if (!isMounted) return;
        startScanner();
      }, 300);

      return () => {
        isMounted = false;
        clearTimeout(timer);
        stopScanner();
      };
    } else {
      stopScanner();
    }

    return () => {
      isMounted = false;
      stopScanner();
    };
  }, [open, activeTab, pedidoEncontrado]);

  async function startScanner() {
    try {
      setCameraError(null);
      const element = document.getElementById(readerId);
      if (!element) return;

      if (scannerRef.current) {
        await stopScanner();
      }

      const html5QrCode = new Html5Qrcode(readerId);
      scannerRef.current = html5QrCode;

      setScanning(true);
      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          handleCodeDetected(decodedText);
        },
        () => {
          // Frame sem QR code, ignorar
        }
      );
    } catch (err: any) {
      console.error("Erro ao iniciar câmera:", err);
      setScanning(false);
      setCameraError(
        err?.message?.includes("Permission") || err?.name === "NotAllowedError"
          ? "Permissão de câmera negada. Ative a câmera no seu navegador ou digite o código do pedido."
          : "Não foi possível acessar a câmera. Verifique as permissões do dispositivo."
      );
    }
  }

  async function stopScanner() {
    try {
      if (scannerRef.current && scannerRef.current.isScanning) {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      }
    } catch (e) {
      console.error("Erro ao parar scanner:", e);
    } finally {
      scannerRef.current = null;
      setScanning(false);
    }
  }

  // Ao detectar código
  function handleCodeDetected(rawText: string) {
    // Tocar vibração tátil se suportado
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([100]);
    }

    stopScanner();

    let cleanId = rawText.trim();
    if (cleanId.startsWith("HERMANOS_SUPRIMENTO:")) {
      cleanId = cleanId.replace("HERMANOS_SUPRIMENTO:", "").trim();
    }

    buscarPedido(cleanId);
  }

  // Buscar pedido no Supabase
  async function buscarPedido(idOrCode: string) {
    setLoadingPedido(true);
    try {
      let query = supabase
        .from("pedidos_suprimentos" as any)
        .select("*, unidades(nome), pedidos_suprimentos_itens(*, produtos(nome))");

      // Se for UUID completo ou início do UUID
      if (idOrCode.length > 8) {
        query = query.eq("id", idOrCode);
      } else {
        query = query.ilike("id", `${idOrCode}%`);
      }

      const { data, error } = await query.maybeSingle();

      if (error || !data) {
        toast.error("Pedido não localizado para o código: " + idOrCode);
        setPedidoEncontrado(null);
        if (activeTab === "camera") {
          setTimeout(() => startScanner(), 1500);
        }
        return;
      }

      setPedidoEncontrado(data);
      toast.success("Caixa identificada com sucesso!");
    } catch (err) {
      console.error("Erro ao buscar pedido:", err);
      toast.error("Falha ao consultar pedido no banco.");
    } finally {
      setLoadingPedido(false);
    }
  }

  // 1º BIP: Despacho CD ➔ Em Trânsito
  async function handleConfirmarDespacho() {
    if (!pedidoEncontrado) return;
    setUpdatingStatus(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("pedidos_suprimentos" as any)
        .update({
          status: "em_transito",
          despachado_em: now,
        })
        .eq("id", pedidoEncontrado.id);

      if (error) throw error;

      toast.success("1º BIP Concluído! Pedido despachado e marcado EM TRÂNSITO.");
      setPedidoEncontrado({ ...pedidoEncontrado, status: "em_transito", despachado_em: now });
      onSuccess?.();
    } catch (err: any) {
      toast.error("Erro ao despachar pedido: " + err.message);
    } finally {
      setUpdatingStatus(false);
    }
  }

  // 2º BIP: Entregador ➔ Deixou na Filial
  async function handleConfirmarEntrega() {
    if (!pedidoEncontrado) return;
    setUpdatingStatus(true);
    try {
      const now = new Date().toISOString();
      let observacao = pedidoEncontrado.observacao_recebimento || "";
      if (fotoEntrega) {
        observacao += ` [FOTO RECEPCAO ENTREGADOR: ${fotoEntrega}]`;
      }

      const { error } = await supabase
        .from("pedidos_suprimentos" as any)
        .update({
          status: "entregue",
          recebido_em: now,
          observacao_recebimento: observacao,
        })
        .eq("id", pedidoEncontrado.id);

      if (error) throw error;

      toast.success("2º BIP Concluído! Caixa entregue na filial. Gerente notificado para conferência.");
      setPedidoEncontrado({ ...pedidoEncontrado, status: "entregue", recebido_em: now });
      onSuccess?.();
    } catch (err: any) {
      toast.error("Erro ao confirmar entrega: " + err.message);
    } finally {
      setUpdatingStatus(false);
    }
  }

  // Upload de foto do comprovante do motoboy
  async function handleUploadFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `entrega_${pedidoEncontrado?.id?.slice(0, 8)}_${Date.now()}.${fileExt}`;
      const filePath = `pedidos_comprovantes/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("comprovantes")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("comprovantes").getPublicUrl(filePath);
      setFotoEntrega(data.publicUrl);
      toast.success("Foto da caixa anexada com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao subir imagem: " + err.message);
    }
  }

  const handleReset = () => {
    setPedidoEncontrado(null);
    setFotoEntrega(null);
    setManualCode("");
    if (activeTab === "camera") {
      setTimeout(() => startScanner(), 200);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(val) => {
        if (!val) stopScanner();
        onOpenChange(val);
      }}>
        <DialogContent className="sm:max-w-[540px] bg-card border-border p-4 sm:p-6 max-h-[92vh] overflow-y-auto">
          <DialogHeader className="pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                <QrCode className="h-5 w-5 text-primary" />
                Leitor de QR Code Logístico
              </DialogTitle>
              {pedidoEncontrado && (
                <Button size="sm" variant="ghost" className="text-xs text-muted-foreground h-8" onClick={handleReset}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Ler Outra Caixa
                </Button>
              )}
            </div>
          </DialogHeader>

          {/* ========================================================================= */}
          {/* SE UM PEDIDO JÁ FOI BIPADO / LOCALIZADO                                    */}
          {/* ========================================================================= */}
          {pedidoEncontrado ? (
            <div className="space-y-4 py-2 animate-fade-in">
              <div className="p-4 rounded-xl bg-secondary/30 border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Pedido Identificado:</span>
                    <h3 className="text-lg font-black text-foreground font-mono">#{pedidoEncontrado.id.slice(0, 8).toUpperCase()}</h3>
                  </div>
                  <div>
                    {pedidoEncontrado.status === "pendente" && (
                      <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 font-bold">
                        Pendente de Envio
                      </Badge>
                    )}
                    {pedidoEncontrado.status === "em_transito" && (
                      <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 font-bold">
                        🚚 Em Rota de Entrega
                      </Badge>
                    )}
                    {pedidoEncontrado.status === "entregue" && (
                      <Badge className="bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30 font-bold animate-pulse">
                        📦 Caixa na Recepção
                      </Badge>
                    )}
                    {pedidoEncontrado.status === "entregue_concluido" && (
                      <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-bold">
                        ✅ Concluído & Estoque Atualizado
                      </Badge>
                    )}
                    {pedidoEncontrado.status === "divergencia_pendente" && (
                      <Badge className="bg-destructive/15 text-destructive border-destructive/30 font-bold">
                        ⚠️ Divergência em Auditoria
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs border-t border-border pt-2.5">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Destino:</span>
                    <strong className="text-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                      {pedidoEncontrado.unidades?.nome || "Filial Destino"}
                    </strong>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Total de Itens:</span>
                    <strong className="text-foreground font-mono">
                      {pedidoEncontrado.pedidos_suprimentos_itens?.length || 0} produto(s)
                    </strong>
                  </div>
                </div>

                {/* Lista compacta de itens */}
                <div className="bg-card p-2.5 rounded-lg border border-border space-y-1.5 text-xs">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Conteúdo da Caixa:</span>
                  <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                    {pedidoEncontrado.pedidos_suprimentos_itens?.map((item: any) => (
                      <div key={item.id} className="flex justify-between items-center text-[11px]">
                        <span className="text-foreground truncate max-w-[240px]">{item.produtos?.nome || "Produto"}</span>
                        <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">
                          {item.qtd_enviada || item.qtd_solicitada} un.
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ========================================================================= */}
              {/* AÇÕES CONTEXTUAIS DO FLUXO DOS 3 BIPS                                      */}
              {/* ========================================================================= */}
              
              {/* ETAPA 1: PEDIDO PENDENTE -> BIP DO CD MARCA EM TRÂNSITO */}
              {pedidoEncontrado.status === "pendente" && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <Truck className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300">1º BIP: Despacho do Centro de Distribuição</h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Confirme a retirada da caixa pelo entregador para colocar o lote em rota de entrega.
                      </p>
                    </div>
                  </div>

                  <Button 
                    className="w-full btn-wine font-bold text-xs h-10 shadow-md"
                    disabled={updatingStatus}
                    onClick={handleConfirmarDespacho}
                  >
                    {updatingStatus ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Truck className="h-4 w-4 mr-2" />}
                    Confirmar Despacho ➔ Marcar Em Trânsito
                  </Button>
                </div>
              )}

              {/* ETAPA 2: PEDIDO EM TRÂNSITO -> BIP DO ENTREGADOR MARCA ENTREGUE NA FILIAL */}
              {pedidoEncontrado.status === "em_transito" && (
                <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <Package className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-blue-900 dark:text-blue-300">2º BIP: Chegada na Recepção da Filial</h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        O entregador chegou na unidade. Tire uma foto da caixa na recepção e confirme o descarregamento.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="flex-1">
                      <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment"
                        className="hidden" 
                        onChange={handleUploadFoto}
                      />
                      <Button type="button" variant="outline" className="w-full text-xs h-9 border-dashed border-blue-400" asChild>
                        <span>
                          <Upload className="h-3.5 w-3.5 mr-1.5 text-blue-500" />
                          {fotoEntrega ? "Foto Anexada ✅" : "Tirar Foto da Caixa"}
                        </span>
                      </Button>
                    </label>
                  </div>

                  <Button 
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 shadow-md"
                    disabled={updatingStatus}
                    onClick={handleConfirmarEntrega}
                  >
                    {updatingStatus ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                    Confirmar Entrega na Recepção
                  </Button>
                </div>
              )}

              {/* ETAPA 3: PEDIDO ENTREGUE -> GERENTE BIPA PARA CONFERIR E DAR ENTRADA */}
              {pedidoEncontrado.status === "entregue" && (
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-5 w-5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-purple-900 dark:text-purple-300">3º BIP: Entrada Oficial no Estoque (Gerente)</h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Abra a caixa física e confira se todos os itens chegaram intactos para creditar no estoque da loja.
                      </p>
                    </div>
                  </div>

                  <Button 
                    className="w-full btn-wine font-bold text-xs h-10 bg-purple-700 hover:bg-purple-800 text-white shadow-md animate-pulse"
                    onClick={() => setConferirOpen(true)}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Abrir Conferência de Itens & Dar Entrada
                  </Button>
                </div>
              )}

              {/* CONCLUÍDO */}
              {pedidoEncontrado.status === "entregue_concluido" && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-2">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                  <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-300">Ciclo Completo com Sucesso!</h4>
                  <p className="text-[11px] text-muted-foreground">
                    Esta carga já foi conferida e os produtos já foram adicionados ao estoque da filial.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* ========================================================================= */
            /* MODO DE LEITURA (CÂMERA ATIVA OU DIGITAÇÃO MANUAL)                         */
            /* ========================================================================= */
            <div className="space-y-4 py-2">
              <div className="flex bg-secondary p-1 rounded-lg border border-border">
                <Button
                  size="sm"
                  variant={activeTab === "camera" ? "default" : "ghost"}
                  className={`flex-1 text-xs h-8 ${activeTab === "camera" ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground"}`}
                  onClick={() => {
                    setActiveTab("camera");
                    setTimeout(() => startScanner(), 100);
                  }}
                >
                  <Camera className="h-3.5 w-3.5 mr-1.5" /> Câmera / Bipar
                </Button>
                <Button
                  size="sm"
                  variant={activeTab === "manual" ? "default" : "ghost"}
                  className={`flex-1 text-xs h-8 ${activeTab === "manual" ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground"}`}
                  onClick={() => {
                    stopScanner();
                    setActiveTab("manual");
                  }}
                >
                  <Search className="h-3.5 w-3.5 mr-1.5" /> Digitar Código
                </Button>
              </div>

              {activeTab === "camera" && (
                <div className="space-y-3">
                  <div className="relative overflow-hidden rounded-2xl border-2 border-primary/40 bg-black aspect-square flex items-center justify-center">
                    <div id={readerId} className="w-full h-full"></div>

                    {scanning && (
                      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-6">
                        <div className="w-full flex justify-between text-white/50 text-[10px] font-mono">
                          <span>HERMANOS SCAN</span>
                          <span>AUTO-FOCUS</span>
                        </div>
                        <div className="w-56 h-56 border-2 border-primary/80 rounded-xl relative">
                          <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-primary"></div>
                          <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-primary"></div>
                          <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-primary"></div>
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-primary"></div>
                          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500/80 animate-pulse shadow-[0_0_8px_#ef4444]"></div>
                        </div>
                        <span className="bg-black/70 text-white text-[10px] px-3 py-1 rounded-full font-medium">
                          Aponte para o QR Code da caixa
                        </span>
                      </div>
                    )}
                  </div>

                  {cameraError && (
                    <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-xs text-destructive flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>{cameraError}</span>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "manual" && (
                <div className="p-4 rounded-xl bg-secondary/30 border border-border space-y-3">
                  <label className="text-xs font-semibold text-foreground block">
                    Digite o código ou UUID da caixa:
                  </label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Ex: #8F3A ou UUID completo..."
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      className="input-dark text-xs font-mono"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && manualCode.trim()) {
                          buscarPedido(manualCode.trim());
                        }
                      }}
                    />
                    <Button 
                      className="btn-wine text-xs font-bold shrink-0"
                      disabled={!manualCode.trim() || loadingPedido}
                      onClick={() => buscarPedido(manualCode.trim())}
                    >
                      {loadingPedido ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Você pode digitar apenas os primeiros dígitos que aparecem na etiqueta da caixa.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="pt-2 border-t border-border">
            <Button variant="outline" className="w-full text-xs" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de conferência cega ao acionar o 3º Bip */}
      <ConferirRecebimentoDialog
        pedido={pedidoEncontrado}
        open={conferirOpen}
        onOpenChange={(val) => {
          setConferirOpen(val);
          if (!val) {
            handleReset();
            onSuccess?.();
          }
        }}
        onSuccess={() => {
          setConferirOpen(false);
          handleReset();
          onSuccess?.();
        }}
      />
    </>
  );
}
