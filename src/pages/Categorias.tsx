import { useState } from "react";
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Loader2, MoreHorizontal, Pencil, Trash2, Tag } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCategorias, type Categoria } from "@/hooks/useCategorias";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUserRole } from "@/hooks/useUserRole";

export default function Categorias() {
  const { empresaId } = useEmpresa();
  const { isSuperAdmin } = useUserRole();
  const [activeTab, setActiveTab] = useState<"servico" | "produto">("servico");
  const { categorias: categoriasServico, loading: loadingServico, refetch: refetchServico } = useCategorias("servico");
  const { categorias: categoriasProduto, loading: loadingProduto, refetch: refetchProduto } = useCategorias("produto");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState<Categoria | null>(null);
  const [newNome, setNewNome] = useState("");
  const [newTipo, setNewTipo] = useState<"servico" | "produto">("servico");
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoriaToDelete, setCategoriaToDelete] = useState<Categoria | null>(null);

  const categorias = activeTab === "servico" ? categoriasServico : categoriasProduto;
  const loading = activeTab === "servico" ? loadingServico : loadingProduto;
  const refetch = activeTab === "servico" ? refetchServico : refetchProduto;

  const filtered = categorias.filter((c) =>
    c.nome.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenNew = () => {
    setEditingCategoria(null);
    setNewNome("");
    setNewTipo(activeTab);
    setDialogOpen(true);
  };

  const handleEdit = (cat: Categoria) => {
    setEditingCategoria(cat);
    setNewNome(cat.nome);
    setNewTipo(cat.tipo as "servico" | "produto");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!newNome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    setSaving(true);
    try {
      if (editingCategoria) {
        const { error } = await supabase
          .from("categorias")
          .update({ nome: newNome.trim() })
          .eq("id", editingCategoria.id);
        if (error) throw error;
        toast.success("Categoria atualizada!");
      } else {
        const { error } = await supabase
          .from("categorias")
          .insert({ nome: newNome.trim(), tipo: newTipo, empresa_id: empresaId });
        if (error) throw error;
        toast.success("Categoria criada!");
      }
      refetchServico();
      refetchProduto();
      setDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar categoria");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!categoriaToDelete) return;
    try {
      const { error } = await supabase
        .from("categorias")
        .delete()
        .eq("id", categoriaToDelete.id);
      if (error) throw error;
      toast.success("Categoria excluída!");
      refetchServico();
      refetchProduto();
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir categoria");
    } finally {
      setDeleteDialogOpen(false);
      setCategoriaToDelete(null);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader title="Categorias" description="Gerencie as categorias de serviços e produtos">
        {isSuperAdmin && (
          <Button className="btn-wine" onClick={handleOpenNew}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Categoria
          </Button>
        )}
      </PageHeader>

      <div className="panel">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <TabsList className="bg-secondary/30">
              <TabsTrigger value="servico">Serviços</TabsTrigger>
              <TabsTrigger value="produto">Produtos</TabsTrigger>
            </TabsList>
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar categoria..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-dark pl-10"
              />
            </div>
          </div>

          <TabsContent value="servico" className="mt-0">
            <CategoriaTable
              categorias={filtered}
              loading={loading}
              isSuperAdmin={isSuperAdmin}
              onEdit={handleEdit}
              onDelete={(cat) => { setCategoriaToDelete(cat); setDeleteDialogOpen(true); }}
            />
          </TabsContent>
          <TabsContent value="produto" className="mt-0">
            <CategoriaTable
              categorias={filtered}
              loading={loading}
              isSuperAdmin={isSuperAdmin}
              onEdit={handleEdit}
              onDelete={(cat) => { setCategoriaToDelete(cat); setDeleteDialogOpen(true); }}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog Nova/Editar Categoria */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{editingCategoria ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={newNome}
                onChange={(e) => setNewNome(e.target.value)}
                placeholder="Nome da categoria"
                className="input-dark"
              />
            </div>
            {!editingCategoria && (
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={newTipo} onValueChange={(v) => setNewTipo(v as any)}>
                  <SelectTrigger className="input-dark">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="servico">Serviço</SelectItem>
                    <SelectItem value="produto">Produto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="btn-soft">Cancelar</Button>
              <Button className="btn-wine" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingCategoria ? "Salvar" : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{categoriaToDelete?.nome}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CategoriaTable({
  categorias,
  loading,
  isSuperAdmin,
  onEdit,
  onDelete,
}: {
  categorias: Categoria[];
  loading: boolean;
  isSuperAdmin: boolean;
  onEdit: (cat: Categoria) => void;
  onDelete: (cat: Categoria) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (categorias.length === 0) {
    return (
      <div className="text-center py-12">
        <Tag className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">Nenhuma categoria cadastrada</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="text-muted-foreground font-semibold">Nome</TableHead>
            <TableHead className="text-muted-foreground font-semibold w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categorias.map((cat) => (
            <TableRow key={cat.id} className="border-border">
              <TableCell className="font-medium text-foreground">{cat.nome}</TableCell>
              <TableCell>
                {isSuperAdmin && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(cat)}>
                        <Pencil className="h-4 w-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => onDelete(cat)}>
                        <Trash2 className="h-4 w-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
