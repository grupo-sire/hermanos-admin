import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Users, ArrowRight, User, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Estagio = {
  id: string;
  nome: string;
  ordem: number;
  cor: string;
  descricao: string | null;
  automatico: boolean;
};

type FunilCliente = {
  id: string;
  cliente_id: string;
  estagio_id: string;
  notas: string | null;
  clientes: { nome: string; telefone: string; ultima_visita: string | null; total_visitas: number | null } | null;
};

export function FunilCRM() {
  const [estagios, setEstagios] = useState<Estagio[]>([]);
  const [funilClientes, setFunilClientes] = useState<FunilCliente[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [estagiosRes, funilRes] = await Promise.all([
        supabase.from("crm_funil_estagios").select("*").order("ordem"),
        supabase.from("crm_funil_clientes").select(`
          id, cliente_id, estagio_id, notas,
          clientes (nome, telefone, ultima_visita, total_visitas)
        `),
      ]);

      if (estagiosRes.error) throw estagiosRes.error;
      if (funilRes.error) throw funilRes.error;

      setEstagios(estagiosRes.data || []);
      setFunilClientes((funilRes.data as FunilCliente[]) || []);

      // Auto-sync: add registered clients not yet in funnel
      await autoSyncClientes(estagiosRes.data || [], (funilRes.data as FunilCliente[]) || []);
    } catch (error) {
      console.error("Erro ao carregar funil:", error);
      toast.error("Erro ao carregar funil CRM");
    } finally {
      setLoading(false);
    }
  }

  async function autoSyncClientes(estagios: Estagio[], existingFunil: FunilCliente[]) {
    const clienteEstagio = estagios.find(e => e.nome === "Cliente");
    const inativoEstagio = estagios.find(e => e.nome === "Inativo");
    if (!clienteEstagio) return;

    const { data: allClientes } = await supabase
      .from("clientes")
      .select("id, ultima_visita, total_visitas");

    if (!allClientes) return;

    const existingClienteIds = new Set(existingFunil.map(f => f.cliente_id));
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const newEntries = allClientes
      .filter(c => !existingClienteIds.has(c.id))
      .map(c => {
        const isInactive = inativoEstagio && c.ultima_visita && new Date(c.ultima_visita) < thirtyDaysAgo;
        return {
          cliente_id: c.id,
          estagio_id: isInactive ? inativoEstagio!.id : clienteEstagio.id,
        };
      });

    if (newEntries.length > 0) {
      await supabase.from("crm_funil_clientes").insert(newEntries);
      fetchData();
    }
  }

  async function moveCliente(funilClienteId: string, newEstagioId: string) {
    try {
      const { error } = await supabase
        .from("crm_funil_clientes")
        .update({ estagio_id: newEstagioId })
        .eq("id", funilClienteId);
      if (error) throw error;
      toast.success("Cliente movido no funil!");
      setFunilClientes(prev =>
        prev.map(fc => fc.id === funilClienteId ? { ...fc, estagio_id: newEstagioId } : fc)
      );
    } catch (error) {
      console.error("Erro ao mover cliente:", error);
      toast.error("Erro ao mover cliente");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
        <Users className="h-4 w-4" />
        <span>{funilClientes.length} clientes no funil</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {estagios.map((estagio, idx) => {
          const clientesNoEstagio = funilClientes.filter(fc => fc.estagio_id === estagio.id);
          return (
            <Card key={estagio.id} className="panel">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: estagio.cor }} />
                    {estagio.nome}
                  </div>
                  <Badge variant="secondary" className="text-xs">{clientesNoEstagio.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 space-y-2 max-h-[400px] overflow-y-auto">
                {clientesNoEstagio.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhum cliente</p>
                ) : (
                  clientesNoEstagio.map(fc => (
                    <div key={fc.id} className="bg-secondary/30 rounded-lg p-2 border border-border/50 group">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                          <User className="h-3 w-3 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{fc.clientes?.nome}</p>
                          <p className="text-[10px] text-muted-foreground">{fc.clientes?.telefone}</p>
                        </div>
                      </div>
                      {estagios.length > 1 && (
                        <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Select onValueChange={(v) => moveCliente(fc.id, v)}>
                            <SelectTrigger className="h-6 text-[10px] bg-background/50">
                              <SelectValue placeholder="Mover →" />
                            </SelectTrigger>
                            <SelectContent>
                              {estagios.filter(e => e.id !== estagio.id).map(e => (
                                <SelectItem key={e.id} value={e.id} className="text-xs">
                                  <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: e.cor }} />
                                    {e.nome}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
