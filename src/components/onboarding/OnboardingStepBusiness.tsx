import { Building2 } from "lucide-react";
import { TIPOS_ESTABELECIMENTO } from "@/lib/estabelecimento-labels";

interface Props {
  tipo: string;
  setTipo: (tipo: string) => void;
}

export default function OnboardingStepBusiness({ tipo, setTipo }: Props) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#f3ecfa]">
          <Building2 className="h-6 w-6 text-[#660088]" />
        </div>
        <h2 className="text-xl font-bold text-[#1a1a2e]">
          Qual é o seu tipo de negócio?
        </h2>
        <p className="text-[#6b6b80] text-sm">
          Escolha o segmento do seu estabelecimento
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {TIPOS_ESTABELECIMENTO.map((t) => (
          <button
            key={t.value}
            onClick={() => setTipo(t.value)}
            className={`p-4 rounded-2xl border text-center transition-all duration-200 hover:scale-[1.02] hover:shadow-md ${
              tipo === t.value
                ? "border-[#660088] bg-[#f3ecfa] ring-2 ring-[#660088]/20 shadow-sm"
                : "border-[#e8e3f0] bg-[#faf8fd] hover:bg-[#f3ecfa]/50 hover:border-[#d8d0e6]"
            }`}
          >
            <span className="text-2xl block mb-2">{t.icon}</span>
            <span
              className={`text-sm font-medium ${
                tipo === t.value ? "text-[#46004e]" : "text-[#6b6b80]"
              }`}
            >
              {t.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
