import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Loader2, UserPlus, Shield, Mail, Clock, MapPin, Edit, MoreHorizontal, KeyRound, RefreshCw, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEmpresa } from "@/contexts/EmpresaContext";

interface PerfilAcesso {
  id: string;
  nome: string;
  descricao: string | null;
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
  avatar_url: string | null;
  role: string | null;
  perfil_nome: string | null;
  perfil_acesso_id: string | null;
  unidade_id: string | null;
  unidade_nome: string | null;
}

interface Convite {
  id: string;
  email: string;
  status: string;
  created_at: string;
  perfil_nome: string | null;
}

export default function Usuarios() {
  const { empresaId, labels, config } = useEmpresa();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [convites, setConvites] = useState<Convite[]>([]);
  const [perfis, setPerfis] = useState<PerfilAcesso[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [invitePerfilId, setInvitePerfilId] = useState("");
  const [inviteUnidadeId, setInviteUnidadeId] = useState("");
  const [inviteRole, setInviteRole] = useState("barber");
  const [inviting, setInviting] = useState(false);

  // Edit user dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editUnidadeId, setEditUnidadeId] = useState("");
  const [editPerfilId, setEditPerfilId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [empresaId]);

  async function fetchData() {
    if (!empresaId) return;
    setLoading(true);
    try {
      const [rolesRes, perfisRes, convitesRes, unidadesRes] = await Promise.all([
        supabase.from("user_roles").select("user_id, role, perfil_acesso_id, unidade_id").eq("empresa_id", empresaId),
        supabase.from("perfis_acesso").select("id, nome, descricao").eq("empresa_id", empresaId).order("nome"),
        supabase.from("convites").select("id, email, status, created_at, perfil_acesso_id").eq("empresa_id", empresaId).order("created_at", { ascending: false }),
        supabase.from("unidades").select("id, nome").eq("empresa_id", empresaId).eq("status", "active").order("nome"),
      ]);

      const userIds = (rolesRes.data || []).map(r => r.user_id);
      
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, nome, email, avatar_url, user_id")
        .in("user_id", userIds)
        .order("nome");

      setPerfis(perfisRes.data || []);
      setUnidades(unidadesRes.data || []);

      // Map users with their roles and units
      const mappedUsers: UserWithRole[] = (profilesData || []).map((p: any) => {
        const userRole = (rolesRes.data || []).find((r: any) => r.user_id === p.user_id);
        const perfil = userRole?.perfil_acesso_id 
          ? (perfisRes.data || []).find((pf: any) => pf.id === userRole.perfil_acesso_id)
          : null;
        const unidade = userRole?.unidade_id
          ? (unidadesRes.data || []).find((u: any) => u.id === userRole.unidade_id)
          : null;
        return {
          id: p.id,
          user_id: p.user_id,
          nome: p.nome,
          email: p.email,
          avatar_url: p.avatar_url,
          role: userRole?.role || null,
          perfil_nome: perfil?.nome || null,
          perfil_acesso_id: userRole?.perfil_acesso_id || null,
          unidade_id: userRole?.unidade_id || null,
          unidade_nome: unidade?.nome || null,
        };
      });

      setUsers(mappedUsers);

      // Map convites - filter out expired (>24h) pending ones
      const now = new Date();
      const mappedConvites: Convite[] = (convitesRes.data || [])
        .filter((c: any) => {
          if (c.status === "pendente") {
            const createdAt = new Date(c.created_at);
            const diffHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
            return diffHours <= 24;
          }
          return true;
        })
        .map((c: any) => {
          const perfil = c.perfil_acesso_id
            ? (perfisRes.data || []).find((pf: any) => pf.id === c.perfil_acesso_id)
            : null;
          return {
            id: c.id,
            email: c.email,
            status: c.status,
            created_at: c.created_at,
            perfil_nome: perfil?.nome || null,
          };
        });

      setConvites(mappedConvites);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite() {
    if (!inviteName.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (!inviteEmail.trim()) {
      toast.error("Email é obrigatório");
      return;
    }
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: {
          email: inviteEmail.trim(),
          nome: inviteName.trim(),
          perfil_acesso_id: invitePerfilId || null,
          role: inviteRole,
          unidade_id: inviteRole === "admin" || inviteRole === "super_admin" ? null : (inviteUnidadeId || (config.multi_unidades ? null : (unidades[0]?.id || null))),
          empresa_id: empresaId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Convite enviado com sucesso!");
      setInviteDialogOpen(false);
      setInviteEmail("");
      setInviteName("");
      setInvitePerfilId("");
      setInviteUnidadeId("");
      setInviteRole("barber");
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao enviar convite");
    } finally {
      setInviting(false);
    }
  }

  function handleEditUser(user: UserWithRole) {
    setEditingUser(user);
    setEditNome(user.nome || "");
    setEditEmail(user.email || "");
    setEditRole(user.role || "barber");
    setEditUnidadeId(user.unidade_id || "");
    setEditPerfilId(user.perfil_acesso_id || "");
    setEditDialogOpen(true);
  }

  async function handleSaveUser() {
    if (!editingUser) return;
    setSaving(true);
    try {
      // 1. Atualizar nome e e-mail no perfil global
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ nome: editNome.trim(), email: editEmail.trim() })
        .eq("user_id", editingUser.user_id);
      
      if (profileErr) console.warn("Aviso profile:", profileErr);

      // 2. Atualizar ou inserir papel e unidade do usuario
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", editingUser.user_id)
        .maybeSingle();

      const roleData = {
        role: editRole,
        unidade_id: (editRole === "admin" || editRole === "super_admin") ? null : (editUnidadeId || null),
        perfil_acesso_id: editPerfilId || null,
      };

      if (existingRole) {
        const { error } = await supabase
          .from("user_roles")
          .update(roleData)
          .eq("id", existingRole.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .insert({ ...roleData, user_id: editingUser.user_id, empresa_id: empresaId });
        if (error) throw error;
      }

      toast.success("Usuário e função atualizados com sucesso!");
      setEditDialogOpen(false);
      setEditingUser(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar usuário");
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword(email: string) {
    try {
      toast.loading("Enviando email de redefinição...", { id: "reset" });
      const { data, error } = await supabase.functions.invoke("reset-password", {
        body: { email },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Email de redefinição de senha enviado!", { id: "reset" });
    } catch (error: any) {
      toast.error(error.message || "Erro ao enviar email", { id: "reset" });
    }
  }

  async function handleResendInvite(email: string) {
    try {
      toast.loading("Reenviando convite...", { id: "resend" });
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: { email },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Convite reenviado com sucesso!", { id: "resend" });
    } catch (error: any) {
      toast.error(error.message || "Erro ao reenviar convite", { id: "resend" });
    }
  }

  async function handleDeleteConvite(id: string) {
    if (!confirm("Tem certeza que deseja excluir este convite?")) return;
    try {
      const { error } = await supabase.from("convites").delete().eq("id", id);
      if (error) throw error;
      toast.success("Convite excluído!");
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir convite");
    }
  }

  async function handleDeleteUser(user: UserWithRole) {
    if (!confirm(`Tem certeza que deseja excluir o usuário "${user.nome}"? Essa ação não pode ser desfeita.`)) return;
    try {
      // Delete user_roles and related barbeiro records from THIS company
      await supabase.from("user_roles").delete().eq("user_id", user.user_id).eq("empresa_id", empresaId);
      await supabase.from("barbeiros").delete().eq("user_id", user.user_id).eq("empresa_id", empresaId);
      
      // Do not delete the profile, as it is global. 
      // User is effectively "removed" from the company when their role is deleted.
      toast.success("Usuário excluído com sucesso!");
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir usuário");
    }
  }

  const filteredUsers = users.filter(
    (u) =>
      u.nome.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const getRoleBadge = (role: string | null) => {
    switch (role) {
      case "admin":
        return <Badge variant="default" className="bg-primary/20 text-primary border-primary/30">Admin</Badge>;
      case "manager":
        return <Badge variant="default" className="bg-info/20 text-info border-info/30">Gerente</Badge>;
      case "barber":
        return <Badge variant="secondary">{labels.profissional}</Badge>;
      default:
        return <Badge variant="outline">Sem papel</Badge>;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader title="Usuários" description="Gerencie os usuários e permissões do sistema">
        <Button className="btn-wine" onClick={() => setInviteDialogOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Convidar Usuário
        </Button>
      </PageHeader>

      <div className="panel">
        <Tabs defaultValue="usuarios">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <TabsList className="bg-secondary/30">
              <TabsTrigger value="usuarios">Usuários</TabsTrigger>
              <TabsTrigger value="convites">Convites Pendentes</TabsTrigger>
            </TabsList>
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-dark pl-10"
              />
            </div>
          </div>

          <TabsContent value="usuarios" className="mt-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12">
                <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Nenhum usuário encontrado</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground font-semibold">Usuário</TableHead>
                      <TableHead className="text-muted-foreground font-semibold">Papel</TableHead>
                      <TableHead className="text-muted-foreground font-semibold">Unidade</TableHead>
                      <TableHead className="text-muted-foreground font-semibold">Perfil de Acesso</TableHead>
                      <TableHead className="text-muted-foreground font-semibold w-[80px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id} className="border-border">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                              {user.nome.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-foreground">{user.nome}</div>
                              <div className="text-xs text-muted-foreground">{user.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getRoleBadge(user.role)}</TableCell>
                         <TableCell>
                          {user.role === "admin" ? (
                            <Badge variant="outline" className="gap-1">
                              <MapPin className="h-3 w-3" />
                              Todas
                            </Badge>
                          ) : (user.unidade_nome && config.multi_unidades) ? (
                            <Badge variant="outline" className="gap-1">
                              <MapPin className="h-3 w-3" />
                              {user.unidade_nome}
                            </Badge>
                          ) : (user.unidade_nome && !config.multi_unidades) ? (
                            <span className="text-muted-foreground text-sm">—</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.perfil_nome ? (
                            <Badge variant="outline">{user.perfil_nome}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditUser(user)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleResetPassword(user.email)}>
                                <KeyRound className="h-4 w-4 mr-2" />
                                Redefinir Senha
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDeleteUser(user)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="convites" className="mt-0">
            {convites.length === 0 ? (
              <div className="text-center py-12">
                <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Nenhum convite pendente</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground font-semibold">Email</TableHead>
                      <TableHead className="text-muted-foreground font-semibold">Perfil</TableHead>
                      <TableHead className="text-muted-foreground font-semibold">Status</TableHead>
                      <TableHead className="text-muted-foreground font-semibold">Data</TableHead>
                      <TableHead className="text-muted-foreground font-semibold w-[80px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {convites.map((convite) => (
                      <TableRow key={convite.id} className="border-border">
                        <TableCell className="font-medium text-foreground">{convite.email}</TableCell>
                        <TableCell>
                          {convite.perfil_nome ? (
                            <Badge variant="outline">{convite.perfil_nome}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={convite.status === "pendente" ? "secondary" : "default"}>
                            {convite.status === "pendente" ? "Pendente" : "Aceito"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {formatDate(convite.created_at)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {convite.status === "pendente" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1.5 text-xs"
                                onClick={() => handleResendInvite(convite.email)}
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                                Reenviar
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteConvite(convite.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Invite Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Convidar Usuário</DialogTitle>
          </DialogHeader>
           <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Nome do usuário"
                className="input-dark"
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="input-dark"
              />
            </div>
            <div className="space-y-2">
              <Label>Papel *</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="input-dark">
                  <SelectValue placeholder="Selecione o papel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrativo (acesso total)</SelectItem>
                  <SelectItem value="manager">Gerente</SelectItem>
                  <SelectItem value="barber">{labels.profissional}</SelectItem>
                </SelectContent>
              </Select>
            </div>
             {(inviteRole !== "admin" && config.multi_unidades) && (
              <div className="space-y-2">
                <Label>Unidade *</Label>
                <Select value={inviteUnidadeId} onValueChange={setInviteUnidadeId}>
                  <SelectTrigger className="input-dark">
                    <SelectValue placeholder="Selecione a unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {unidades.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  O usuário só poderá ver dados desta unidade.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Perfil de Acesso</Label>
              <Select value={invitePerfilId} onValueChange={setInvitePerfilId}>
                <SelectTrigger className="input-dark">
                  <SelectValue placeholder="Selecione um perfil (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {perfis.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                  {perfis.length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      Crie perfis de acesso em Permissões
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              O usuário receberá um email com um link para criar a senha.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" className="btn-soft" onClick={() => setInviteDialogOpen(false)}>
                Cancelar
              </Button>
              <Button className="btn-wine" onClick={handleInvite} disabled={inviting}>
                {inviting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enviar Convite
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-bold">
              <Edit className="h-5 w-5 text-red-500" />
              Editar Dados e Função do Usuário
            </DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4 py-1">
              <div className="space-y-2">
                <Label className="text-xs font-bold">Nome Completo *</Label>
                <Input
                  type="text"
                  value={editNome}
                  onChange={(e) => setEditNome(e.target.value)}
                  placeholder="Nome do usuário"
                  className="input-dark"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold">E-mail de Acesso *</Label>
                <Input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  className="input-dark"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold">Função / Cargo do Usuário *</Label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger className="input-dark">
                    <SelectValue placeholder="Selecione a função" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="super_admin">👑 Super Admin / Diretoria</SelectItem>
                    <SelectItem value="admin">🛡️ Administração (Acesso Total)</SelectItem>
                    <SelectItem value="manager">🏢 Gerente de Filial</SelectItem>
                    <SelectItem value="barber">💈 {labels.profissional || "Barbeiro"}</SelectItem>
                    <SelectItem value="refeicao">🎧 Recepção / Atendimento</SelectItem>
                    <SelectItem value="logistica">🚚 Logística CD</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(editRole !== "admin" && editRole !== "super_admin" && config.multi_unidades) && (
                <div className="space-y-2">
                  <Label className="text-xs font-bold">Unidade de Atuação</Label>
                  <Select value={editUnidadeId} onValueChange={setEditUnidadeId}>
                    <SelectTrigger className="input-dark">
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

              <div className="space-y-2">
                <Label className="text-xs font-bold">Perfil de Permissões Personalizado</Label>
                <Select value={editPerfilId} onValueChange={setEditPerfilId}>
                  <SelectTrigger className="input-dark">
                    <SelectValue placeholder="Selecione um perfil (opcional)" />
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

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <Button variant="outline" className="btn-soft" onClick={() => setEditDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button className="btn-wine font-bold" onClick={handleSaveUser} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar Alterações
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
