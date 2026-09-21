import { MessageSquare, Instagram, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  whatsapp: string;
  setWhatsapp: (val: string) => void;
  instagram: string;
  setInstagram: (val: string) => void;
  endereco: string;
  setEndereco: (val: string) => void;
}

export default function OnboardingStepContact({ 
  whatsapp, setWhatsapp, 
  instagram, setInstagram, 
  endereco, setEndereco 
}: Props) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#f3ecfa]">
          <MessageSquare className="h-6 w-6 text-[#660088]" />
        </div>
        <h2 className="text-xl font-bold text-[#1a1a2e]">
          Como os clientes te encontram?
        </h2>
        <p className="text-[#6b6b80] text-sm">
          Essas informações aparecerão na sua página de agendamento
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="whatsapp" className="text-[#46004e] font-semibold">WhatsApp Business</Label>
          <div className="relative">
            <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-[#9b8fb8]" />
            <Input
              id="whatsapp"
              placeholder="(00) 00000-0000"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className="pl-10 border-[#e8e3f0] focus:border-[#660088] rounded-xl"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="instagram" className="text-[#46004e] font-semibold">Instagram (@usuario)</Label>
          <div className="relative">
            <Instagram className="absolute left-3 top-3 h-4 w-4 text-[#9b8fb8]" />
            <Input
              id="instagram"
              placeholder="@seu_negocio"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              className="pl-10 border-[#e8e3f0] focus:border-[#660088] rounded-xl"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="endereco" className="text-[#46004e] font-semibold">Endereço Principal</Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-3 h-4 w-4 text-[#9b8fb8]" />
            <Input
              id="endereco"
              placeholder="Rua, Número, Bairro, Cidade"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              className="pl-10 border-[#e8e3f0] focus:border-[#660088] rounded-xl"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
