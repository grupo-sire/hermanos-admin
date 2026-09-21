import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Loader2, CreditCard, Banknote, QrCode, Wallet, Check, Crown, Grid, DollarSign, Save, ShoppingBag, Scissors, Package, Sparkles, Upload, Image as ImageIcon, X, ZoomIn, AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { ProdutoGaleriaDialog, ProdutoGaleria } from "./ProdutoGaleriaDialog";
import { CaixaGestaoDialog } from "./CaixaGestaoDialog";
import { getCaixaSessao } from "@/services/caixaService";
import { Lock } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type ComandaItem = {
  id: string;
  tipo: string;
  servico_id: string | null;
  produto_id: string | null;
  nome: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
};

type Comanda = {
  id: string;
  agendamento_id: string | null;
  status: string;
  subtotal: number;
  desconto: number;
  total: number;
  forma_pagamento: string | null;
  comprovante_pix_url?: string | null;
  codigo_autorizacao_nsu?: string | null;
  clientes?: { nome: string; telefone: string };
  cliente_id?: string;
  empresa_id?: string;
  unidade_id?: string | null;
  fechada_em?: string | null;
};

type Servico = { id: string; nome: string; preco: number; duracao_minutos?: number };

interface PagamentoDivisao {
  forma: string;
  valor: number;
  comprovante_pix?: string;
  codigo_nsu?: string;
}

interface ComandaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comanda: Comanda | null;
  onSuccess: () => void;
}

export function ComandaDialog({ open, onOpenChange, comanda, onSuccess }: ComandaDialogProps) {
  const [itens, setItens] = useState<ComandaItem[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [produtos, setProdutos] = useState<ProdutoGaleria[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [novoServicoId, setNovoServicoId] = useState("");
  const [novaQuantidade, setNovaQuantidade] = useState(1);

  const [descontoPercent, setDescontoPercent] = useState(0);
  const [formaPagamento, setFormaPagamento] = useState<string>("pix");
  const [formaPagamentoRestante, setFormaPagamentoRestante] = useState<string>("pix");

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

  const [clienteAssinatura, setClienteAssinatura] = useState<{ plano: string; status: string } | null>(null);
  const [galeriaOpen, setGaleriaOpen] = useState(false);
  const [caixaGestaoOpen, setCaixaGestaoOpen] = useState(false);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState("");

  const { empresaId } = useEmpresa();
  const { selectedUnidadeId } = useUnidade();

  useEffect(() => {
    if (open && comanda) {
      fetchData();
    }
  }, [open, comanda]);

  async function fetchData() {
    if (!comanda) return;
    setLoading(true);

    try {
      const targetUnidadeId = comanda.unidade_id || selectedUnidadeId;

      const [itensRes, servicosRes, produtosRes, estFilialRes, clienteRes] = await Promise.all([
        supabase.from("comanda_itens").select("*").eq("comanda_id", comanda.id),
        supabase.from("servicos").select("id, nome, preco, duracao_minutos").eq("status", "active"),
        supabase.from("produtos").select("id, nome, preco, estoque, imagem_url, descricao").eq("status", "active"),
        targetUnidadeId
          ? supabase.from("estoque_filial").select("produto_id, quantidade").eq("unidade_id", targetUnidadeId)
          : Promise.resolve({ data: null, error: null }),
        comanda.cliente_id
          ? supabase.from("clientes").select("plano_assinatura, status_assinatura").eq("id", comanda.cliente_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (clienteRes?.data && (clienteRes.data as any).plano_assinatura) {
        const isAtivo = (clienteRes.data as any).status_assinatura === "ativo" || (clienteRes.data as any).status_assinatura === "active";
        setClienteAssinatura({
          plano: (clienteRes.data as any).plano_assinatura,
          status: isAtivo ? "ativo" : "inativo"
        });

        if (isAtivo) {
          setFormaPagamento("planos_infinite");
        }
      } else {
        setClienteAssinatura(null);
      }

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

      let loadedItens = itensRes.data || [];

      // Auto-healing: Se a comanda estiver sem itens e tiver agendamento vinculado, carregar os serviços do agendamento!
      if (loadedItens.length === 0 && comanda.agendamento_id) {
        const { data: agData } = await supabase
          .from("agendamentos")
          .select("id, servico_id, servicos(id, nome, preco), agendamento_servicos(id, servico_id, nome, preco)")
          .eq("id", comanda.agendamento_id)
          .maybeSingle();

        if (agData) {
          const itensToInsert: any[] = [];
          if (agData.servicos && (agData.servicos as any).nome) {
            const pr = Number((agData.servicos as any).preco) || 0;
            itensToInsert.push({
              comanda_id: comanda.id,
              tipo: "servico",
              servico_id: (agData.servicos as any).id || agData.servico_id,
              nome: (agData.servicos as any).nome,
              quantidade: 1,
              preco_unitario: pr,
              subtotal: pr,
              empresa_id: empresaId || "93d24bc4-e371-4395-8ed8-636d02575de6",
            });
          }

          if (agData.agendamento_servicos && (agData.agendamento_servicos as any[]).length > 0) {
            (agData.agendamento_servicos as any[]).forEach((as: any) => {
              const pr = Number(as.preco) || 0;
              const exists = itensToInsert.some(i => i.servico_id === as.servico_id && i.nome === as.nome);
              if (!exists) {
                itensToInsert.push({
                  comanda_id: comanda.id,
                  tipo: "servico",
                  servico_id: as.servico_id,
                  nome: as.nome,
                  quantidade: 1,
                  preco_unitario: pr,
                  subtotal: pr,
                  empresa_id: empresaId || "93d24bc4-e371-4395-8ed8-636d02575de6",
                });
              }
            });
          }

          if (itensToInsert.length > 0) {
            const { data: createdItens } = await supabase
              .from("comanda_itens")
              .insert(itensToInsert)
              .select();

            if (createdItens) loadedItens = createdItens;
          }
        }
      }

      setItens(loadedItens);
      setServicos(servicosRes.data || []);
      setProdutos(prods);

      const sub = loadedItens.reduce((acc: number, i: any) => acc + Number(i.subtotal), 0);
      const storedDesconto = Number(comanda.desconto) || 0;
      setDescontoPercent(sub > 0 ? Math.round((storedDesconto / sub) * 100 * 100) / 100 : 0);
      setFormaPagamento(comanda.forma_pagamento || (clienteAssinatura?.status === "ativo" ? "planos_infinite" : "pix"));
      setPagamentosMultiplos([]);
      setValorEntregueDinheiro("");
      setValorPagoPix("");
      setComprovantePixUrl(comanda.comprovante_pix_url || "");
      setCodigoNsuCartao(comanda.codigo_autorizacao_nsu || "");
    } catch (error: any) {
      console.error("Erro ao carregar dados:", error);
      toast.error(error.message || "Erro ao carregar dados da comanda");
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
      const fileName = `pix_${comanda?.id}_${Date.now()}.${fileExt}`;
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

  const subtotal = itens.reduce((acc, item) => acc + Number(item.subtotal), 0);
  const totalServicos = itens.reduce((acc, item) => item.tipo === "servico" ? acc + Number(item.subtotal) : acc, 0);
  const totalProdutos = itens.reduce((acc, item) => item.tipo === "produto" ? acc + Number(item.subtotal) : acc, 0);

  const isClienteInfinite = Boolean(
    comanda?.clientes?.observacoes?.includes("VINDI_INFINITE") ||
    (comanda?.clientes as any)?.is_infinite
  );

  const servicosCoincidentesPlano = itens.reduce((acc, item) => {
    if (item.tipo === "servico") {
      const isNomeInfinite = (item.nome || "").toUpperCase().includes("INFINITE");
      if (formaPagamento === "planos_infinite" || isNomeInfinite || isClienteInfinite) {
        return acc + Number(item.subtotal);
      }
    }
    return acc;
  }, 0);

  const descontoPlano = servicosCoincidentesPlano;
  const descontoManual = (subtotal * descontoPercent) / 100;
  const descontoAbs = Math.max(descontoPlano, descontoManual);

  const total = formaPagamento === "multiplo"
    ? Math.max(0, subtotal - (subtotal * descontoPercent) / 100)
    : Math.max(0, subtotal - descontoAbs);

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
      toast.error(`⚠️ O valor informado (R$ ${v.toFixed(2)}) ultrapassa o saldo restante da comanda (R$ ${saldoRestanteMultiplo.toFixed(2)})!`);
      return;
    }

    if (novaFormaMulti === "pix" && !novoPixMultiUrl) {
      toast.error("⚠️ Para adicionar um pagamento em PIX na fração, é OBRIGATÓRIO anexar a foto do comprovante!");
      return;
    }

    if (novaFormaMulti === "credito" || novaFormaMulti === "debito") {
      const cleanNsu = (novoNsuMultiCode || "").trim();
      if (!cleanNsu) {
        toast.error("⚠️ Código NSU Obrigatório: Informe o código de autorização/NSU da maquineta para esta fração!");
        return;
      }
      if (cleanNsu.length < 4) {
        toast.error("⚠️ Código Inválido: O código NSU da maquineta deve conter pelo menos 4 dígitos/caracteres!");
        return;
      }
      if (pagamentosMultiplos.some(p => p.codigo_nsu && p.codigo_nsu.trim().toLowerCase() === cleanNsu.toLowerCase())) {
        toast.error(`⚠️ Código Repetido: O código NSU "${cleanNsu}" já foi inserido em outra fração desta mesma comanda!`);
        return;
      }
    }

    const labelForma = novaFormaMulti === "assinatura" ? "PLANO INFINITE" : novaFormaMulti.toUpperCase();

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

  const handleAddItem = async (itemOverride?: { id: string; tipo: "servico" | "produto"; quantidade: number }) => {
    if (!comanda) return;
    const targetType = itemOverride ? itemOverride.tipo : "servico";
    const targetId = itemOverride ? itemOverride.id : novoServicoId;
    const targetQtd = itemOverride ? itemOverride.quantidade : novaQuantidade;

    if (!targetId) return;

    if (targetType === "servico" && comanda.agendamento_id) {
      const servicoObj = servicos.find((s) => s.id === targetId);
      const duracaoExtra = (servicoObj?.duracao_minutos || 30) * targetQtd;

      const { data: agData } = await supabase
        .from("agendamentos")
        .select("id, barbeiro_id, data_hora, duracao_minutos, servico_id")
        .eq("id", comanda.agendamento_id)
        .maybeSingle();

      if (agData) {
        const novaDuracaoTotal = (agData.duracao_minutos || 30) + duracaoExtra;
        const agInicio = new Date(agData.data_hora);
        const agFimNovo = new Date(agInicio.getTime() + novaDuracaoTotal * 60000);

        const { data: conflitos } = await supabase
          .from("agendamentos")
          .select("id, data_hora, clientes(nome)")
          .eq("barbeiro_id", agData.barbeiro_id)
          .neq("id", agData.id)
          .neq("status", "cancelado")
          .gte("data_hora", agInicio.toISOString())
          .lt("data_hora", agFimNovo.toISOString());

        if (conflitos && conflitos.length > 0) {
          const proximoCliente = (conflitos[0].clientes as any)?.nome || "Próximo cliente";
          const proximoHora = format(new Date(conflitos[0].data_hora), "HH:mm");
          toast.error(`⚠️ Conflito de Agenda: O barbeiro tem agendamento para ${proximoCliente} às ${proximoHora}!`);
          return;
        }

        await supabase
          .from("agendamentos")
          .update({ duracao_minutos: novaDuracaoTotal })
          .eq("id", agData.id);

        if (servicoObj) {
          await supabase.from("agendamento_servicos").insert({
            agendamento_id: agData.id,
            servico_id: servicoObj.id,
            nome: servicoObj.nome,
            preco: servicoObj.preco,
            duracao_minutos: servicoObj.duracao_minutos || 30,
          });
        }

        toast.info(`⏱️ Agenda do barbeiro estendida para ${novaDuracaoTotal} min!`);
      }
    }

    const itemList = targetType === "servico" ? servicos : produtos;
    const item = itemList.find((i) => i.id === targetId);
    if (!item) return;

    const precoUnitario = Number(item.preco);
    const sub = precoUnitario * targetQtd;

    const newItem = {
      comanda_id: comanda.id,
      tipo: targetType,
      servico_id: targetType === "servico" ? targetId : null,
      produto_id: targetType === "produto" ? targetId : null,
      nome: item.nome,
      quantidade: targetQtd,
      preco_unitario: precoUnitario,
      subtotal: sub,
    };

    const { data, error } = await supabase.from("comanda_itens").insert(newItem).select().single();
    if (error) {
      toast.error("Erro ao adicionar item");
      return;
    }

    const newItens = [...itens, data];
    setItens(newItens);
    const newSubtotal = newItens.reduce((acc, i) => acc + Number(i.subtotal), 0);
    const newSubtotalComPlano = newItens.reduce((acc, item) => {
      if (formaPagamento === "planos_infinite" && item.tipo === "servico") return acc;
      return acc + Number(item.subtotal);
    }, 0);
    const newDesconto = formaPagamento === "planos_infinite"
      ? (newSubtotal - newSubtotalComPlano)
      : (newSubtotal * descontoPercent) / 100;
    const newTotal = Math.max(0, newSubtotal - newDesconto);

    await supabase.from("comandas").update({ subtotal: newSubtotal, desconto: newDesconto, total: newTotal }).eq("id", comanda.id);

    setNovoServicoId("");
    setNovaQuantidade(1);
    toast.success("Item adicionado com sucesso!");
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!comanda) return;
    const itemToRemove = itens.find((i) => i.id === itemId);
    const { error } = await supabase.from("comanda_itens").delete().eq("id", itemId);
    if (error) {
      toast.error("Erro ao remover item");
      return;
    }

    if (itemToRemove && itemToRemove.tipo === "servico" && itemToRemove.servico_id && comanda.agendamento_id) {
      await supabase
        .from("agendamento_servicos")
        .delete()
        .eq("agendamento_id", comanda.agendamento_id)
        .eq("servico_id", itemToRemove.servico_id);
    }

    const newItens = itens.filter((i) => i.id !== itemId);
    setItens(newItens);
    const newSubtotal = newItens.reduce((acc, i) => acc + Number(i.subtotal), 0);
    const newSubtotalComPlano = newItens.reduce((acc, item) => {
      if (formaPagamento === "planos_infinite" && item.tipo === "servico") return acc;
      return acc + Number(item.subtotal);
    }, 0);
    const newDesconto = formaPagamento === "planos_infinite"
      ? (newSubtotal - newSubtotalComPlano)
      : (newSubtotal * descontoPercent) / 100;
    const newTotal = Math.max(0, newSubtotal - newDesconto);

    await supabase.from("comandas").update({ subtotal: newSubtotal, desconto: newDesconto, total: newTotal }).eq("id", comanda.id);
    toast.success("Item removido");
  };

  const handleSalvarComanda = async () => {
    if (!comanda) return;
    setSaving(true);
    try {
      const totalFinal = Math.max(0, subtotal - descontoAbs);

      const updatePayload: any = {
        subtotal: Math.round(subtotal * 100) / 100,
        desconto: Math.round(descontoAbs * 100) / 100,
        total: Math.round(totalFinal * 100) / 100,
        forma_pagamento: formaPagamento,
      };

      if (comprovantePixUrl) updatePayload.comprovante_pix_url = comprovantePixUrl;
      if (codigoNsuCartao) updatePayload.codigo_autorizacao_nsu = codigoNsuCartao;

      let { error } = await supabase
        .from("comandas")
        .update(updatePayload)
        .eq("id", comanda.id);

      if (error && error.message?.includes("column")) {
        delete updatePayload.comprovante_pix_url;
        delete updatePayload.codigo_autorizacao_nsu;
        const resDefensivo = await supabase.from("comandas").update(updatePayload).eq("id", comanda.id);
        if (resDefensivo.error) throw resDefensivo.error;
      } else if (error) {
        throw error;
      }

      toast.success("Comanda salva com sucesso! O atendimento continua em aberto.");
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar comanda");
    } finally {
      setSaving(false);
    }
  };

  const handleFecharComanda = async () => {
    if (!comanda) return;

    // 0. TRAVA DE SEGURANÇA: BLOQUEAR QUITAÇÃO SE O CAIXA DO DIA ESTIVER FECHADO OU NÃO ABERTO
    const targetUnidadeCaixa = comanda.unidade_id || selectedUnidadeId;
    const caixaAtual = getCaixaSessao(targetUnidadeCaixa);

    if (caixaAtual?.status === "fechado") {
      toast.error("⚠️ Caixa Fechado: O caixa de hoje já foi homologado e fechado com 2FA. Não é permitido fechar comanda com o expediente encerrado!");
      return;
    }

    if (!caixaAtual) {
      toast.error("⚠️ Caixa Não Aberto: É necessário abrir o caixa do dia na aba de Checkout antes de fechar e receber comandas!");
      return;
    }

    // SE O TOTAL FOR R$ 0,00 (ATENDIMENTO 100% INCLUSO NO PLANO INFINITE OU CORTESIA)
    const isPlanoZero = formaPagamento === "planos_infinite" && total <= 0.01;

    if (!isPlanoZero) {
      // 1. Caso Plano Infinite com Produtos Restantes (> 0)
      if (formaPagamento === "planos_infinite" && total > 0.01) {
        if (formaPagamentoRestante === "pix") {
          if (!comprovantePixUrl) {
            toast.error("⚠️ Foto Obrigatória: É OBRIGATÓRIO anexar a foto do comprovante Pix para o valor dos produtos!");
            return;
          }
          if (!valorPagoPix || valPagoPixNum <= 0) {
            toast.error("⚠️ Valor do Pix Obrigatório: Informe o valor exato pago via Pix para os produtos!");
            return;
          }
          if (valPagoPixNum < total - 0.05) {
            const falta = total - valPagoPixNum;
            toast.error(`⚠️ Pix Insuficiente: Faltam R$ ${falta.toFixed(2)} para quitar os produtos da comanda!`);
            return;
          }
        }
        if (formaPagamentoRestante === "dinheiro" && valEntregueNum < total) {
          const falta = total - valEntregueNum;
          toast.error(`⚠️ Dinheiro Insuficiente: O valor entregue pelo cliente (R$ ${valEntregueNum.toFixed(2)}) é menor que o valor dos produtos (R$ ${total.toFixed(2)}). Faltam R$ ${falta.toFixed(2)}!`);
          return;
        }
      }

      // 2. Caso Pix Normal
      if (formaPagamento === "pix") {
        if (!comprovantePixUrl) {
          toast.error("⚠️ Foto Obrigatória: É OBRIGATÓRIO anexar a FOTO/PRINT do comprovante Pix para fechar a comanda!");
          return;
        }
        if (!valorPagoPix || valPagoPixNum <= 0) {
          toast.error("⚠️ Valor do Pix Obrigatório: Informe o valor exato pago via Pix!");
          return;
        }
        if (valPagoPixNum < total - 0.05) {
          const falta = total - valPagoPixNum;
          toast.error(`⚠️ Pix Insuficiente: O valor informado (R$ ${valPagoPixNum.toFixed(2)}) é menor que o total da comanda (R$ ${total.toFixed(2)}). Faltam R$ ${falta.toFixed(2)}!`);
          return;
        }
      }

      // 3. Caso Pagamento Múltiplo
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

      // 4. Caso Dinheiro Normal
      if (formaPagamento === "dinheiro" && valEntregueNum < total) {
        const falta = total - valEntregueNum;
        toast.error(`⚠️ Dinheiro Insuficiente: O valor entregue pelo cliente (R$ ${valEntregueNum.toFixed(2)}) é menor que o total da comanda (R$ ${total.toFixed(2)}). Faltam R$ ${falta.toFixed(2)}!`);
        return;
      }

      // 5. Blindagem Anti-Reuso de Códigos NSU de Cartão (Crédito / Débito)
      const isCartaoDireto = formaPagamento === "credito" || formaPagamento === "debito";
      const isCartaoPlanoProdutos = formaPagamento === "planos_infinite" && total > 0.01 && (formaPagamentoRestante === "credito" || formaPagamentoRestante === "debito");
      const codigosNsuChecar: string[] = [];

      if (isCartaoDireto || isCartaoPlanoProdutos) {
        const cleanNsu = (codigoNsuCartao || "").trim();
        if (!cleanNsu) {
          toast.error("⚠️ Código NSU Obrigatório: É OBRIGATÓRIO informar o código de autorização/NSU da maquineta para pagamento em Cartão!");
          return;
        }
        if (cleanNsu.length < 4) {
          toast.error("⚠️ Código NSU Inválido: O código de autorização/NSU da maquineta deve conter no mínimo 4 caracteres!");
          return;
        }
        codigosNsuChecar.push(cleanNsu);
      }

      if (formaPagamento === "multiplo") {
        for (const p of pagamentosMultiplos) {
          if (p.forma === "credito" || p.forma === "debito") {
            const cleanNsu = (p.codigo_nsu || "").trim();
            if (!cleanNsu) {
              toast.error(`⚠️ Código NSU Faltando: Todas as frações pagas em ${p.forma.toUpperCase()} precisam do código NSU preenchido!`);
              return;
            }
            if (cleanNsu.length < 4) {
              toast.error(`⚠️ Código NSU Inválido: O NSU da fração em ${p.forma.toUpperCase()} deve ter no mínimo 4 dígitos!`);
              return;
            }
            codigosNsuChecar.push(cleanNsu);
          }
        }
      }

      // Consulta no banco de dados para garantir que nenhum NSU foi reaproveitado de comandas anteriores
      if (codigosNsuChecar.length > 0) {
        for (const nsu of codigosNsuChecar) {
          const { data: comandaExistente } = await supabase
            .from("comandas")
            .select("id, total, status, fechada_em, created_at, clientes(nome)")
            .eq("codigo_autorizacao_nsu", nsu)
            .neq("id", comanda.id)
            .maybeSingle();

          if (comandaExistente) {
            const nomeCli = (comandaExistente.clientes as any)?.nome || "Cliente";
            toast.error(`⚠️ Código de Cartão Duplicado: O código/NSU "${nsu}" já foi utilizado anteriormente na Comanda #${comandaExistente.id.slice(0, 8)} (${nomeCli}). Cada transação de cartão deve ter um código único da maquineta!`);
            return;
          }
        }
      }
    }

    let formaPagamentoFinal = formaPagamento;
    if (formaPagamento === "planos_infinite") {
      if (total <= 0.01) {
        formaPagamentoFinal = clienteAssinatura?.plano
          ? `Plano Infinite (${clienteAssinatura.plano})`
          : "Plano Infinite 👑 (R$ 0,00)";
      } else {
        formaPagamentoFinal = `Plano Infinite (Serviços R${totalServicos.toFixed(2)}) + ${formaPagamentoRestante.toUpperCase()} R${total.toFixed(2)} (Produtos)`;
      }
    } else if (formaPagamento === "pix") {
      formaPagamentoFinal = `Pix (Valor Pago: R$ ${valPagoPixNum.toFixed(2)})`;
    } else if (formaPagamento === "multiplo" && pagamentosMultiplos.length > 0) {
      formaPagamentoFinal = `Múltiplo: ${pagamentosMultiplos.map(p => {
        let details = `${p.forma === 'assinatura' ? 'PLANO INFINITE' : p.forma.toUpperCase()} R${p.valor.toFixed(2)}`;
        if (p.codigo_nsu) details += ` (NSU: ${p.codigo_nsu})`;
        return details;
      }).join(" + ")}`;
    } else if (formaPagamento === "dinheiro" && trocoDevolver > 0) {
      formaPagamentoFinal = `Dinheiro (Entregue: R${valEntregueNum.toFixed(2)} | Troco: R${trocoDevolver.toFixed(2)})`;
    }

    setSaving(true);
    try {
      const totalFinal = Math.max(0, subtotal - descontoAbs);

      const updatePayload: any = {
        status: "fechada",
        forma_pagamento: formaPagamentoFinal,
        desconto: Math.round(descontoAbs * 100) / 100,
        total: Math.round(totalFinal * 100) / 100,
        fechada_em: new Date().toISOString(),
      };

      if (comprovantePixUrl) updatePayload.comprovante_pix_url = comprovantePixUrl;
      if (codigoNsuCartao) updatePayload.codigo_autorizacao_nsu = codigoNsuCartao;

      let { error } = await supabase
        .from("comandas")
        .update(updatePayload)
        .eq("id", comanda.id);

      if (error && error.message?.includes("column")) {
        delete updatePayload.comprovante_pix_url;
        delete updatePayload.codigo_autorizacao_nsu;
        const resDefensivo = await supabase.from("comandas").update(updatePayload).eq("id", comanda.id);
        if (resDefensivo.error) throw resDefensivo.error;
      } else if (error) {
        throw error;
      }

      if (comanda.agendamento_id) {
        await supabase
          .from("agendamentos")
          .update({ status: "concluido" })
          .eq("id", comanda.agendamento_id);
      }

      const targetUnidadeId = comanda.unidade_id || selectedUnidadeId || "a1346ecc-b354-4b15-8e05-8a980d3bd55e";
      const produtosVendidos = itens.filter((i) => i.tipo === "produto" && i.produto_id);

      for (const item of produtosVendidos) {
        if (!item.produto_id) continue;

        const { data: efData } = await supabase
          .from("estoque_filial")
          .select("quantidade")
          .eq("unidade_id", targetUnidadeId)
          .eq("produto_id", item.produto_id)
          .maybeSingle();

        const currentQty = efData?.quantidade !== undefined ? Number(efData.quantidade) : 0;
        const novoEstoque = Math.max(0, currentQty - item.quantidade);

        await supabase
          .from("estoque_filial")
          .upsert({
            empresa_id: empresaId || "93d24bc4-e371-4395-8ed8-636d02575de6",
            unidade_id: targetUnidadeId,
            produto_id: item.produto_id,
            quantidade: novoEstoque,
            updated_at: new Date().toISOString()
          }, { onConflict: "unidade_id,produto_id" });

        await supabase.from("estoque_movimentacoes").insert({
          produto_id: item.produto_id,
          tipo: "saida",
          quantidade: item.quantidade,
          observacao: `Venda via comanda #${comanda.id.slice(0, 8)}`,
          unidade_id: targetUnidadeId,
          empresa_id: empresaId || "93d24bc4-e371-4395-8ed8-636d02575de6",
        });
      }

      toast.success("Comanda fechada e pagamento quitado com sucesso!");
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao fechar comanda");
    } finally {
      setSaving(false);
    }
  };

  const paymentMethods = [
    { id: "planos_infinite", label: "Plano Infinite 👑", icon: Crown, color: "text-amber-500" },
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
            <DialogTitle className="flex items-center justify-between gap-3 text-foreground">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-md">
                  <ShoppingBag className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Comanda #{comanda?.id.slice(0, 8)}</h2>
                  <p className="text-xs text-muted-foreground font-semibold">{comanda?.clientes?.nome || "Cliente Atendimento"}</p>
                </div>
              </div>

              {clienteAssinatura?.status === "ativo" && (
                <Badge className="bg-amber-500 text-slate-950 font-bold text-xs py-1">
                  <Crown className="h-3.5 w-3.5 mr-1" /> {clienteAssinatura.plano}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-red-600" />
            </div>
          ) : (
            <div className="space-y-6 pt-2">
              {comanda?.status === "aberta" && (
                <div className="space-y-3 bg-muted/40 p-4 rounded-xl border border-border shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Scissors className="h-4 w-4 text-red-600 dark:text-red-400" />
                      <Label className="text-xs font-bold text-foreground uppercase tracking-wider">Adicionar Serviço à Comanda</Label>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setGaleriaOpen(true)}
                      className="text-xs h-8 border-red-600/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 font-bold px-3 shadow-sm"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Produtos
                    </Button>
                  </div>

                  <div className="flex gap-2">
                    <Select value={novoServicoId} onValueChange={setNovoServicoId}>
                      <SelectTrigger className="flex-1 bg-background text-foreground border-input text-xs h-9 font-semibold">
                        <SelectValue placeholder="Selecione o serviço..." />
                      </SelectTrigger>
                      <SelectContent>
                        {servicos.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.nome} ({s.duracao_minutos || 30}min) - R$ {Number(s.preco).toFixed(2)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Input
                      type="number"
                      min={1}
                      value={novaQuantidade}
                      onChange={(e) => setNovaQuantidade(parseInt(e.target.value) || 1)}
                      className="w-16 bg-background text-foreground border-input text-xs h-9 text-center font-bold"
                    />

                    <Button onClick={() => handleAddItem()} className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold h-9 px-4 shrink-0 shadow-sm">
                      <Plus className="h-4 w-4 mr-1" /> Lançar
                    </Button>
                  </div>
                </div>
              )}

              <div className="border border-border rounded-xl overflow-hidden bg-background">
                <Table>
                  <TableHeader className="bg-muted/60">
                    <TableRow>
                      <TableHead className="text-xs font-bold text-foreground">Item Discriminado</TableHead>
                      <TableHead className="text-xs font-bold text-center text-foreground">Qtd</TableHead>
                      <TableHead className="text-xs font-bold text-right text-foreground">Unitário</TableHead>
                      <TableHead className="text-xs font-bold text-right text-foreground">Subtotal</TableHead>
                      {comanda?.status === "aberta" && <TableHead className="w-10"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itens.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-xs text-muted-foreground font-medium">
                          Nenhum item lançado nesta comanda.
                        </TableCell>
                      </TableRow>
                    ) : (
                      itens.map((item) => (
                        <TableRow key={item.id} className="hover:bg-muted/30 border-b border-border">
                          <TableCell className="text-xs font-bold text-foreground py-3">
                            <div className="flex items-center gap-2">
                              {item.tipo === "servico" ? (
                                <Scissors className="h-3.5 w-3.5 text-red-600 dark:text-red-400 shrink-0" />
                              ) : (
                                <Package className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                              )}
                              <span>{item.nome}</span>
                              {formaPagamento === "planos_infinite" && item.tipo === "servico" && (
                                <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40 text-[10px] ml-1">
                                  Coberto pelo Plano
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-center font-mono font-bold text-foreground">{item.quantidade}</TableCell>
                          <TableCell className="text-xs text-right font-medium text-foreground">R$ {Number(item.preco_unitario).toFixed(2)}</TableCell>
                          <TableCell className="text-xs text-right font-bold text-foreground">R$ {Number(item.subtotal).toFixed(2)}</TableCell>
                          {comanda?.status === "aberta" && (
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40" onClick={() => handleRemoveItem(item.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="bg-muted/30 p-3.5 rounded-xl border border-border space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground font-semibold">
                  <span>Subtotal Bruto:</span>
                  <span className="text-foreground font-bold">R$ {subtotal.toFixed(2)}</span>
                </div>

                {descontoAbs > 0 && (
                  <div className="flex justify-between text-xs text-red-600 dark:text-red-400 font-bold">
                    <span>Desconto ({formaPagamento === "planos_infinite" ? "Planos Infinite" : `${descontoPercent}%`}):</span>
                    <span>- R$ {descontoAbs.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center text-base font-black text-foreground border-t border-border pt-2">
                  <span className="text-sm font-bold text-foreground">Total da Comanda:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-black text-2xl">R$ {total.toFixed(2)}</span>
                </div>
              </div>

              {/* CARD DE AUDITORIA E COMPROVANTE PARA COMANDA FECHADA */}
              {comanda?.status === "fechada" && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider">
                      <ShieldCheck className="h-4 w-4" /> Comprovante de Quitação do Pagamento
                    </div>
                    <Badge className="bg-emerald-600 text-white font-bold text-[10px]">
                      Quitação Confirmada
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-background p-3 rounded-lg border border-border">
                    <div>
                      <span className="text-muted-foreground font-semibold">Forma de Pagamento:</span>
                      <p className="font-bold text-foreground capitalize mt-0.5">{comanda.forma_pagamento || "Não informada"}</p>
                    </div>

                    {comanda.codigo_autorizacao_nsu && (
                      <div>
                        <span className="text-muted-foreground font-semibold">Código NSU / Autorização Maquineta:</span>
                        <p className="font-mono font-bold text-blue-600 dark:text-blue-400 mt-0.5">{comanda.codigo_autorizacao_nsu}</p>
                      </div>
                    )}
                  </div>

                  {comanda.comprovante_pix_url && (
                    <div className="p-3 bg-background rounded-lg border border-cyan-500/40 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg overflow-hidden border border-border bg-slate-900 shrink-0">
                          <img src={comanda.comprovante_pix_url} alt="Foto Comprovante Pix" className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground flex items-center gap-1">
                            <QrCode className="h-3.5 w-3.5 text-cyan-600" /> Foto do Comprovante Pix Anexada
                          </p>
                          <p className="text-[10px] text-muted-foreground">Auditada no ato do fechamento</p>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setPreviewImageUrl(comanda.comprovante_pix_url!); setImagePreviewOpen(true); }}
                        className="text-xs font-bold border-cyan-500/40 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50"
                      >
                        <ZoomIn className="h-3.5 w-3.5 mr-1" /> Expandir Foto
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* SELEÇÃO E EDICÃO DE FORMAS DE PAGAMENTO PARA COMANDAS ABERTAS */}
              {comanda?.status === "aberta" && (
                <div className="space-y-3 pt-2">
                  <Label className="text-xs font-bold text-foreground uppercase tracking-wider">Forma de Pagamento Principal</Label>
                  
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
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

                  {formaPagamento === "planos_infinite" && (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/40 rounded-xl space-y-3 animate-fade-in">
                      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-sm">
                        <Crown className="h-5 w-5 text-amber-500" />
                        <span>{total <= 0.01 ? "Atendimento 100% Coberto pelo Plano Infinite 👑" : "Serviços Cobertos pelo Plano Infinite 👑"}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {clienteAssinatura?.plano ? `Assinatura: ${clienteAssinatura.plano}.` : "Assinatura Infinite ativa."}
                        {totalServicos > 0 ? ` Serviços (R$ ${totalServicos.toFixed(2)}) foram 100% cobertos pelo plano.` : ""}
                        {total > 0.01 ? ` Restam R$ ${total.toFixed(2)} referentes a produtos adicionais a pagar no caixa.` : " Total a pagar no caixa: R$ 0,00."}
                      </p>

                      {total > 0.01 && (
                        <div className="space-y-3 pt-2 border-t border-amber-500/30">
                          <Label className="text-xs font-bold text-foreground uppercase tracking-wider block">
                            Forma de Pagamento para os Produtos (R$ {total.toFixed(2)}):
                          </Label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {[
                              { id: "pix", label: "📱 Pix", icon: QrCode },
                              { id: "dinheiro", label: "💵 Dinheiro", icon: Banknote },
                              { id: "credito", label: "💳 Crédito", icon: CreditCard },
                              { id: "debito", label: "💳 Débito", icon: Wallet },
                            ].map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => setFormaPagamentoRestante(m.id)}
                                className={cn(
                                  "p-2 rounded-lg border text-xs font-bold transition-all text-center",
                                  formaPagamentoRestante === m.id
                                    ? "bg-amber-600 border-amber-600 text-white shadow font-bold"
                                    : "bg-background border-border text-foreground hover:bg-muted font-bold"
                                )}
                              >
                                {m.label}
                              </button>
                            ))}
                          </div>

                          {formaPagamentoRestante === "pix" && (
                            <div className="space-y-2 pt-1">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-[10px] font-bold text-foreground">Valor Pago no Pix (R$) *</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    placeholder={`Ex: ${total.toFixed(2)}`}
                                    value={valorPagoPix}
                                    onChange={(e) => setValorPagoPix(e.target.value)}
                                    className="bg-background text-foreground border-input text-xs font-bold h-8"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px] font-bold text-foreground">Foto Comprovante Pix *</Label>
                                  {comprovantePixUrl ? (
                                    <div className="flex items-center justify-between text-xs bg-cyan-50 dark:bg-cyan-950/40 p-1.5 rounded-lg border border-cyan-500/40">
                                      <span className="text-cyan-700 dark:text-cyan-300 font-bold">✓ Foto Anexada</span>
                                      <Button type="button" variant="ghost" size="sm" onClick={() => setComprovantePixUrl("")} className="h-6 text-red-600 font-bold">
                                        Trocar
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="relative border border-dashed border-cyan-500/40 rounded-lg p-2 text-center bg-cyan-50/50 dark:bg-cyan-950/20">
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handlePixFileUpload(e, false)}
                                        disabled={uploadingPix}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                      />
                                      <span className="text-xs font-bold text-cyan-700 dark:text-cyan-400">
                                        {uploadingPix ? "Enviando..." : "+ Anexar Foto Pix"}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {formaPagamentoRestante === "dinheiro" && (
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <div className="space-y-1">
                                <Label className="text-[10px] font-bold text-foreground">Valor Entregue (R$)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder={`Ex: ${(total + 10).toFixed(2)}`}
                                  value={valorEntregueDinheiro}
                                  onChange={(e) => setValorEntregueDinheiro(e.target.value)}
                                  className="bg-background text-foreground border-input text-xs font-bold h-8"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] font-bold text-emerald-600">Troco a Devolver</Label>
                                <div className="h-8 px-2 bg-background rounded-lg border border-emerald-500/40 flex items-center font-bold text-emerald-600 text-xs">
                                  R$ {trocoDevolver.toFixed(2)}
                                </div>
                              </div>
                            </div>
                          )}

                          {(formaPagamentoRestante === "credito" || formaPagamentoRestante === "debito") && (
                            <div className="space-y-1 pt-1">
                              <Label className="text-[10px] font-bold text-foreground">NSU / Autorização Maquineta</Label>
                              <Input
                                placeholder="Código NSU da transação..."
                                value={codigoNsuCartao}
                                onChange={(e) => setCodigoNsuCartao(e.target.value)}
                                className="bg-background text-foreground border-input text-xs h-8 font-semibold"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {formaPagamento === "dinheiro" && total > 0.01 && (
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

                  {(formaPagamento === "credito" || formaPagamento === "debito") && (
                    <div className="space-y-2 animate-fade-in p-3.5 bg-blue-50 dark:bg-blue-950/20 border border-blue-500/40 rounded-xl">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                          <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" /> Código de Autorização / NSU da Maquineta <span className="text-red-500">*</span>
                        </Label>
                        <Badge variant="outline" className="text-[10px] border-blue-500/40 text-blue-700 dark:text-blue-400 bg-blue-50/50 font-bold">
                          Anti-Duplicidade Ativa 🔒
                        </Badge>
                      </div>
                      <Input
                        placeholder="Ex: 849302 (Código impresso no comprovante da maquineta)"
                        value={codigoNsuCartao}
                        onChange={(e) => setCodigoNsuCartao(e.target.value)}
                        className="bg-background text-foreground border-blue-500/50 text-xs h-9 font-semibold"
                      />
                      <p className="text-[10px] text-muted-foreground">O sistema verifica se este código já foi utilizado em outras comandas para evitar reuso de comprovantes.</p>
                    </div>
                  )}

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
                          <span>Faltam R$ {saldoRestanteMultiplo.toFixed(2)} para quitar o valor total da comanda!</span>
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
                              <SelectItem value="assinatura">👑 Plano Infinite (Assinatura)</SelectItem>
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

                      <Button onClick={handleAddMultiPagamento} className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold w-full h-9 mt-1 shadow-sm">
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
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-red-600 hover:bg-red-50" onClick={() => handleRemoveMultiPagamento(idx)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* AVISO DE STATUS DO CAIXA FÍSICO */}
              {comanda?.status === "aberta" && (() => {
                const caixaAtual = getCaixaSessao(comanda.unidade_id || selectedUnidadeId);
                if (caixaAtual?.status === "fechado") {
                  return (
                    <div className="p-3 bg-destructive/10 border border-destructive/40 rounded-xl flex items-center gap-2.5 text-xs text-destructive font-bold">
                      <Lock className="h-4 w-4 shrink-0" />
                      <span>Caixa de Hoje Fechado ({caixaAtual.protocolo}) • Fechamento de comandas bloqueado até o próximo expediente.</span>
                    </div>
                  );
                }
                if (!caixaAtual) {
                  return (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/40 rounded-xl flex items-center gap-2.5 text-xs text-amber-600 dark:text-amber-400 font-bold">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>Caixa de Hoje Não Aberto • Abra o caixa matinal antes de realizar a quitação de atendimentos.</span>
                    </div>
                  );
                }
                return null;
              })()}

              {/* RODAPÉ E AÇÕES DA COMANDA */}
              <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-border gap-3">
                {comanda?.status === "aberta" ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleSalvarComanda}
                      disabled={saving}
                      className="text-xs font-bold border-border text-foreground flex-1 h-11 w-full"
                    >
                      <Save className="h-4 w-4 mr-2 text-muted-foreground" /> Salvar Comanda (Manter Aberta)
                    </Button>

                    <Button
                      onClick={handleFecharComanda}
                      disabled={saving || itens.length === 0 || getCaixaSessao(comanda.unidade_id || selectedUnidadeId)?.status === "fechado"}
                      className={cn(
                        "text-white text-xs font-bold flex-1 h-11 w-full shadow-lg transition-all",
                        getCaixaSessao(comanda.unidade_id || selectedUnidadeId)?.status === "fechado"
                          ? "bg-slate-700 opacity-60 cursor-not-allowed"
                          : (total <= 0.01 || formaPagamento === "planos_infinite")
                          ? "bg-amber-600 hover:bg-amber-700"
                          : "bg-red-600 hover:bg-red-700"
                      )}
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                      {getCaixaSessao(comanda.unidade_id || selectedUnidadeId)?.status === "fechado"
                        ? "Recebimento Bloqueado (Caixa Fechado)"
                        : (total <= 0.01 || formaPagamento === "planos_infinite")
                        ? "Finalizar Atendimento (Plano Infinite - R$ 0,00)"
                        : "Fechar Comanda & Receber Pagamento"}
                    </Button>
                  </>
                ) : (
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 w-full text-center py-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-500/30 flex items-center justify-center gap-2">
                    <CheckCircle2 className="h-4 w-4" /> Comanda fechada e quitada em {comanda?.fechada_em ? format(new Date(comanda.fechada_em), "dd/MM/yyyy 'às' HH:mm") : "data não informada"}.
                  </div>
                )}
              </div>
            </div>
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
          handleAddItem({ id: prod.id, tipo: "produto", quantidade: qtd });
        }}
      />
    </>
  );
}
