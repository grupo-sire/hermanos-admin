import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, FileText, MapPin, Package, ShieldCheck, CheckCircle2, Image as ImageIcon, ExternalLink } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PedidoItem {
  id: string;
  produto_id: string;
  qtd_solicitada: number;
  qtd_enviada: number;
  produtos?: { nome: string } | null;
}

interface PedidoSuprimento {
  id: string;
  unidade_id: string;
  status: string;
  observacao_matriz?: string | null;
  observacao_filial?: string | null;
  observacao_recebimento?: string | null;
  created_at: string;
  despachado_em?: string | null;
  recebido_em?: string | null;
  unidades?: { nome: string } | null;
  pedidos_suprimentos_itens?: PedidoItem[];
}

interface Props {
  pedido: PedidoSuprimento | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReciboSuprimentosDialog({ pedido, open, onOpenChange }: Props) {
  const [modoImpressao, setModoImpressao] = useState<"guia_a4" | "etiqueta">("guia_a4");

  if (!pedido) return null;

  const handlePrint = () => {
    const printElement = document.getElementById("hermanos-print-document");
    if (!printElement) {
      window.print();
      return;
    }

    // Criar ou reutilizar iframe oculto dedicado para impressao limpa
    let iframe = document.getElementById("hermanos-print-iframe") as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "hermanos-print-iframe";
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "none";
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    // Coletar todos os estilos CSS do Tailwind carregados pela aplicacao
    const styles = Array.from(document.querySelectorAll("link[rel='stylesheet'], style"))
      .map((el) => el.outerHTML)
      .join("\n");

    const isEtiqueta = modoImpressao === "etiqueta";

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Imprimir - Barbearia Hermanos</title>
          ${styles}
          <style>
            @page {
              size: ${isEtiqueta ? "100mm 150mm" : "A4 portrait"};
              margin: ${isEtiqueta ? "0" : "6mm 8mm"};
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              box-sizing: border-box !important;
            }
            html, body {
              background: #ffffff !important;
              color: #0f172a !important;
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
              height: 100% !important;
              overflow: hidden !important;
              font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            #hermanos-print-document {
              margin: 0 auto !important;
              box-shadow: none !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              page-break-after: avoid !important;
              break-after: avoid !important;
              ${isEtiqueta ? "width: 92mm !important; max-width: 92mm !important; max-height: 144mm !important; overflow: hidden !important; margin: 3mm auto !important;" : ""}
            }
          </style>
        </head>
        <body>
          ${printElement.outerHTML}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 250);
  };

  const totalQtd = (pedido.pedidos_suprimentos_itens || []).reduce(
    (acc, item) => acc + (item.qtd_enviada || item.qtd_solicitada || 0),
    0
  );

  const qrPayload = `HERMANOS_SUPRIMENTO:${pedido.id}`;

  let comprovanteUrl: string | null = null;
  if (pedido.observacao_recebimento && pedido.observacao_recebimento.includes("[COMPROVANTE ANEXADO:")) {
    const match = pedido.observacao_recebimento.match(/\[COMPROVANTE ANEXADO:\s*([^\]]+)\]/);
    if (match && match[1]) {
      comprovanteUrl = match[1].trim();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[820px] bg-card border-border max-h-[94vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pb-3 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-foreground">
            <div>
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <FileText className="h-5 w-5 text-primary" />
                Guia Oficial & Etiqueta com QR Code
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Alterne entre a Guia Completa A4 e a Etiqueta Adesiva para a caixa física.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex bg-secondary p-1 rounded-lg border border-border">
                <Button
                  size="sm"
                  variant={modoImpressao === "guia_a4" ? "default" : "ghost"}
                  className={`text-xs h-7 px-3 ${modoImpressao === "guia_a4" ? "bg-primary text-primary-foreground font-bold shadow-sm" : "text-muted-foreground"}`}
                  onClick={() => setModoImpressao("guia_a4")}
                >
                  <FileText className="h-3.5 w-3.5 mr-1" /> Guia A4
                </Button>
                <Button
                  size="sm"
                  variant={modoImpressao === "etiqueta" ? "default" : "ghost"}
                  className={`text-xs h-7 px-3 ${modoImpressao === "etiqueta" ? "bg-primary text-primary-foreground font-bold shadow-sm" : "text-muted-foreground"}`}
                  onClick={() => setModoImpressao("etiqueta")}
                >
                  <Package className="h-3.5 w-3.5 mr-1" /> Etiqueta Caixa
                </Button>
              </div>

              <Button size="sm" className="btn-wine text-xs h-9 font-bold" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-1.5" /> Imprimir
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* ========================================================================= */}
        {/* MODO 1: GUIA OFICIAL A4 COMPLETA COM QR CODE NO CABEÇALHO                 */}
        {/* ========================================================================= */}
        {modoImpressao === "guia_a4" && (
          <div 
            id="hermanos-print-document" 
            className="p-6 bg-white text-slate-900 rounded-lg font-sans text-xs space-y-3.5 shadow-2xl border border-slate-300 mx-auto w-full max-w-[720px]"
          >
            {/* CABEÇALHO A4 COM QR CODE */}
            <div className="flex justify-between items-center border-b-2 border-slate-900 pb-3 gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-red-700" />
                  <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">BARBEARIA HERMANOS</h1>
                </div>
                <p className="text-slate-700 font-bold text-[11px] mt-0.5">SISTEMA DE LOGÍSTICA & DISTRIBUIÇÃO CORPORATIVA</p>
                <p className="text-[9px] text-slate-500 font-medium">Documento Oficial de Separação de Carga, Transporte e Recepção Físico</p>
              </div>
              
              <div className="flex items-center gap-2.5 border-l-2 border-slate-900 pl-3 shrink-0">
                <div className="p-1 bg-white border border-slate-400 rounded-md shadow-xs flex flex-col items-center">
                  <QRCodeSVG
                    value={qrPayload}
                    size={64}
                    level="M"
                  />
                  <span className="text-[7.5px] font-mono font-bold text-slate-700 mt-0.5 uppercase tracking-tighter">Bipar Carga</span>
                </div>
                <div className="text-right">
                  <span className="inline-block bg-slate-900 text-white font-mono text-[11px] font-bold px-2 py-0.5 rounded tracking-wider">
                    GUIA #{pedido.id.slice(0, 8).toUpperCase()}
                  </span>
                  <p className="text-[10px] font-bold text-slate-800 mt-1">
                    Data: {format(new Date(pedido.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                  <span className="text-[8.5px] text-slate-500 font-semibold block uppercase tracking-widest mt-0.5">Formato Padrão A4</span>
                </div>
              </div>
            </div>

            {/* DADOS DE ORIGEM E DESTINO */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-300 text-xs">
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">1. Unidade Solicitante (Destino):</span>
                <span className="font-extrabold text-xs text-slate-900 flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3.5 w-3.5 text-red-600 inline" />
                  {pedido.unidades?.nome || "Filial Destino"}
                </span>
                <p className="text-[9px] text-slate-500 mt-0.5">Responsável pelo Recebimento na Filial</p>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">2. Status da Expedição:</span>
                <span className="font-extrabold text-[11px] text-blue-900 bg-blue-100 px-2 py-0.5 rounded inline-block mt-0.5 uppercase border border-blue-300">
                  {pedido.status === "em_transito" ? "🚚 EM TRÂNSITO (DESPACHADO)" : pedido.status === "entregue_concluido" ? "✅ ENTREGUE / CONCLUÍDO" : pedido.status}
                </span>
                <p className="text-[9px] text-slate-500 mt-0.5">
                  {pedido.recebido_em ? `Recebido em: ${format(new Date(pedido.recebido_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}` : "Origem: Matriz Central / Centro de Distribuição"}
                </p>
              </div>
            </div>

            {/* TABELA A4 DE ITENS */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <h2 className="font-bold text-slate-900 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-slate-800" />
                  3. Itens do Pedido para Separação e Conferência de Carga
                </h2>
                <span className="text-[9px] text-slate-500 italic">Total: {totalQtd} unidades em {pedido.pedidos_suprimentos_itens?.length || 0} produto(s)</span>
              </div>

              <table className="w-full text-left border-collapse border border-slate-400 text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white text-[9px] font-bold uppercase">
                    <th className="p-1.5 border-r border-slate-700 text-center w-10">[  ] OK</th>
                    <th className="p-1.5 border-r border-slate-700">Descrição do Produto / Suprimento</th>
                    <th className="p-1.5 border-r border-slate-700 text-center w-24">Qtd Solicitada</th>
                    <th className="p-1.5 text-center w-24">Qtd Enviada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300 text-[11px]">
                  {(pedido.pedidos_suprimentos_itens || []).map((item, idx) => (
                    <tr key={item.id || idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                      <td className="p-1.5 border-r border-slate-300 text-center">
                        <div className="w-4 h-4 border border-slate-500 rounded mx-auto bg-white flex items-center justify-center">
                          {pedido.status === "entregue_concluido" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : null}
                        </div>
                      </td>
                      <td className="p-1.5 border-r border-slate-300 font-bold text-slate-900">
                        {item.produtos?.nome || "Produto da Matriz"}
                      </td>
                      <td className="p-1.5 border-r border-slate-300 text-center font-bold text-slate-700">
                        {item.qtd_solicitada} un.
                      </td>
                      <td className="p-1.5 text-center font-black text-slate-900">
                        {item.qtd_enviada || item.qtd_solicitada} un.
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* FOTO DO COMPROVANTE FÍSICO SE HOUVER */}
            {comprovanteUrl && (
              <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-500 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[10px] text-emerald-950 flex items-center gap-1.5 uppercase">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                    Comprovante Físico Assinado Pela Filial
                  </span>
                  <a
                    href={comprovanteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[9px] text-emerald-800 font-bold underline flex items-center gap-1 hover:text-emerald-950"
                  >
                    <ExternalLink className="h-3 w-3" /> Ver Alta Resolução
                  </a>
                </div>
                <div className="w-full max-h-24 rounded border border-emerald-300 overflow-hidden bg-black/5 flex items-center justify-center p-1">
                  <img src={comprovanteUrl} alt="Comprovante Assinado" className="max-h-20 object-contain mx-auto" />
                </div>
              </div>
            )}

            {/* OBSERVAÇÃO DO DESPACHO */}
            {pedido.observacao_matriz && (
              <div className="p-2 bg-amber-50 rounded border border-amber-300 text-[10px] text-amber-950">
                <strong className="text-amber-900 font-bold block">Observações da Matriz:</strong>
                {pedido.observacao_matriz}
              </div>
            )}

            {/* ASSINATURA DUPLA NO RODAPÉ */}
            <div className="pt-4 border-t-2 border-slate-900 grid grid-cols-2 gap-8 text-center mt-3">
              <div>
                <div className="border-b border-slate-900 w-full mb-1"></div>
                <span className="font-black text-slate-900 text-[10px] uppercase block">1. Expedição Matriz Central</span>
                <p className="text-[9px] text-slate-600 font-medium">Visto de Separação & Liberação de Carga</p>
              </div>
              <div>
                <div className="border-b border-slate-900 w-full mb-1"></div>
                <span className="font-black text-slate-900 text-[10px] uppercase block">2. Gerente / Recebedor da Filial</span>
                <p className="text-[9px] text-slate-600 font-medium">Assinatura Obrigatória no Recebimento</p>
              </div>
            </div>

            {/* RODAPÉ DO DOCUMENTO */}
            <div className="text-center pt-1 text-[8.5px] text-slate-400 border-t border-slate-200">
              Barbearia Hermanos &copy; {new Date().getFullYear()} - Documento impresso via plataforma web corporativa
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODO 2: ETIQUETA ADESIVA DE CAIXA COM QR CODE                             */}
        {/* ========================================================================= */}
        {modoImpressao === "etiqueta" && (
          <div 
            id="hermanos-print-document" 
            className="p-3.5 bg-white text-slate-900 rounded-lg font-sans text-xs space-y-2 shadow-2xl border-2 border-slate-900 mx-auto w-full max-w-[340px]"
          >
            {/* TOPO ETIQUETA */}
            <div className="text-center border-b border-slate-900 pb-1.5">
              <div className="flex items-center justify-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-red-700" />
                <span className="text-sm font-black tracking-wider uppercase">BARBEARIA HERMANOS</span>
              </div>
              <span className="text-[8.5px] font-bold text-slate-600 tracking-widest uppercase block mt-0.5">
                CENTRO DE DISTRIBUIÇÃO ➔ EXPEDIÇÃO
              </span>
            </div>

            {/* DESTINATÁRIO EM DESTAQUE MÁXIMO */}
            <div className="bg-slate-900 text-white p-2 rounded text-center shadow-inner">
              <span className="text-[8px] uppercase tracking-widest font-semibold text-slate-300 block">DESTINO:</span>
              <h2 className="text-sm font-black uppercase tracking-tight mt-0.5 flex items-center justify-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-red-400 inline" />
                {pedido.unidades?.nome || "FILIAL DESTINO"}
              </h2>
            </div>

            {/* QR CODE CENTRAL */}
            <div className="p-2 bg-slate-50 border border-dashed border-slate-400 rounded-lg flex flex-col items-center justify-center space-y-1">
              <div className="p-1.5 bg-white border border-slate-300 rounded shadow-xs">
                <QRCodeSVG
                  value={qrPayload}
                  size={105}
                  level="H"
                />
              </div>
              <div className="text-center">
                <span className="text-[10px] font-mono font-black text-slate-900 tracking-wider block">
                  PEDIDO: #{pedido.id.slice(0, 8).toUpperCase()}
                </span>
                <span className="text-[8px] text-slate-500 font-semibold uppercase tracking-wider block">
                  Bipe a caixa com o App Hermanos
                </span>
              </div>
            </div>

            {/* RESUMO DO LOTE */}
            <div className="grid grid-cols-2 gap-2 text-[9.5px] bg-slate-100 p-1.5 rounded border border-slate-300">
              <div>
                <span className="text-[8px] font-bold text-slate-500 uppercase block">Itens no Lote:</span>
                <strong className="text-slate-900 text-[10px] font-black">{totalQtd} unidades</strong>
              </div>
              <div className="text-right">
                <span className="text-[8px] font-bold text-slate-500 uppercase block">Data Despacho:</span>
                <strong className="text-slate-900 text-[9.5px] font-mono">
                  {format(new Date(pedido.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </strong>
              </div>
            </div>

            {/* INSTRUÇÕES DOS 3 BIPS NA LATERAL DA CAIXA */}
            <div className="text-[8px] text-slate-600 bg-amber-50 border border-amber-300 p-1.5 rounded space-y-0.5">
              <span className="font-bold text-amber-900 uppercase block">Fluxo de Segurança Hermanos:</span>
              <p>1. <strong>Expedição CD:</strong> Bipe para marcar em trânsito.</p>
              <p>2. <strong>Entregador:</strong> Bipe ao deixar na recepção da filial.</p>
              <p>3. <strong>Gerente:</strong> Bipe para conferir e dar entrada no estoque.</p>
            </div>

            {/* CÓDIGO DE BARRAS DECORATIVO */}
            <div className="text-center pt-0.5 border-t border-slate-200">
              <div className="h-3.5 flex items-center justify-center gap-1 opacity-70">
                {[4, 2, 6, 1, 3, 5, 2, 4, 1, 6, 3, 2, 5, 1, 4, 2, 6, 3, 2, 4, 1, 5].map((w, i) => (
                  <div key={i} className="bg-slate-900 h-full" style={{ width: `${w}px` }}></div>
                ))}
              </div>
              <span className="text-[7px] font-mono font-bold text-slate-500 tracking-widest block mt-0.5">
                *{pedido.id.toUpperCase()}*
              </span>
            </div>
          </div>
        )}

        <DialogFooter className="pt-3 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button className="btn-wine font-bold" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1.5" /> Imprimir {modoImpressao === "etiqueta" ? "Etiqueta 10x15cm" : "Guia A4"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
