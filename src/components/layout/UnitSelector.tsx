import { MapPin } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUserRole } from "@/hooks/useUserRole";

export function UnitSelector() {
  const { unidades = [], selectedUnidadeId, setSelectedUnidadeId, selectedUnidade } = useUnidade();
  const { config } = useEmpresa();
  const { isSuperAdmin } = useUserRole();

  // Hide entirely if multi_unidades is not enabled for this empresa or config is null
  if (!config || !config.multi_unidades) return null;

  if (!unidades || unidades.length === 0) return null;

  // Se NÃO for SuperAdmin, exibe apenas a unidade fixa travada sem opção de trocar
  if (!isSuperAdmin) {
    return (
      <div className="flex items-center gap-2 bg-secondary/40 px-3 py-1.5 rounded-xl border border-white/10">
        <MapPin className="h-4 w-4 text-primary" />
        <span className="text-xs font-bold text-foreground truncate max-w-[160px]">
          {selectedUnidade?.nome || "Filial Vinculada"}
        </span>
      </div>
    );
  }

  // Apenas o SuperAdmin pode selecionar qualquer unidade
  return (
    <div className="flex items-center gap-2">
      <MapPin className="h-4 w-4 text-primary" />
      <Select
        value={selectedUnidadeId || ""}
        onValueChange={(val) => setSelectedUnidadeId?.(val)}
      >
        <SelectTrigger className="w-[200px] h-9 input-dark text-sm">
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
    </div>
  );
}
