import { Upload, Image as ImageIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface Props {
  nome: string;
  setNome: (nome: string) => void;
  logoUrl: string | null;
  handleLogoSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function OnboardingStepProfile({ nome, setNome, logoUrl, handleLogoSelect }: Props) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#f3ecfa]">
          <ImageIcon className="h-6 w-6 text-[#660088]" />
        </div>
        <h2 className="text-xl font-bold text-[#1a1a2e]">
          Configure seu estabelecimento
        </h2>
        <p className="text-[#6b6b80] text-sm">
          Defina o nome e a logo do seu negócio
        </p>
      </div>
      <div className="max-w-md mx-auto space-y-6">
        <div className="space-y-2">
          <Label htmlFor="empresa-nome" className="text-[#1a1a2e] font-semibold">Nome da Empresa (Bloqueado)</Label>
          <Input
            id="empresa-nome"
            value={nome}
            readOnly
            placeholder="Ex: Barbearia Premium"
            className="bg-[#f3ecfa] border-[#e0dae8] text-[#6b6b80] placeholder:text-[#b0a8c0] rounded-xl text-lg h-12 cursor-not-allowed opacity-80"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[#1a1a2e] font-semibold">Logo (opcional)</Label>
          <div className="flex items-center gap-4">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo"
                className="w-20 h-20 rounded-2xl object-cover border-2 border-[#ede8f5] shadow-sm"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-[#f3ecfa] flex items-center justify-center border-2 border-dashed border-[#d8d0e6]">
                <ImageIcon className="h-8 w-8 text-[#9b8fb8]" />
              </div>
            )}
            <div>
              <Button type="button" variant="outline" className="border-[#d8d0e6] text-[#46004e] hover:bg-[#f3ecfa] rounded-xl" asChild>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoSelect}
                  />
                  <span>
                    <Upload className="h-4 w-4 mr-2" />
                    {logoUrl ? "Trocar Logo" : "Enviar Logo"}
                  </span>
                </label>
              </Button>
              <p className="text-xs text-[#9b8fb8] mt-1">PNG, JPG até 2MB</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
