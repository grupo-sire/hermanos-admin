import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Loader2, Shield, MoreHorizontal, Pencil, Trash2, Crown, Building2, Headphones, Truck, Users, Scissors, MessageSquare, CheckCircle2, Globe, MapPin } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEmpresa } from "@/contexts/EmpresaContext";

// Modulos e permissoes granulares
const PERMISSION_MODULES = [
  {
    module: "Agenda & Atendimentos",
    permissions: [
      { key: "agenda.ver", label: "Visualizar agenda" },
      { key: "agenda.criar", label: "Criar agendamento" },
      { key: "agenda.editar", label: "Editar agendamento" },
      { key: "agenda.excluir", label: "Excluir agendamento" },
    ],
  },
  {
    module: "Comanda & Checkout",
    permissions: [
      { key: "comanda.ver", label: "Visualizar comandas" },
      { key: "comanda.criar", label: "Criar comanda" },
      { key: "comanda.editar", label: "Editar comanda" },
      { key: "comanda.fechar", label: "Fechar comanda / Receber" },
    ],
  },
  {
    module: "Clientes",
    permissions: [
      { key: "clientes.ver", label: "Visualizar clientes" },
      { key: "clientes.criar", label: "Cadastrar cliente" },
      { key: "clientes.editar", label: "Editar cliente" },
      { key: "clientes.excluir", label: "Excluir cliente" },
    ],
  },
  {
    module: "Equipe & Barbeiros",
    permissions: [
      { key: "barbeiros.ver", label: "Visualizar barbeiros" },
      { key: "barbeiros.criar", label: "Cadastrar barbeiro" },
      { key: "barbeiros.editar", label: "Editar barbeiro" },
      { key: "barbeiros.excluir", label: "Excluir barbeiro" },
    ],
  },
  {
    module: "Serviços",
    permissions: [
      { key: "servicos.ver", label: "Visualizar serviços" },
      { key: "servicos.criar", label: "Cadastrar serviço" },
      { key: "servicos.editar", label: "Editar serviço" },
      { key: "servicos.excluir", label: "Excluir serviço" },
    ],
  },
  {
    module: "Produtos & Estoque (CD / Filial)",
    permissions: [
      { key: "produtos.ver", label: "Visualizar produtos" },
      { key: "produtos.criar", label: "Cadastrar produto" },
      { key: "produtos.editar", label: "Editar produto" },
      { key: "estoque.ver", label: "Visualizar estoque" },
      { key: "estoque.movimentar", label: "Movimentar estoque (Entradas / Baixas)" },
    ],
  },
  {
    module: "Suprimentos & Entregas",
    permissions: [
      { key: "suprimentos.ver", label: "Visualizar suprimentos" },
      { key: "suprimentos.pedir", label: "Fazer solicitações de insumos" },
      { key: "suprimentos.gerenciar", label: "Gerenciar/aprovar pedidos (Almoxarifado)" },
      { key: "suprimentos.entregar", label: "Confirmar entregas (Entregador)" },
    ],
  },
  {
    module: "Configurações & Usuários",
    permissions: [
      { key: "config.ver", label: "Visualizar configurações" },
      { key: "config.editar", label: "Editar configurações corporativas" },
      { key: "usuarios.gerenciar", label: "Gerenciar usuários e acessos" },
    ],
  },
  {
    module: "Dashboard & Financeiro",
    permissions: [
      { key: "dashboard.ver", label: "Visualizar Dashboard" },
      { key: "dashboard.financeiro", label: "Ver relatórios e dados financeiros" },
    ],
  },
];

interface PerfilAcesso {
  id: string;
  nome: string;
  descricao: string | null;
  permissoes: string[];
  unidade_id?: string | null;
  unidade_nome?: string | null;
}

interface Unidade {
  id: string;
  nome: string;
}

export default function Permissoes() {
  const { empresaId } = useEmpresa();
  const [perfis, setPerfis] = useState<PerfilAcesso[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPerfil, setEditingPerfil] = useState<PerfilAcesso | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [escopoUnidade, setEscopoUnidade] = useState<"todas" | "especifica">("todas");
  const [selectedUnidadeId, setSelectedUnidadeId] = useState<string>("");
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [perfilToDelete, setPerfilToDelete] = useState<PerfilAcesso | null>(null);

  useEffect(() => {
    fetchData();
  }, [empresaId]);

  async function fetchData() {
    setLoading(true);
    try {
      const [perfisRes, permissoesRes, unidadesRes] = await Promise.all([
        supabase.from("perfis_acesso").select("id, nome, descricao").order("nome"),
        supabase.from("perfil_permissoes").select("perfil_id, permissao"),
        supabase.from("unidades").select("id, nome").order("nome")
      ]);

      setUnidades(unidadesRes.data || []);

      const mapped: PerfilAcesso[] = (perfisRes.data || []).map((p: any) => ({
        ...p,
        nome: p?.nome || "Perfil Sem Nome",
        permissoes: (permissoesRes.data || [])
          .filter((pp: any) => pp && pp.perfil_id === p?.id)
          .map((pp: any) => pp?.permissao)
          .filter(Boolean),
      }));

      setPerfis(mapped);
    } catch (error) {
      console.error("Erro ao carregar perfis de acesso:", error);
      toast.error("Erro ao carregar perfis de acesso");
    } finally {
      setLoading(false);
    }
  }

  function handleOpenNew() {
    setEditingPerfil(null);
    setNome("");
    setDescricao("");
    setEscopoUnidade("todas");
    setSelectedUnidadeId("");
    setSelectedPermissions(new Set());
    setDialogOpen(true);
  }

  function handleEdit(perfil: PerfilAcesso) {
    setEditingPerfil(perfil);
    setNome(perfil.nome);
    setDescricao(perfil.descricao || "");
    setEscopoUnidade(perfil.unidade_id ? "especifica" : "todas");
    setSelectedUnidadeId(perfil.unidade_id || "");
    setSelectedPermissions(new Set(perfil.permissoes));
    setDialogOpen(true);
  }

  function togglePermission(key: string) {
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function toggleModuleAll(modulePermissions: { key: string }[]) {
    const allSelected = modulePermissions.every((p) => selectedPermissions.has(p.key));
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      modulePermissions.forEach((p) => {
        if (allSelected) {
          next.delete(p.key);
        } else {
          next.add(p.key);
        }
      });
      return next;
    });
  }

  async function handleSave() {
    if (!nome.trim()) {
      toast.error("Informe o nome do perfil de acesso");
      return;
    }
    setSaving(true);
    try {
      const targetUnidade = escopoUnidade === "especifica" ? selectedUnidadeId || null : null;

      if (editingPerfil) {
        const { error } = await supabase
          .from("perfis_acesso")
          .update({
            nome: nome.trim(),
            descricao: descricao.trim() || null
          })
          .eq("id", editingPerfil.id);
        if (error) throw error;

        await supabase.from("perfil_permissoes").delete().eq("perfil_id", editingPerfil.id);
        if (selectedPermissions.size > 0) {
          const rows = Array.from(selectedPermissions).map((p) => ({
            perfil_id: editingPerfil.id,
            permissao: p,
            empresa_id: empresaId || null,
          }));
          const { error: permError } = await supabase.from("perfil_permissoes").insert(rows);
          if (permError) throw permError;
        }

        toast.success("Perfil de acesso atualizado com sucesso!");
      } else {
        const { data, error } = await supabase
          .from("perfis_acesso")
          .insert({
            nome: nome.trim(),
            descricao: descricao.trim() || null,
            empresa_id: empresaId || null
          })
          .select()
          .single();
        if (error) throw error;

        if (selectedPermissions.size > 0) {
          const rows = Array.from(selectedPermissions).map((p) => ({
            perfil_id: data.id,
            permissao: p,
            empresa_id: empresaId || null,
          }));
          const { error: permError } = await supabase.from("perfil_permissoes").insert(rows);
          if (permError) throw permError;
        }

        toast.success("Novo perfil de acesso criado!");
      }

      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar perfil");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!perfilToDelete) return;
    try {
      const { error } = await supabase
        .from("perfis_acesso")
        .delete()
        .eq("id", perfilToDelete.id);
      if (error) throw error;
      toast.success("Perfil excluído com sucesso!");
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir perfil");
    } finally {
      setDeleteDialogOpen(false);
      setPerfilToDelete(null);
    }
  }

  const getPerfilBadge = (nome?: string | null) => {
    const n = (nome || "").toLowerCase();
    if (n.includes("diretoria") || n.includes("super admin")) {
      return <Badge className="bg-red-950/80 text-red-400 border-red-600/40 text-[10px]"><Crown className="h-3 w-3 mr-1" /> Super Admin</Badge>;
    }
    if (n.includes("gerente") || n.includes("supervisor")) {
      return <Badge className="bg-[#2a171a] text-amber-400 border-amber-500/30 text-[10px]"><Building2 className="h-3 w-3 mr-1" /> Gestão Unidade</Badge>;
    }
    if (n.includes("barbeiro")) {
      return <Badge className="bg-secondary text-foreground text-[10px]"><Scissors className="h-3 w-3 mr-1" /> Operacional</Badge>;
    }
    if (n.includes("entregador")) {
      return <Badge className="bg-blue-950/60 text-blue-400 border-blue-500/30 text-[10px]"><Truck className="h-3 w-3 mr-1" /> Logística CD</Badge>;
    }
    return <Badge variant="outline" className="text-[10px]"><Shield className="h-3 w-3 mr-1" /> Perfil Geral</Badge>;
  };

  const allPermissionsCount = PERMISSION_MODULES.reduce((sum, m) => sum + m.permissions.length, 0);

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader
        title="Gestão de Permissões e Perfis de Acesso"
        description="Configure os níveis de acesso e o escopo de unidades para os cargos da rede."
      >
        <Button className="btn-wine font-medium" onClick={handleOpenNew}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Perfil Personalizado
        </Button>
      </PageHeader>

      <div className="panel p-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-red-500" />
          </div>
        ) : perfis.length === 0 ? (
          <div className="text-center py-12">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm font-medium">Nenhum perfil de acesso encontrado</p>
            <Button variant="link" className="text-primary mt-2" onClick={handleOpenNew}>
              Criar primeiro perfil
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {perfis.map((perfil) => (
              <Card key={perfil.id} className="bg-card border-white/[0.08] hover:border-white/[0.15] transition-all flex flex-col justify-between shadow-lg">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      {getPerfilBadge(perfil.nome)}
                      <CardTitle className="text-base font-bold text-foreground mt-1">
                        {perfil.nome}
                      </CardTitle>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(perfil)}>
                          <Pencil className="h-4 w-4 mr-2" /> Editar Permissões
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => { setPerfilToDelete(perfil); setDeleteDialogOpen(true); }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {perfil.descricao && (
                    <CardDescription className="text-xs text-muted-foreground mt-2 line-clamp-3">
                      {perfil.descricao}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent className="pt-2 space-y-2">
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-white/[0.06]">
                    <span className="text-muted-foreground font-medium">Escopo de Abrangência:</span>
                    <span className="font-bold text-slate-200 flex items-center gap-1">
                      {perfil.unidade_nome ? (
                        <>
                          <MapPin className="h-3 w-3 text-red-400" /> {perfil.unidade_nome}
                        </>
                      ) : (
                        <>
                          <Globe className="h-3 w-3 text-emerald-400" /> Todas as Unidades
                        </>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Permissões Ativas:</span>
                    <span className="font-bold text-red-400 bg-red-950/40 px-2 py-0.5 rounded-md border border-red-500/20">
                      {perfil.permissoes.length} de {allPermissionsCount}
                    </span>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-3 text-xs border-white/10 hover:bg-white/5 font-medium"
                    onClick={() => handleEdit(perfil)}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1.5 text-red-400" /> Configurar Permissões
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modal Dialog para Criar/Editar Perfil */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto bg-card border-white/[0.08]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-bold">
              <Shield className="h-5 w-5 text-red-500" />
              {editingPerfil ? `Editar Perfil: ${editingPerfil.nome}` : "Novo Perfil de Acesso"}
            </DialogTitle>
            <DialogDescription>
              Defina o nome, escopo de unidade e marque as permissões para este cargo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-foreground">Nome do Perfil *</Label>
              <Input
                placeholder="Ex: Supervisor / Gerente"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="input-dark text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-foreground">Descrição / Responsabilidades</Label>
              <Textarea
                placeholder="Ex: Responsável pela gestão da unidade, autorização de baixas e solicitação de suprimentos."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="input-dark text-xs resize-none"
                rows={2}
              />
            </div>

            {/* Escopo de Unidade */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-secondary/20 rounded-xl border border-white/5">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-foreground">Escopo de Unidade</Label>
                <Select value={escopoUnidade} onValueChange={(val: any) => setEscopoUnidade(val)}>
                  <SelectTrigger className="input-dark text-xs">
                    <SelectValue placeholder="Selecione o escopo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">🌐 Todas as Unidades (Corporativo)</SelectItem>
                    <SelectItem value="especifica">📍 Unidade Específica (Vinculada)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {escopoUnidade === "especifica" && (
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-foreground">Unidade Padrão</Label>
                  <Select value={selectedUnidadeId} onValueChange={setSelectedUnidadeId}>
                    <SelectTrigger className="input-dark text-xs">
                      <SelectValue placeholder="Selecione a unidade" />
                    </SelectTrigger>
                    <SelectContent>
                      {unidades.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          📍 {u.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Matriz de Permissões */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">Matriz de Permissões Granulares</span>
                <span className="text-xs text-red-400 font-bold">
                  {selectedPermissions.size} de {allPermissionsCount} selecionadas
                </span>
              </div>

              <div className="space-y-3">
                {PERMISSION_MODULES.map((mod) => {
                  const allSelected = mod.permissions.every((p) => selectedPermissions.has(p.key));

                  return (
                    <div key={mod.module} className="p-3 bg-secondary/20 rounded-xl border border-white/[0.04] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-red-500" /> {mod.module}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
                          onClick={() => toggleModuleAll(mod.permissions)}
                        >
                          {allSelected ? "Desmarcar Todos" : "Marcar Todos"}
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {mod.permissions.map((p) => {
                          const isChecked = selectedPermissions.has(p.key);
                          return (
                            <label
                              key={p.key}
                              className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                                isChecked
                                  ? "bg-red-950/40 border-red-500/40 text-foreground font-medium"
                                  : "bg-secondary/30 border-white/[0.03] text-muted-foreground hover:bg-secondary/50"
                              }`}
                            >
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={() => togglePermission(p.key)}
                              />
                              <span>{p.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-white/[0.06]">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving} className="btn-wine font-bold">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Salvar Perfil de Acesso
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmar Exclusao */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Perfil de Acesso</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o perfil "{perfilToDelete?.nome}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
