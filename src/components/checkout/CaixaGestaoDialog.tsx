import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Banknote, ArrowUpRight, ArrowDownRight, Wallet, ShieldAlert, Plus, Save, Loader2, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUnidade } from "@/contexts/UnidadeContext";
import { format } from "date-fns";

interface CaixaGestaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CaixaGestaoDialog({ open, onOpenChange, onSuccess }: CaixaGestaoDialogProps) {
  const { selectedUnidadeId } = useUnidade();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [saldoDinheiro, setSaldoDinheiro] = useState(150.00);
  const [totalSangrias, setTotalSangrias] = useState(0.00);

  // Form de Sangria
  const [valorSangria, setValorSangria] = useState("");
  const [motivoSangria, setMotivoSangria] = useState("");

  // Form de Reforço de Troco
  const [valorReforco, setValorReforco] = useState("");
  const [motivoReforco, setMotivoReforco] = useState("");

  const storageKey = `caixa_movs_${selectedUnidadeId || "all"}_${format(new Date(), "yyyy-MM-dd")}`;

  useEffect(() => {
    if (open) {
      fetchCaixaData();
    }
  }, [open, selectedUnidadeId]);

  async function fetchCaixaData() {
    setLoading(true);
    try {
      // Carregar sangrias registradas
      let currentSangrias = 0;
      let currentReforcos = 0;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          currentSangrias = parsed.filter((m: any) => m.tipo === "sangria").reduce((acc: number, m: any) => acc + m.valor, 0);
          currentReforcos = parsed.filter((m: any) => m.tipo === "reforco").reduce((acc: number, m: any) => acc + m.valor, 0);
          setTotalSangrias(currentSangrias);
        } catch {
          // ignore
        }
      }

      // Buscar comandas fechadas em dinheiro da unidade hoje
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      let query = supabase
        .from("comandas")
        .select("total, forma_pagamento, created_at")
        .eq("status", "fechada")
        .gte("created_at", todayStart.toISOString());

      if (selectedUnidadeId) query = query.eq("unidade_id", selectedUnidadeId);

      const { data } = await query;
      if (data) {
        const totalDin = data
          .filter((c) => c.forma_pagamento?.toLowerCase().includes("dinheiro"))
          .reduce((acc, c) => acc + Number(c.total), 0);

        setSaldoDinheiro(150 + totalDin + currentReforcos - currentSangrias);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleLancarSangria() {
    const val = parseFloat(valorSangria);
    if (!val || val <= 0) {
      toast.error("Informe um valor válido para a sangria");
      return;
    }
    if (!motivoSangria.trim()) {
      toast.error("Informe o motivo/justificativa da sangria");
      return;
    }
    if (val > saldoDinheiro) {
      toast.error(`Valor da sangria (R$ ${val.toFixed(2)}) é superior ao saldo em caixa (R$ ${saldoDinheiro.toFixed(2)})`);
      return;
    }

    setSaving(true);
    try {
      const movs = JSON.parse(localStorage.getItem(storageKey) || "[]");
      movs.push({
        id: Date.now().toString(),
        hora: format(new Date(), "HH:mm"),
        tipo: "sangria",
        valor: val,
        motivo: motivoSangria,
      });
      localStorage.setItem(storageKey, JSON.stringify(movs));

      setTotalSangrias((prev) => prev + val);
      setSaldoDinheiro((prev) => prev - val);
      toast.success(`Sangria de R$ ${val.toFixed(2)} lançada com sucesso!`);
      setValorSangria("");
      setMotivoSangria("");
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error("Erro ao registrar sangria");
    } finally {
      setSaving(false);
    }
  }

  async function handleLancarReforco() {
    const val = parseFloat(valorReforco);
    if (!val || val <= 0) {
      toast.error("Informe um valor válido para o reforço");
      return;
    }

    setSaving(true);
    try {
      const movs = JSON.parse(localStorage.getItem(storageKey) || "[]");
      movs.push({
        id: Date.now().toString(),
        hora: format(new Date(), "HH:mm"),
        tipo: "reforco",
        valor: val,
        motivo: motivoReforco || "Reforço de troco",
      });
      localStorage.setItem(storageKey, JSON.stringify(movs));

      setSaldoDinheiro((prev) => prev + val);
      toast.success(`Reforço de troco de R$ ${val.toFixed(2)} adicionado ao caixa!`);
      setValorReforco("");
      setMotivoReforco("");
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error("Erro ao registrar reforço");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] bg-card border-white/[0.08] p-6">
        <DialogHeader className="pb-3 border-b border-white/[0.08]">
          <DialogTitle className="flex items-center justify-between text-foreground">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-emerald-400" />
              Gestão de Caixa Físico da Unidade
            </div>
            <Badge className="bg-emerald-950/60 text-emerald-400 border-emerald-500/30 text-xs font-bold">
              Caixa Aberto
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Resumo do Caixa */}
        <div className="grid grid-cols-2 gap-3 my-2">
          <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-xl">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">Saldo Atual em Dinheiro</span>
            <span className="text-2xl font-black text-emerald-400 mt-1 block">R$ {saldoDinheiro.toFixed(2)}</span>
          </div>

          <div className="p-3 bg-red-950/20 border border-red-500/20 rounded-xl">
            <span className="text-[11px] font-bold uppercase tracking-wider text-red-400 block">Total Saídas / Sangrias</span>
            <span className="text-2xl font-black text-red-400 mt-1 block">R$ {totalSangrias.toFixed(2)}</span>
          </div>
        </div>

        <Tabs defaultValue="sangria" className="mt-2 space-y-4">
          <TabsList className="bg-secondary/40 p-1 border border-white/5 w-full grid grid-cols-2">
            <TabsTrigger value="sangria" className="text-xs font-bold gap-1.5">
              <ArrowUpRight className="h-4 w-4 text-red-400" />
              Saída de Caixa (Sangria)
            </TabsTrigger>
            <TabsTrigger value="reforco" className="text-xs font-bold gap-1.5">
              <ArrowDownRight className="h-4 w-4 text-emerald-400" />
              Entrada / Reforço de Troco
            </TabsTrigger>
          </TabsList>

          {/* Aba Sangria */}
          <TabsContent value="sangria" className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-foreground">Valor da Sangria (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="Ex: 50.00"
                value={valorSangria}
                onChange={(e) => setValorSangria(e.target.value)}
                className="input-dark text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-foreground">Motivo / Justificativa Obrigatória *</Label>
              <Textarea
                placeholder="Ex: Compra de pó de café e água mineral para a recepção..."
                value={motivoSangria}
                onChange={(e) => setMotivoSangria(e.target.value)}
                className="input-dark text-xs h-20"
              />
            </div>

            <Button onClick={handleLancarSangria} disabled={saving} className="w-full btn-wine text-xs font-bold">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldAlert className="h-4 w-4 mr-1.5" />}
              Confirmar Saída (Sangria)
            </Button>
          </TabsContent>

          {/* Aba Reforço */}
          <TabsContent value="reforco" className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-foreground">Valor do Reforço (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="Ex: 100.00"
                value={valorReforco}
                onChange={(e) => setValorReforco(e.target.value)}
                className="input-dark text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-foreground">Observação (Opcional)</Label>
              <Input
                placeholder="Ex: Troco adicional trazido pelo gerente"
                value={motivoReforco}
                onChange={(e) => setMotivoReforco(e.target.value)}
                className="input-dark text-xs"
              />
            </div>

            <Button onClick={handleLancarReforco} disabled={saving} className="w-full btn-wine text-xs font-bold">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-1.5" />}
              Confirmar Entrada de Troco
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
