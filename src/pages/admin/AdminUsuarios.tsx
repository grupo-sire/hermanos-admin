import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, Shield, UserPlus, Loader2, Mail, Trash2, Crown, Building2, Scissors, Headphones, Truck, MapPin, Globe, Edit, KeyRound, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/ui/page-header";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";

interface PerfilAcesso {
  id: string;
  nome: string;
}

interface Unidade {
  id: string;
  nome: string;
}

interface UserWithRole {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  role: string;
  perfil_nome?: string | null;
  perfil_acesso_id?: string | null;
  unidade_id?: string | null;
  unidade_nome?: string | null;
  created_at: string;
}

export default function AdminUsuarios() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [perfis, setPerfis] = useState<PerfilAcesso[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tabFilter, setTabFilter] = useState("todos");

  // Invite state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteNome, setInviteNome] = useState("");
  const [invitePerfilId, setInvitePerfilId] = useState("");
  const [inviteUnidadeId, setInviteUnidadeId] = useState("");
  const [inviteRole, setInviteRole] = useState("manager");
  const [inviting, setInviting] = useState(false);

  // Edit user state
  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("manager");
  const [editPerfilId, setEditPerfilId] = useState("");
  const [editUnidadeId, setEditUnidadeId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rolesRes, perfisRes, unidadesRes] = await Promise.all([
        supabase.from("user_roles").select("id, user_id, role, perfil_acesso_id, unidade_id, created_at"),
        supabase.from("perfis_acesso").select("id, nome").order("nome"),
        supabase.from("unidades").select("id, nome").order("nome"),
      ]);

      setPerfis(perfisRes.data || []);
      setUnidades(unidadesRes.data || []);

      const roles = rolesRes.data || [];
      if (roles.length === 0) {
        setUsers([]);
        setLoading(false);
        return;
      }

      const userIds = Array.from(new Set(roles.map((r) => r.user_id)));
      const { data: profileData } = await supabase
        .from("profiles")
        .select("user_id, nome, email")
        .in("user_id", userIds);

      const profileMap = new Map(profileData?.map((p) => [p.user_id, p]));
      const perfilMap = new Map((perfisRes.data || []).map((p) => [p.id, p.nome]));
      const unidadeMap = new Map((unidadesRes.data || []).map((u) => [u.id, u.nome]));

      const formatted: UserWithRole[] = roles.map((r) => {
        const prof = profileMap.get(r.user_id);
        return {
          id: r.id,
          user_id: r.user_id,
          role: r.role,
          perfil_acesso_id: r.perfil_acesso_id,
          perfil_nome: r.perfil_acesso_id ? perfilMap.get(r.perfil_acesso_id) || "Perfil Geral" : null,
          unidade_id: r.unidade_id,
          unidade_nome: r.unidade_id ? unidadeMap.get(r.unidade_id) || "Unidade Específica" : null,
          created_at: r.created_at,
          nome: prof?.nome || "Usuário",
          email: prof?.email || "Email não informado",
        };
      });

      setUsers(formatted);
    } catch (err) {
      console.error("Erro ao carregar usuários:", err);
      toast.error("Erro ao carregar lista de usuários");
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !inviteNome.trim()) {
      toast.error("Preencha o nome e e-mail do usuário");
      return;
    }
    setInviting(true);
    try {
      const { error } = await supabase.functions.invoke("invite-user", {
        body: {
          email: inviteEmail.trim(),
          nome: inviteNome.trim(),
          role: inviteRole,
          perfil_acesso_id: invitePerfilId || null,
          unidade_id: inviteUnidadeId === "todas" ? null : (inviteUnidadeId || null),
        },
      });

      if (error) throw error;

      toast.success("Convite de usuário enviado com sucesso!");
      setInviteOpen(false);
      setInviteEmail("");
      setInviteNome("");
      setInvitePerfilId("");
      setInviteUnidadeId("");
      fetchData();
    } catch (err: any) {
      toast.error("Erro ao enviar convite: " + (err.message || "Tente novamente"));
    } finally {
      setInviting(false);
    }
  };

  const handleOpenEdit = (user: UserWithRole) => {
    setEditingUser(user);
    setEditNome(user.nome || "");
    setEditEmail(user.email || "");
    setEditRole(user.role || "barber");
    setEditPerfilId(user.perfil_acesso_id || "");
    setEditUnidadeId(user.unidade_id || "todas");
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
      // 1. Atualizar Profile
      const { error: profErr } = await supabase
        .from("profiles")
        .update({ nome: editNome.trim(), email: editEmail.trim() })
        .eq("user_id", editingUser.user_id);

      if (profErr) console.warn("Erro ao atualizar profile:", profErr);

      // 2. Atualizar user_roles
      const { error: roleErr } = await supabase
        .from("user_roles")
        .update({
          role: editRole,
          perfil_acesso_id: editPerfilId || null,
          unidade_id: editUnidadeId === "todas" ? null : (editUnidadeId || null),
        })
        .eq("id", editingUser.id);

      if (roleErr) throw roleErr;

      toast.success("Usuário e permissões atualizados com sucesso!");
      setEditOpen(false);
      setEditingUser(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar alterações do usuário");
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async (email: string) => {
    try {
      toast.loading("Enviando e-mail de redefinição de senha...", { id: "reset-pwd" });
      const { data, error } = await supabase.functions.invoke("reset-password", {
        body: { email },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("E-mail de redefinição enviado com sucesso!", { id: "reset-pwd" });
    } catch (err: any) {
      toast.error("Erro ao enviar e-mail: " + (err.message || "Tente novamente"), { id: "reset-pwd" });
    }
  };

  const handleDeleteUser = async (user: UserWithRole) => {
    if (!confirm(`Tem certeza que deseja excluir permanentemente o acesso do usuário "${user.nome}" (${user.email})?`)) return;
    try {
      toast.loading("Excluindo usuário do sistema...", { id: "del-usr" });
      
      // Excluir papeis, barbeiro e perfil do usuario
      await supabase.from("user_roles").delete().eq("user_id", user.user_id);
      await supabase.from("barbeiros").delete().eq("user_id", user.user_id);
      await supabase.from("profiles").delete().eq("user_id", user.user_id);

      toast.success("Usuário excluído com sucesso!", { id: "del-usr" });
      fetchData();
    } catch (err: any) {
      toast.error("Erro ao excluir usuário: " + (err.message || "Tente novamente"), { id: "del-usr" });
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.nome.toLowerCase().includes(search.toLowerCase()) ||
      (u.perfil_nome && u.perfil_nome.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;

    if (tabFilter === "super_admin") return u.role === "super_admin" || u.perfil_nome?.toLowerCase().includes("diretoria") || u.perfil_nome?.toLowerCase().includes("administração");
    if (tabFilter === "manager") return u.role === "manager" || u.perfil_nome?.toLowerCase().includes("gerente") || u.perfil_nome?.toLowerCase().includes("supervisor");
    if (tabFilter === "barber") return u.role === "barber" || u.perfil_nome?.toLowerCase().includes("barbeiro");
    if (tabFilter === "entregador") return u.perfil_nome?.toLowerCase().includes("entregador");

    return true;
  });

  const getRoleBadge = (user: UserWithRole) => {
    if (user.role === "super_admin" || user.perfil_nome?.toLowerCase().includes("diretoria")) {
      return (
        <Badge className="bg-red-950/80 text-red-400 border-red-600/40 text-[11px]">
          <Crown className="h-3 w-3 mr-1" /> Super Admin
        </Badge>
      );
    }
    if (user.role === "admin" || user.perfil_nome?.toLowerCase().includes("administração")) {
      return (
        <Badge className="bg-amber-950/80 text-amber-400 border-amber-500/30 text-[11px]">
          <Shield className="h-3 w-3 mr-1" /> Administração
        </Badge>
      );
    }
    if (user.role === "manager" || user.perfil_nome?.toLowerCase().includes("gerente")) {
      return (
        <Badge className="bg-slate-800 text-slate-200 border-slate-700 text-[11px]">
          <Building2 className="h-3 w-3 mr-1" /> Gerente Filial
        </Badge>
      );
    }
    if (user.role === "barber" || user.perfil_nome?.toLowerCase().includes("barbeiro")) {
      return (
        <Badge className="bg-secondary text-foreground text-[11px]">
          <Scissors className="h-3 w-3 mr-1" /> Barbeiro
        </Badge>
      );
    }
    if (user.perfil_nome?.toLowerCase().includes("entregador")) {
      return (
        <Badge className="bg-blue-950/60 text-blue-400 border-blue-500/30 text-[11px]">
          <Truck className="h-3 w-3 mr-1" /> Logística CD
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-[11px]">
        {user.perfil_nome || "Acesso Geral"}
      </Badge>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Gestão Global de Usuários e Acessos"
        description="Cadastre colaboradores, edite funções e defina permissões de acesso às unidades da rede Hermanos."
      >
        <Button onClick={() => setInviteOpen(true)} className="btn-wine font-bold">
          <UserPlus className="h-4 w-4 mr-2" /> Novo Usuário
        </Button>
      </PageHeader>

      <Tabs value={tabFilter} onValueChange={setTabFilter} className="w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2">
          <TabsList className="bg-secondary/40 p-1 border border-white/5">
            <TabsTrigger value="todos">Todos ({users.length})</TabsTrigger>
            <TabsTrigger value="super_admin">Super Admins</TabsTrigger>
            <TabsTrigger value="manager">Gerentes</TabsTrigger>
            <TabsTrigger value="barber">Barbeiros</TabsTrigger>
            <TabsTrigger value="entregador">Logística / CD</TabsTrigger>
          </TabsList>

          <div className="relative flex-1 max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, e-mail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-dark pl-9 text-xs"
            />
          </div>
        </div>

        <TabsContent value={tabFilter} className="mt-2">
          <div className="rounded-xl border border-white/[0.08] bg-card overflow-hidden shadow-lg">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/30 border-white/[0.06]">
                  <TableHead className="text-xs font-bold uppercase">Usuário</TableHead>
                  <TableHead className="text-xs font-bold uppercase">Cargo / Perfil</TableHead>
                  <TableHead className="text-xs font-bold uppercase">Unidade de Acesso</TableHead>
                  <TableHead className="text-xs font-bold uppercase">Cadastrado Em</TableHead>
                  <TableHead className="text-xs font-bold uppercase text-right w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-red-500 mb-2" />
                      <p className="text-xs text-muted-foreground">Carregando usuários...</p>
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground text-sm">
                      Nenhum usuário encontrado com este filtro.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id} className="border-white/[0.04] hover:bg-white/[0.02]">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-red-950/60 border border-red-500/20 text-red-400 font-bold flex items-center justify-center text-sm">
                            {user.nome.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground text-sm">{user.nome}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(user)}</TableCell>
                      <TableCell>
                        <span className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                          {user.unidade_nome ? (
                            <>
                              <MapPin className="h-3.5 w-3.5 text-red-400" /> {user.unidade_nome}
                            </>
                          ) : (
                            <>
                              <Globe className="h-3.5 w-3.5 text-emerald-400" /> Todas as Unidades (Rede)
                            </>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-zinc-950 border-zinc-800 text-zinc-100">
                            <DropdownMenuItem onClick={() => handleOpenEdit(user)} className="cursor-pointer">
                              <Edit className="h-4 w-4 mr-2 text-blue-400" />
                              Editar Dados & Função
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleResetPassword(user.email)} className="cursor-pointer">
                              <KeyRound className="h-4 w-4 mr-2 text-amber-400" />
                              Redefinir Senha
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteUser(user)} className="cursor-pointer text-red-400 focus:text-red-300">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir Usuário
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal Dialog para Cadastrar/Convidar Novo Usuário */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-[500px] bg-card border-white/[0.08]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-bold">
              <UserPlus className="h-5 w-5 text-red-500" />
              Novo Usuário do Sistema
            </DialogTitle>
            <DialogDescription>
              Informe os dados do colaborador para cadastrar seu acesso na rede Hermanos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-foreground">Nome Completo *</Label>
              <Input
                placeholder="Ex: Carlos Oliveira"
                value={inviteNome}
                onChange={(e) => setInviteNome(e.target.value)}
                className="input-dark text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-foreground">E-mail de Acesso *</Label>
              <Input
                type="email"
                placeholder="exemplo@hermanos.com.br"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="input-dark text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-foreground">Função / Cargo do Usuário *</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="input-dark text-xs">
                  <SelectValue placeholder="Selecione a função" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">👑 Super Admin / Diretoria</SelectItem>
                  <SelectItem value="admin">🛡️ Administração (Acesso Total)</SelectItem>
                  <SelectItem value="manager">🏢 Gerente de Filial</SelectItem>
                  <SelectItem value="barber">💈 Barbeiro / Profissional</SelectItem>
                  <SelectItem value="refeicao">🎧 Recepção / Atendimento</SelectItem>
                  <SelectItem value="logistica">🚚 Logística CD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-foreground">Perfil de Acesso (Opcional)</Label>
              <Select value={invitePerfilId} onValueChange={setInvitePerfilId}>
                <SelectTrigger className="input-dark text-xs">
                  <SelectValue placeholder="Selecione o perfil de permissões" />
                </SelectTrigger>
                <SelectContent>
                  {perfis.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      🛡️ {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-foreground">Unidade de Atuação</Label>
              <Select value={inviteUnidadeId} onValueChange={setInviteUnidadeId}>
                <SelectTrigger className="input-dark text-xs">
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">🌐 Todas as Unidades (Corporativo)</SelectItem>
                  {unidades.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      📍 {u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={inviting}>
              Cancelar
            </Button>
            <Button onClick={handleInvite} disabled={inviting} className="btn-wine font-bold">
              {inviting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Cadastrar Usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Dialog para EDITAR Usuário Existente */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[480px] bg-card border-white/[0.08]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-bold">
              <Edit className="h-5 w-5 text-red-500" />
              Editar Dados e Função do Usuário
            </DialogTitle>
          </DialogHeader>

          {editingUser && (
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-foreground">Nome Completo *</Label>
                <Input
                  value={editNome}
                  onChange={(e) => setEditNome(e.target.value)}
                  className="input-dark text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-foreground">E-mail de Acesso *</Label>
                <Input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="input-dark text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-foreground">Função / Cargo do Usuário *</Label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger className="input-dark text-xs">
                    <SelectValue placeholder="Selecione a função" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="super_admin">👑 Super Admin / Diretoria</SelectItem>
                    <SelectItem value="admin">🛡️ Administração (Acesso Total)</SelectItem>
                    <SelectItem value="manager">🏢 Gerente de Filial</SelectItem>
                    <SelectItem value="barber">💈 Barbeiro / Profissional</SelectItem>
                    <SelectItem value="refeicao">🎧 Recepção / Atendimento</SelectItem>
                    <SelectItem value="logistica">🚚 Logística CD</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-foreground">Perfil de Acesso Personalizado</Label>
                <Select value={editPerfilId} onValueChange={setEditPerfilId}>
                  <SelectTrigger className="input-dark text-xs">
                    <SelectValue placeholder="Selecione o perfil de permissões" />
                  </SelectTrigger>
                  <SelectContent>
                    {perfis.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        🛡️ {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-foreground">Unidade de Atuação</Label>
                <Select value={editUnidadeId} onValueChange={setEditUnidadeId}>
                  <SelectTrigger className="input-dark text-xs">
                    <SelectValue placeholder="Selecione a unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">🌐 Todas as Unidades (Corporativo)</SelectItem>
                    {unidades.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        📍 {u.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving} className="btn-wine font-bold">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
