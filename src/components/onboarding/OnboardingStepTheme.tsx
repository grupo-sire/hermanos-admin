import { Palette } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { THEME_PALETTES, type ThemePalette } from "@/lib/theme-palettes";

interface Props {
  corPrimaria: string;
  corNome: string;
  customHex: string;
  isCustom: boolean;
  nome: string;
  handleSelectPalette: (palette: ThemePalette) => void;
  handleCustomColor: (hex: string) => void;
}

export default function OnboardingStepTheme({
  corPrimaria,
  corNome,
  customHex,
  isCustom,
  nome,
  handleSelectPalette,
  handleCustomColor,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#f3ecfa]">
          <Palette className="h-6 w-6 text-[#660088]" />
        </div>
        <h2 className="text-xl font-bold text-[#1a1a2e]">
          Escolha as cores do sistema
        </h2>
        <p className="text-[#6b6b80] text-sm">
          Personalize a aparência do seu painel
        </p>
      </div>

      <div className="space-y-3">
        <Label className="text-[#1a1a2e] font-semibold">Paletas pré-definidas</Label>
        <div className="grid grid-cols-4 gap-3">
          {THEME_PALETTES.map((palette) => (
            <button
              key={palette.name}
              onClick={() => handleSelectPalette(palette)}
              className={`p-3 rounded-2xl border text-center transition-all duration-200 hover:scale-[1.03] hover:shadow-md ${
                corNome === palette.name && !isCustom
                  ? "border-[#660088] ring-2 ring-[#660088]/20 bg-[#f3ecfa] shadow-sm"
                  : "border-[#e8e3f0] bg-[#faf8fd] hover:border-[#d8d0e6]"
              }`}
            >
              <div
                className="w-10 h-10 rounded-full mx-auto mb-2 ring-2 ring-black/5 shadow-inner"
                style={{ backgroundColor: palette.preview }}
              />
              <span className={`text-xs font-semibold ${
                corNome === palette.name && !isCustom ? "text-[#46004e]" : "text-[#6b6b80]"
              }`}>
                {palette.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-[#1a1a2e] font-semibold">Cor personalizada</Label>
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#faf8fd] border border-[#e8e3f0]">
          <input
            type="color"
            value={customHex}
            onChange={(e) => handleCustomColor(e.target.value)}
            className="w-12 h-12 rounded-xl cursor-pointer border-2 border-[#e0dae8] bg-transparent"
          />
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#1a1a2e]">Escolha qualquer cor</p>
            <p className="text-xs text-[#9b8fb8]">
              A cor será ajustada para funcionar com o tema do sistema
            </p>
          </div>
          {isCustom && (
            <span className="text-xs px-3 py-1.5 rounded-full bg-[#f3ecfa] text-[#660088] font-semibold border border-[#660088]/20">
              Selecionada
            </span>
          )}
        </div>
      </div>

      {/* Preview */}
      <div className="p-5 rounded-2xl border border-[#e8e3f0] bg-gradient-to-r from-[#faf8fd] to-white">
        <p className="text-xs text-[#9b8fb8] mb-3 font-semibold uppercase tracking-wider">Pré-visualização</p>
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md"
            style={{ backgroundColor: `hsl(${corPrimaria})` }}
          >
            {nome ? nome.charAt(0).toUpperCase() : "X"}
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-[#1a1a2e]">{nome || "Sua Empresa"}</p>
            <p className="text-xs text-[#9b8fb8]">Sistema de Gestão</p>
          </div>
          <Button
            size="sm"
            className="text-white rounded-xl shadow-md text-xs"
            style={{ backgroundColor: `hsl(${corPrimaria})` }}
          >
            Exemplo
          </Button>
        </div>
      </div>
    </div>
  );
}
