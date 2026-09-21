import { Check, Scissors } from "lucide-react";
import { PRESETS_SERVICOS } from "@/lib/estabelecimento-labels";

interface Props {
  tipo: string;
  selectedServices: string[];
  setSelectedServices: (services: string[]) => void;
}

export default function OnboardingStepServices({ 
  tipo, 
  selectedServices, 
  setSelectedServices 
}: Props) {
  const presets = PRESETS_SERVICOS[tipo] || [];

  const toggleService = (nome: string) => {
    if (selectedServices.includes(nome)) {
      setSelectedServices(selectedServices.filter(s => s !== nome));
    } else {
      setSelectedServices([...selectedServices, nome]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#f3ecfa]">
          <Scissors className="h-6 w-6 text-[#660088]" />
        </div>
        <h2 className="text-xl font-bold text-[#1a1a2e]">
          Quais serviços você oferece?
        </h2>
        <p className="text-[#6b6b80] text-sm">
          Selecione os serviços iniciais para agilizar sua configuração
        </p>
      </div>

      <div className="grid gap-3">
        {presets.length > 0 ? (
          presets.map((service) => (
            <button
              key={service.nome}
              onClick={() => toggleService(service.nome)}
              className={`p-4 rounded-2xl border text-left transition-all duration-200 flex items-center justify-between ${
                selectedServices.includes(service.nome)
                  ? "border-[#660088] bg-[#f3ecfa] ring-2 ring-[#660088]/20"
                  : "border-[#e8e3f0] bg-[#faf8fd] hover:bg-[#f3ecfa]/50"
              }`}
            >
              <div>
                <span className="font-bold text-[#1a1a2e] block">{service.nome}</span>
                <span className="text-xs text-[#6b6b80]">
                  {service.duracao} min • R$ {service.preco}
                </span>
              </div>
              <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${
                selectedServices.includes(service.nome)
                  ? "bg-[#660088] border-[#660088] text-white"
                  : "border-[#d8d0e6] bg-white"
              }`}>
                {selectedServices.includes(service.nome) && <Check className="h-4 w-4" />}
              </div>
            </button>
          ))
        ) : (
          <div className="text-center p-8 border-2 border-dashed border-[#e8e3f0] rounded-2xl">
            <p className="text-[#6b6b80] text-sm">
              Nenhum serviço sugerido para este tipo de negócio. 
              Você poderá adicioná-los no painel.
            </p>
          </div>
        )}
      </div>

      <p className="text-center text-[10px] text-[#9b8fb8]">
        Você poderá editar preços e adicionar outros serviços depois no painel.
      </p>
    </div>
  );
}
