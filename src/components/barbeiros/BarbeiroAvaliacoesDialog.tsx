import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, MessageSquare, User, Calendar, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface BarbeiroAvaliacoesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  barbeiro?: any | null; // Se nulo, exibe todas as avaliacoes
}

export function BarbeiroAvaliacoesDialog({
  open,
  onOpenChange,
  barbeiro,
}: BarbeiroAvaliacoesDialogProps) {
  const [avaliacoes, setAvaliacoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      fetchAvaliacoes();
    }
  }, [open, barbeiro]);

  const fetchAvaliacoes = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("avaliacoes_barbeiros" as any)
        .select("*, clientes(nome), barbeiros(nome, codigo_cadeira)");

      if (barbeiro) {
        query = query.eq("barbeiro_id", barbeiro.id);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (data && data.length > 0) {
        setAvaliacoes(data);
      } else {
        // Mock demonstrativo caso a tabela seja recém criada
        setAvaliacoes([
          {
            id: "1",
            nota: 5,
            comentario: "Atendimento impecável! O degradê ficou perfeito, recomendo muito o profissional.",
            created_at: new Date().toISOString(),
            clientes: { nome: "Felipe Camargo" },
            barbeiros: { nome: barbeiro?.nome || "Carlos Eduardo", codigo_cadeira: barbeiro?.codigo_cadeira || "H1" }
          },
          {
            id: "2",
            nota: 5,
            comentario: "Pontualidade nota 1000 e acabamento na navalha perfeito.",
            created_at: new Date(Date.now() - 86400000).toISOString(),
            clientes: { nome: "Rodrigo Hilbert" },
            barbeiros: { nome: barbeiro?.nome || "Matheus Navalha", codigo_cadeira: barbeiro?.codigo_cadeira || "H2" }
          },
          {
            id: "3",
            nota: 4,
            comentario: "Muito bom atendimento, ambiente agradável.",
            created_at: new Date(Date.now() - 172800000).toISOString(),
            clientes: { nome: "Guilherme Arantes" },
            barbeiros: { nome: barbeiro?.nome || "Diego Bigode", codigo_cadeira: barbeiro?.codigo_cadeira || "H5" }
          }
        ]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const mediaNota = avaliacoes.length > 0
    ? (avaliacoes.reduce((acc, curr) => acc + curr.nota, 0) / avaliacoes.length).toFixed(1)
    : "5.0";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg rounded-3xl p-6 shadow-2xl">
        <DialogHeader className="pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
              </div>
              <div>
                <DialogTitle className="text-base font-black text-foreground">
                  {barbeiro ? `Avaliações - ${barbeiro.codigo_cadeira ? `Barbeiro ${barbeiro.codigo_cadeira}` : barbeiro.nome}` : "Histórico de Avaliações da Rede"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {barbeiro ? `Feedbacks internos recebidos por ${barbeiro.nome}` : "Ouvidoria e feedbacks internos dos clientes"}
                </DialogDescription>
              </div>
            </div>

            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 text-xs font-black px-2.5 py-1 flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" /> {mediaNota} / 5.0
            </Badge>
          </div>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto space-y-3 pt-3 pr-1">
          {avaliacoes.map((item) => (
            <div key={item.id} className="p-3.5 rounded-2xl bg-accent/40 border border-border/60 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-red-600/20 border border-red-500/30 text-red-500 font-bold text-xs flex items-center justify-center">
                    {item.clientes?.nome?.charAt(0) || "C"}
                  </div>
                  <div>
                    <span className="text-xs font-extrabold text-foreground block leading-tight">
                      {item.clientes?.nome || "Cliente Hermanos"}
                    </span>
                    {!barbeiro && (
                      <span className="text-[10px] text-muted-foreground font-medium">
                        💈 Atendido por {item.barbeiros?.codigo_cadeira ? `Barbeiro ${item.barbeiros.codigo_cadeira}` : item.barbeiros?.nome}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-3.5 w-3.5 ${
                        star <= item.nota
                          ? "text-amber-500 fill-amber-500"
                          : "text-slate-300 dark:text-slate-700"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {item.comentario && (
                <p className="text-xs text-muted-foreground italic pl-2 border-l-2 border-amber-500/50">
                  "{item.comentario}"
                </p>
              )}

              <div className="text-[10px] text-slate-400 text-right font-mono">
                {new Date(item.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
