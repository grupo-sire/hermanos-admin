import { useState, useEffect } from "react";
import { getCaixaSessao } from "@/services/caixaService";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Loader2, CreditCard, Banknote, QrCode, Wallet, Check, ShoppingBag, Crown, Upload, ZoomIn, X, AlertTriangle } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { ProdutoGaleriaDialog, ProdutoGaleria } from "./ProdutoGaleriaDialog";
import { cn } from "@/lib/utils";

const clienteSchema = z.object({
  cliente_id: z.string().min(1, "Selecione um cliente"),
});

type Cliente = { id: string; nome: string; telefone: string };
type ItemVenda = { produto: ProdutoGaleria; quantidade: number };

interface PagamentoDivisao {
  forma: string;
  valor: number;
  comprovante_pix?: string;
  codigo_nsu?: string;
}

interface VendaManualDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function VendaManualDialog({ open, onOpenChange, onSuccess }: VendaManualDialogProps) {
  const { empresaId } = useEmpresa();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<ProdutoGaleria[]>([]);
  const [itens, setItens] = useState<ItemVenda[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedProdutoId, setSelectedProdutoId] = useState("");
  const [quantidade, setQuantidade] = useState(1);
  const [desconto, setDesconto] = useState(0);
  const [formaPagamento, setFormaPagamento] = useState("pix");

  const [valorEntregueDinheiro, setValorEntregueDinheiro] = useState<string>("");
  const [valorPagoPix, setValorPagoPix] = useState<string>("");
  const [comprovantePixUrl, setComprovantePixUrl] = useState("");
  const [uploadingPix, setUploadingPix] = useState(false);
  const [codigoNsuCartao, setCodigoNsuCartao] = useState("");

  const [pagamentosMultiplos, setPagamentosMultiplos] = useState<PagamentoDivisao[]>([]);
  const [novaFormaMulti, setNovaFormaMulti] = useState("pix");
  const [novoValorMulti, setNovoValorMulti] = useState("");
  const [novoPixMultiUrl, setNovoPixMultiUrl] = useState("");
  const [novoNsuMultiCode, setNovoNsuMultiCode] = useState("");
  const [uploadingPixMulti, setUploadingPixMulti] = useState(false);

  const [galeriaOpen, setGaleriaOpen] = useState(false);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState("");

  const { selectedUnidadeId } = useUnidade();

  const form = useForm({
    resolver: zodResolver(clienteSchema),
    defaultValues: { cliente_id: "" },
  });

  useEffect(() => {
    if (open) {
      fetchData();
      resetForm();
    }
  }, [open]);

  function resetForm() {
    form.reset({ cliente_id: "" });
    setItens([]);
    setSelectedProdutoId("");
    setQuantidade(1);
    setDesconto(0);
    setFormaPagamento("pix");
    setValorEntregueDinheiro("");
    setValorPagoPix("");
    setComprovantePixUrl("");
    setCodigoNsuCartao("");
    setPagamentosMultiplos([]);
  }

  async function fetchData() {
    setLoading(true);
    try {
      const targetUnidadeId = selectedUnidadeId || "a1346ecc-b354-4b15-8e05-8a980d3bd55e";

      const [clientesRes, produtosRes, estFilialRes] = await Promise.all([
        supabase.from("clientes").select("id, nome, telefone").order("nome"),
        supabase.from("produtos").select("id, nome, preco, estoque, imagem_url, descricao").eq("status", "active").order("nome"),
        supabase.from("estoque_filial").select("produto_id, quantidade").eq("unidade_id", targetUnidadeId),
      ]);

      const estFilialData = estFilialRes?.data || [];
      const estoqueMap: Record<string, number> = {};
      estFilialData.forEach((ef: any) => {
        estoqueMap[ef.produto_id] = Number(ef.quantidade) || 0;
      });

      const prods = (produtosRes.data || [])
        .filter((p: any) => !p.descricao || !p.descricao.includes("[DESTINACAO:uso_interno]"))
        .map((p: any) => ({
          ...p,
          estoque: estoqueMap[p.id] !== undefined ? Math.max(0, estoqueMap[p.id]) : 0,
        }));

      setClientes(clientesRes.data || []);
      setProdutos(prods);
    } catch {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }

  const handlePixFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isMulti: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem válida.");
      return;
    }

    if (isMulti) setUploadingPixMulti(true);
    else setUploadingPix(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `venda_pix_${Date.now()}.${fileExt}`;
      const filePath = `comprovantes/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("comprovantes_pix")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (isMulti) setNovoPixMultiUrl(reader.result as string);
          else setComprovantePixUrl(reader.result as string);
          toast.success("Foto do comprovante Pix anexada!");
          if (isMulti) setUploadingPixMulti(false);
          else setUploadingPix(false);
        };
        reader.readAsDataURL(file);
        return;
      }

      const { data: publicUrlData } = supabase.storage.from("comprovantes_pix").getPublicUrl(filePath);
      if (isMulti) setNovoPixMultiUrl(publicUrlData.publicUrl);
      else setComprovantePixUrl(publicUrlData.publicUrl);
      toast.success("Foto do comprovante Pix anexada com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao carregar imagem");
    } finally {
      if (isMulti) setUploadingPixMulti(false);
      else setUploadingPix(false);
    }
  };

  function handleAddItem(prodOverride?: ProdutoGaleria, qtdOverride?: number) {
    const produtoTarget = prodOverride || produtos.find((p) => p.id === selectedProdutoId);
    if (!produtoTarget) { toast.error("Selecione um produto"); return; }
    const qtdTarget = qtdOverride || quantidade;

    const existente = itens.find((i) => i.produto.id === produtoTarget.id);
    const qtdTotal = (existente?.quantidade || 0) + qtdTarget;

    if (qtdTotal > produtoTarget.estoque) {
      toast.error(`Estoque insuficiente. Disponível: ${produtoTarget.estoque}`);
      return;
    }

    if (existente) {
      setItens(itens.map((i) => (i.produto.id === produtoTarget.id ? { ...i, quantidade: qtdTotal } : i)));
    } else {
      setItens([...itens, { produto: produtoTarget, quantidade: qtdTarget }]);
    }

    setSelectedProdutoId("");
    setQuantidade(1);
    toast.success(`${produtoTarget.nome} adicionado!`);
  }

  function handleRemoveItem(produtoId: string) {
    setItens(itens.filter((i) => i.produto.id !== produtoId));
  }

  const subtotal = itens.reduce((sum, item) => sum + item.produto.preco * item.quantidade, 0);
  const total = Math.max(0, subtotal - desconto);

  const valEntregueNum = parseFloat(valorEntregueDinheiro) || 0;
  const trocoDevolver = Math.max(0, valEntregueNum - total);

  const valPagoPixNum = parseFloat(valorPagoPix) || 0;

  const somaMultiplos = pagamentosMultiplos.reduce((acc, p) => acc + p.valor, 0);
  const saldoRestanteMultiplo = Math.max(0, total - somaMultiplos);

  const handleAddMultiPagamento = () => {
    const v = parseFloat(novoValorMulti);
    if (!v || v <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }

    if (somaMultiplos + v > total + 0.01) {
      toast.error(`⚠️ O valor informado (R$ ${v.toFixed(2)}) ultrapassa o saldo restante (R$ ${saldoRestanteMultiplo.toFixed(2)})!`);
      return;
    }

    if (novaFormaMulti === "pix" && !novoPixMultiUrl) {
      toast.error("⚠️ É OBRIGATÓRIO anexar a foto do comprovante para pagamentos em PIX!");
      return;
    }

    setPagamentosMultiplos((prev) => [
      ...prev,
      {
        forma: novaFormaMulti,
        valor: v,
        comprovante_pix: novaFormaMulti === "pix" ? novoPixMultiUrl : undefined,
        codigo_nsu: (novaFormaMulti === "credito" || novaFormaMulti === "debito") ? novoNsuMultiCode : undefined,
      },
    ]);

    setNovoValorMulti("");
    setNovoPixMultiUrl("");
    setNovoNsuMultiCode("");
    toast.success(`Forma ${novaFormaMulti.toUpperCase()} de R$ ${v.toFixed(2)} adicionada!`);
  };

  const handleRemoveMultiPagamento = (idx: number) => {
    setPagamentosMultiplos((prev) => prev.filter((_, i) => i !== idx));
  };

  async function onSubmit(values: z.infer<typeof clienteSchema>) {
    if (itens.length === 0) {
      toast.error("Adicione pelo menos um produto");
      return;
    }

    // --- TRAVAS RIGOROSAS DE VALIDAÇÃO FINANCEIRA ---
    if (formaPagamento === "pix") {
      if (!comprovantePixUrl) {
        toast.error("⚠️ Foto Obrigatória: É OBRIGATÓRIO anexar a FOTO/PRINT do comprovante Pix para finalizar a venda!");
        return;
      }

      if (!valorPagoPix || valPagoPixNum <= 0) {
        toast.error("⚠️ Valor do Pix Obrigatório: Informe o valor exato pago via Pix!");
        return;
      }

      if (valPagoPixNum < total - 0.05) {
        const falta = total - valPagoPixNum;
        toast.error(`⚠️ Pix Insuficiente: O valor informado (R$ ${valPagoPixNum.toFixed(2)}) é menor que o total da venda (R$ ${total.toFixed(2)}). Faltam R$ ${falta.toFixed(2)}!`);
        return;
      }
    }

    if (formaPagamento === "multiplo") {
      if (pagamentosMultiplos.length === 0) {
        toast.error("⚠️ Adicione pelo menos uma forma de pagamento no fracionamento!");
        return;
      }

      const pixSemFoto = pagamentosMultiplos.find((p) => p.forma === "pix" && !p.comprovante_pix);
      if (pixSemFoto) {
        toast.error("⚠️ Foto do Pix Faltando: Todas as frações pagas via PIX precisam da foto do comprovante anexada!");
        return;
      }

      const diff = Math.abs(somaMultiplos - total);
      if (diff > 0.05) {
        if (somaMultiplos < total) {
          const falta = total - somaMultiplos;
          toast.error(`⚠️ Pagamento Incompleto: A soma dos pagamentos (R$ ${somaMultiplos.toFixed(2)}) é menor que o total (R$ ${total.toFixed(2)}). Faltam R$ ${falta.toFixed(2)}!`);
        } else {
          const excede = somaMultiplos - total;
          toast.error(`⚠️ Valor Excedente: A soma dos pagamentos (R$ ${somaMultiplos.toFixed(2)}) ultrapassa o total (R$ ${total.toFixed(2)}) em R$ ${excede.toFixed(2)}!`);
        }
        return;
      }
    }

    if (formaPagamento === "dinheiro" && valEntregueNum < total) {
      const falta = total - valEntregueNum;
      toast.error(`⚠️ Dinheiro Insuficiente: O valor entregue pelo cliente (R$ ${valEntregueNum.toFixed(2)}) é menor que o total da venda (R$ ${total.toFixed(2)}). Faltam R$ ${falta.toFixed(2)}!`);
      return;
    }

    setSaving(true);
    try {
      let formaPagamentoFinal = formaPagamento;
      if (formaPagamento === "pix") {
        formaPagamentoFinal = `Pix (Valor Pago: R$ ${valPagoPixNum.toFixed(2)})`;
      } else if (pagamentosMultiplos.length > 0) {
        formaPagamentoFinal = `Múltiplo: ${pagamentosMultiplos.map(p => {
          let details = `${p.forma.toUpperCase()} R$${p.valor.toFixed(2)}`;
          if (p.codigo_nsu) details += ` (NSU: ${p.codigo_nsu})`;
          return details;
        }).join(" + ")}`;
      } else if (formaPagamento === "dinheiro" && trocoDevolver > 0) {
        formaPagamentoFinal = `Dinheiro (Entregue: R$${valEntregueNum.toFixed(2)} | Troco: R$${trocoDevolver.toFixed(2)})`;
      }

      const comandaPayload: any = {
        empresa_id: empresaId || "93d24bc4-e371-4395-8ed8-636d02575de6",
        cliente_id: values.cliente_id,
        unidade_id: selectedUnidadeId || null,
        status: "fechada",
        subtotal,
        desconto,
        total,
        forma_pagamento: formaPagamentoFinal,
        fechada_em: new Date().toISOString(),
      };

      if (comprovantePixUrl) comandaPayload.comprovante_pix_url = comprovantePixUrl;
      if (codigoNsuCartao) comandaPayload.codigo_autorizacao_nsu = codigoNsuCartao;

      // Criar a comanda fechada defensivamente
      let { data: comandaData, error: comandaError } = await supabase
        .from("comandas")
        .insert(comandaPayload)
        .select()
        .single();

      if (comandaError && comandaError.message?.includes("column")) {
        delete comandaPayload.comprovante_pix_url;
        delete comandaPayload.codigo_autorizacao_nsu;
        const resDefensivo = await supabase.from("comandas").insert(comandaPayload).select().single();
        if (resDefensivo.error) throw resDefensivo.error;
        comandaData = resDefensivo.data;
      } else if (comandaError) {
        throw comandaError;
      }

      // Inserir os itens na comanda e dar baixa no estoque
      for (const item of itens) {
        await supabase.from("comanda_itens").insert({
          comanda_id: comandaData.id,
          tipo: "produto",
          produto_id: item.produto.id,
          nome: item.produto.nome,
          quantidade: item.quantidade,
          preco_unitario: item.produto.preco,
          subtotal: item.produto.preco * item.quantidade,
          empresa_id: empresaId || "93d24bc4-e371-4395-8ed8-636d02575de6",
        });

        const targetUnidadeId = selectedUnidadeId || "a1346ecc-b354-4b15-8e05-8a980d3bd55e";
        const novoEstoque = Math.max(0, item.produto.estoque - item.quantidade);

        await supabase
          .from("estoque_filial")
          .upsert({
            empresa_id: empresaId || "93d24bc4-e371-4395-8ed8-636d02575de6",
            unidade_id: targetUnidadeId,
            produto_id: item.produto.id,
            quantidade: novoEstoque,
            updated_at: new Date().toISOString()
          }, { onConflict: "unidade_id,produto_id" });

        await supabase.from("estoque_movimentacoes").insert({
          produto_id: item.produto.id,
          tipo: "saida",
          quantidade: item.quantidade,
          observacao: `Venda Manual de Balcão #${comandaData.id.slice(0, 8)}`,
          unidade_id: targetUnidadeId,
          empresa_id: empresaId || "93d24bc4-e371-4395-8ed8-636d02575de6",
        });
      }

      toast.success("Venda manual finalizada com sucesso!");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao realizar venda manual");
    } finally {
      setSaving(false);
    }
  }

  const paymentMethods = [
    { id: "dinheiro", label: "Dinheiro", icon: Banknote, color: "text-emerald-500" },
    { id: "pix", label: "Pix", icon: QrCode, color: "text-cyan-500" },
    { id: "credito", label: "Crédito", icon: CreditCard, color: "text-blue-500" },
    { id: "debito", label: "Débito", icon: Wallet, color: "text-indigo-500" },
    { id: "multiplo", label: "Múltiplo", icon: Plus, color: "text-purple-500" },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto bg-background text-foreground border border-border p-6 shadow-2xl rounded-2xl">
          <DialogHeader className="border-b border-border pb-4">
            <DialogTitle className="flex items-center gap-3 text-foreground">
              <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-md">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Nova Venda Manual de Balcão</h2>
                <p className="text-xs text-muted-foreground font-semibold">Lançamento direto de produtos no caixa</p>
              </div>
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-red-600" />
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-2">
                {/* Seleção do Cliente */}
                <FormField
                  control={form.control}
                  name="cliente_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold text-foreground uppercase tracking-wider">Cliente da Venda *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-background text-foreground border-input text-xs h-9 font-semibold">
                            <SelectValue placeholder="Selecione o cliente..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clientes.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.nome} ({c.telefone})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Seleção de Produtos com Galeria Visual */}
                <div className="space-y-3 bg-muted/40 p-4 rounded-xl border border-border shadow-sm">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-foreground uppercase tracking-wider">Adicionar Produto</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setGaleriaOpen(true)}
                      className="text-xs h-8 border-red-600/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 font-bold px-3 shadow-sm"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Produtos
                    </Button>
                  </div>

                  <div className="flex gap-2">
                    <Select value={selectedProdutoId} onValueChange={setSelectedProdutoId}>
                      <SelectTrigger className="flex-1 bg-background text-foreground border-input text-xs h-9 font-semibold">
                        <SelectValue placeholder="Selecione o produto..." />
                      </SelectTrigger>
                      <SelectContent>
                        {produtos.map((p) => (
                          <SelectItem key={p.id} value={p.id} disabled={p.estoque <= 0}>
                            {p.nome} - R$ {Number(p.preco).toFixed(2)} ({p.estoque > 0 ? `${p.estoque} un` : "Esgotado"})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Input
                      type="number"
                      min={1}
                      value={quantidade}
                      onChange={(e) => setQuantidade(parseInt(e.target.value) || 1)}
                      className="w-16 bg-background text-foreground border-input text-xs h-9 text-center font-bold"
                    />

                    <Button type="button" onClick={() => handleAddItem()} className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold h-9 px-4 shrink-0 shadow-sm">
                      <Plus className="h-4 w-4 mr-1" /> Lançar
                    </Button>
                  </div>
                </div>

                {/* Tabela de Produtos Discriminados */}
                <div className="border border-border rounded-xl overflow-hidden bg-background">
                  <Table>
                    <TableHeader className="bg-muted/60">
                      <TableRow>
                        <TableHead className="text-xs font-bold text-foreground">Produto</TableHead>
                        <TableHead className="text-xs font-bold text-center text-foreground">Qtd</TableHead>
                        <TableHead className="text-xs font-bold text-right text-foreground">Unitário</TableHead>
                        <TableHead className="text-xs font-bold text-right text-foreground">Subtotal</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itens.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-xs text-muted-foreground font-medium">
                            Nenhum produto adicionado.
                          </TableCell>
                        </TableRow>
                      ) : (
                        itens.map((item) => (
                          <TableRow key={item.produto.id} className="hover:bg-muted/30 border-b border-border">
                            <TableCell className="text-xs font-bold text-foreground py-3">{item.produto.nome}</TableCell>
                            <TableCell className="text-xs text-center font-mono font-bold text-foreground">{item.quantidade}</TableCell>
                            <TableCell className="text-xs text-right font-medium text-foreground">R$ {Number(item.produto.preco).toFixed(2)}</TableCell>
                            <TableCell className="text-xs text-right font-bold text-foreground">R$ {(item.produto.preco * item.quantidade).toFixed(2)}</TableCell>
                            <TableCell>
                              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleRemoveItem(item.produto.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Totais Finaceiros */}
                <div className="bg-muted/30 p-3.5 rounded-xl border border-border space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground font-semibold">
                    <span>Subtotal Bruto:</span>
                    <span className="text-foreground font-bold">R$ {subtotal.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between items-center text-xs text-muted-foreground font-semibold">
                    <span>Desconto (R$):</span>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      max={subtotal}
                      value={desconto}
                      onChange={(e) => setDesconto(parseFloat(e.target.value) || 0)}
                      className="w-24 bg-background text-foreground border-input text-xs h-7 text-right font-bold"
                    />
                  </div>

                  <div className="flex justify-between items-center text-base font-black text-foreground border-t border-border pt-2">
                    <span className="text-sm font-bold text-foreground">Total da Venda:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-black text-2xl">R$ {total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Forma de Pagamento com Pílulas Luxo */}
                <div className="space-y-3 pt-2">
                  <Label className="text-xs font-bold text-foreground uppercase tracking-wider">Forma de Pagamento</Label>
                  
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {paymentMethods.map((pm) => {
                      const Icon = pm.icon;
                      const isSelected = formaPagamento === pm.id;
                      return (
                        <button
                          key={pm.id}
                          type="button"
                          onClick={() => setFormaPagamento(pm.id)}
                          className={cn(
                            "flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition-all duration-200 gap-1.5",
                            isSelected
                              ? "bg-red-600 border-red-600 text-white shadow-lg scale-[1.02]"
                              : "bg-muted/40 border-border text-foreground hover:bg-muted font-bold"
                          )}
                        >
                          <Icon className={cn("h-4 w-4", isSelected ? "text-white" : pm.color)} />
                          <span>{pm.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Dinheiro (Calculadora de Troco) */}
                  {formaPagamento === "dinheiro" && (
                    <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-500/40 rounded-xl space-y-2 animate-fade-in">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[11px] font-bold text-foreground">Valor Entregue pelo Cliente (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder={`Ex: ${(total + 20).toFixed(2)}`}
                            value={valorEntregueDinheiro}
                            onChange={(e) => setValorEntregueDinheiro(e.target.value)}
                            className="bg-background text-foreground border-emerald-500/50 text-xs font-bold h-9"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Troco a Devolver</Label>
                          <div className="h-9 px-3 bg-background rounded-lg border border-emerald-500/50 flex items-center font-black text-emerald-600 dark:text-emerald-400 text-sm">
                            R$ {trocoDevolver.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Pix com Upload Obrigatorio + Valor Pago Obrigatorio */}
                  {formaPagamento === "pix" && (
                    <div className="p-3.5 bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-500/40 rounded-xl space-y-3 animate-fade-in">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[11px] font-bold text-foreground flex items-center gap-1">
                            Valor Pago no Pix (R$) <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder={`Ex: ${total.toFixed(2)}`}
                            value={valorPagoPix}
                            onChange={(e) => setValorPagoPix(e.target.value)}
                            className="bg-background text-foreground border-cyan-500/50 text-xs font-bold h-9"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[11px] font-bold text-foreground">Status de Conferência</Label>
                          <div className={cn(
                            "h-9 px-3 rounded-lg border flex items-center text-xs font-bold",
                            comprovantePixUrl && valPagoPixNum >= total - 0.05
                              ? "bg-emerald-50 text-emerald-700 border-emerald-500/50"
                              : "bg-amber-50 text-amber-700 border-amber-500/50"
                          )}>
                            {comprovantePixUrl && valPagoPixNum >= total - 0.05
                              ? "✓ Comprovante OK e Valor Quitado"
                              : "⚠️ Foto e Valor Obrigatórios"}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold text-cyan-800 dark:text-cyan-300 flex items-center gap-1.5">
                            <QrCode className="h-4 w-4 text-cyan-600 dark:text-cyan-400" /> Foto do Comprovante Pix (Obrigatória <span className="text-red-500">*</span>)
                          </Label>
                          {comprovantePixUrl && (
                            <Badge variant="outline" className="text-[10px] border-emerald-500/50 text-emerald-700 dark:text-emerald-400 bg-emerald-50 font-bold">
                              ✓ Foto Anexada
                            </Badge>
                          )}
                        </div>

                        {comprovantePixUrl ? (
                          <div className="relative rounded-xl border border-cyan-500/40 overflow-hidden bg-background p-2 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-border bg-slate-900 shrink-0">
                                <img src={comprovantePixUrl} alt="Comprovante Pix" className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => { setPreviewImageUrl(comprovantePixUrl); setImagePreviewOpen(true); }}
                                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                >
                                  <ZoomIn className="h-4 w-4 text-white" />
                                </button>
                              </div>
                              <div>
                                <p className="text-xs font-bold text-foreground">Comprovante Anexado com Sucesso</p>
                                <button
                                  type="button"
                                  onClick={() => { setPreviewImageUrl(comprovantePixUrl); setImagePreviewOpen(true); }}
                                  className="text-[11px] text-cyan-600 dark:text-cyan-400 font-bold hover:underline flex items-center gap-1 mt-0.5"
                                >
                                  <ZoomIn className="h-3 w-3" /> Clique para expandir foto
                                </button>
                              </div>
                            </div>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setComprovantePixUrl("")}
                              className="text-xs text-red-600 dark:text-red-400 hover:bg-red-50 font-bold"
                            >
                              <X className="h-4 w-4 mr-1" /> Trocar Foto
                            </Button>
                          </div>
                        ) : (
                          <div className="relative border-2 border-dashed border-cyan-500/50 hover:border-cyan-600 rounded-xl p-4 text-center transition-colors bg-background">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handlePixFileUpload(e, false)}
                              disabled={uploadingPix}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className="flex flex-col items-center justify-center space-y-1.5">
                              {uploadingPix ? (
                                <Loader2 className="h-7 w-7 animate-spin text-cyan-600" />
                              ) : (
                                <Upload className="h-7 w-7 text-cyan-600 dark:text-cyan-400" />
                              )}
                              <p className="text-xs font-bold text-foreground">
                                {uploadingPix ? "Enviando Imagem..." : "Clique ou arraste a FOTO/PRINT do Comprovante Pix (OBRIGATÓRIO)"}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Cartao de Credito/Debito (NSU) */}
                  {(formaPagamento === "credito" || formaPagamento === "debito") && (
                    <div className="space-y-1.5 animate-fade-in">
                      <Label className="text-[11px] font-bold text-foreground">Código de Autorização / NSU da Maquineta</Label>
                      <Input
                        placeholder="Ex: 849302 ou 4 últimos dígitos do cartão..."
                        value={codigoNsuCartao}
                        onChange={(e) => setCodigoNsuCartao(e.target.value)}
                        className="bg-background text-foreground border-input text-xs h-9 font-semibold"
                      />
                    </div>
                  )}

                  {/* Divisao Multipla */}
                  {formaPagamento === "multiplo" && (
                    <div className="p-4 bg-muted/40 rounded-xl border border-purple-500/40 space-y-3 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Plus className="h-4 w-4 text-purple-600 dark:text-purple-400" /> Divisão Múltipla & Comprovantes Fracionados
                        </Label>
                        <Badge variant="outline" className={cn(
                          "text-xs font-bold",
                          Math.abs(somaMultiplos - total) < 0.01 ? "border-emerald-600 text-emerald-600 bg-emerald-50" : "border-amber-600 text-amber-600 bg-amber-50"
                        )}>
                          Soma: R$ {somaMultiplos.toFixed(2)} / R$ {total.toFixed(2)}
                        </Badge>
                      </div>

                      {saldoRestanteMultiplo > 0.01 && (
                        <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          <span>Faltam R$ {saldoRestanteMultiplo.toFixed(2)} para quitar o valor total da venda!</span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-foreground uppercase">Forma</Label>
                          <Select value={novaFormaMulti} onValueChange={setNovaFormaMulti}>
                            <SelectTrigger className="bg-background text-foreground border-input text-xs h-9 font-bold">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pix">📱 Pix</SelectItem>
                              <SelectItem value="dinheiro">💵 Dinheiro</SelectItem>
                              <SelectItem value="credito">💳 Crédito</SelectItem>
                              <SelectItem value="debito">💳 Débito</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-foreground uppercase">Valor Fracionado (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder={`Sugerido: R$ ${saldoRestanteMultiplo.toFixed(2)}`}
                            value={novoValorMulti}
                            onChange={(e) => setNovoValorMulti(e.target.value)}
                            className="bg-background text-foreground border-input text-xs h-9 font-bold"
                          />
                        </div>
                      </div>

                      {novaFormaMulti === "pix" && (
                        <div className="p-2.5 bg-background rounded-xl border border-cyan-500/40 space-y-2">
                          <Label className="text-[11px] font-bold text-foreground">
                            Foto do Comprovante Pix desta Fracão <span className="text-red-500">*</span>
                          </Label>
                          {novoPixMultiUrl ? (
                            <div className="flex items-center justify-between text-xs bg-cyan-50 dark:bg-cyan-950/40 p-2 rounded-lg border border-cyan-500/40">
                              <span className="text-cyan-700 dark:text-cyan-300 font-bold">✓ Foto Anexada</span>
                              <Button type="button" variant="ghost" size="sm" onClick={() => setNovoPixMultiUrl("")} className="h-6 text-red-600 font-bold">
                                Remover
                              </Button>
                            </div>
                          ) : (
                            <div className="relative border border-dashed border-cyan-500/40 rounded-lg p-2.5 text-center bg-cyan-50/50 dark:bg-cyan-950/20">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handlePixFileUpload(e, true)}
                                disabled={uploadingPixMulti}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                              />
                              <span className="text-xs font-bold text-cyan-700 dark:text-cyan-400">
                                {uploadingPixMulti ? "Enviando..." : "+ Clique para Anexar Foto do Pix (OBRIGATÓRIO)"}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {(novaFormaMulti === "credito" || novaFormaMulti === "debito") && (
                        <div className="space-y-1">
                          <Label className="text-[11px] font-bold text-foreground">NSU / Autorização Maquineta desta Fracão</Label>
                          <Input
                            placeholder="Código NSU desta transação..."
                            value={novoNsuMultiCode}
                            onChange={(e) => setNovoNsuMultiCode(e.target.value)}
                            className="bg-background text-foreground border-input text-xs h-9 font-semibold"
                          />
                        </div>
                      )}

                      <Button type="button" onClick={handleAddMultiPagamento} className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold w-full h-9 mt-1 shadow-sm">
                        <Plus className="h-4 w-4 mr-1.5" /> Adicionar Esta Forma ao Pagamento
                      </Button>

                      {pagamentosMultiplos.length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-border">
                          <Label className="text-[11px] font-bold text-foreground uppercase">Formas Adicionadas:</Label>
                          {pagamentosMultiplos.map((p, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs bg-background p-2.5 rounded-lg border border-border">
                              <div>
                                <span className="font-bold uppercase text-foreground">{p.forma}: R$ {p.valor.toFixed(2)}</span>
                                {p.codigo_nsu && <p className="text-[10px] text-blue-600 dark:text-blue-400 font-mono font-bold">NSU: {p.codigo_nsu}</p>}
                                {p.comprovante_pix && (
                                  <button
                                    type="button"
                                    onClick={() => { setPreviewImageUrl(p.comprovante_pix!); setImagePreviewOpen(true); }}
                                    className="text-[10px] text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 font-bold mt-0.5"
                                  >
                                    <ZoomIn className="h-3 w-3" /> Ver Foto do Pix
                                  </button>
                                )}
                              </div>
                              <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-red-600 hover:bg-red-50" onClick={() => handleRemoveMultiPagamento(idx)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Rodapé de Ações */}
                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="text-xs font-bold border-border">
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving || itens.length === 0} className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs h-11 px-6 shadow-lg">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                    Finalizar Venda & Dar Baixa no Estoque
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Zoom de Foto */}
      {imagePreviewOpen && previewImageUrl && (
        <Dialog open={imagePreviewOpen} onOpenChange={setImagePreviewOpen}>
          <DialogContent className="sm:max-w-xl bg-background border-border p-4">
            <DialogHeader className="flex justify-between items-center pb-2">
              <DialogTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <QrCode className="h-4 w-4 text-cyan-600 dark:text-cyan-400" /> Foto Ampliada do Comprovante Pix
              </DialogTitle>
            </DialogHeader>
            <div className="max-h-[75vh] overflow-auto flex items-center justify-center p-2 rounded-xl bg-slate-950 border border-border">
              <img src={previewImageUrl} alt="Comprovante Pix Expandido" className="max-w-full h-auto object-contain rounded-lg shadow-2xl" />
            </div>
          </DialogContent>
        </Dialog>
      )}

      <ProdutoGaleriaDialog
        open={galeriaOpen}
        onOpenChange={setGaleriaOpen}
        produtos={produtos}
        onSelectProduto={(prod, qtd) => {
          handleAddItem(prod, qtd);
        }}
      />
    </>
  );
}
