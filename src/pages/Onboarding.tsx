import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  LogOut,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { THEME_PALETTES, applyThemeColors, hexToHSL } from "@/lib/theme-palettes";
import OnboardingStepBusiness from "@/components/onboarding/OnboardingStepBusiness";
import OnboardingStepProfile from "@/components/onboarding/OnboardingStepProfile";
import OnboardingStepTheme from "@/components/onboarding/OnboardingStepTheme";
import OnboardingStepContact from "@/components/onboarding/OnboardingStepContact";
import OnboardingStepServices from "@/components/onboarding/OnboardingStepServices";
import { PRESETS_SERVICOS } from "@/lib/estabelecimento-labels";

export default function Onboarding() {
  const navigate = useNavigate();
  const { refresh, empresaId, config, loading: empresaLoading } = useEmpresa();
  const [step, setStep] = useState(0);
  const [tipo, setTipo] = useState("barbearia");
  const [nome, setNome] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [corPrimaria, setCorPrimaria] = useState("271 76% 34%");
  const [corNome, setCorNome] = useState("Roxo");
  const [customHex, setCustomHex] = useState("#660088");
  const [isCustom, setIsCustom] = useState(false);
  const [saving, setSaving] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  // New State
  const [whatsapp, setWhatsapp] = useState("");
  const [instagram, setInstagram] = useState("");
  const [endereco, setEndereco] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  // If empresaId is null after loading, retry up to 3 times (handles race condition after invite link)
  useEffect(() => {
    if (!empresaLoading && !empresaId && retryCount < 3) {
      const timer = setTimeout(() => {
        setRetryCount(prev => prev + 1);
        refresh();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [empresaLoading, empresaId, retryCount, refresh]);

  // Auto-fill fields from existing empresa data
  useEffect(() => {
    if (config && empresaId) {
      if (config.nome) {
        setNome(config.nome);
      }
      if (config.tipo_estabelecimento) {
        setTipo(config.tipo_estabelecimento);
      }
      if (config.logo_url) {
        setLogoUrl(config.logo_url);
      }
      if (config.cor_primaria) {
        setCorPrimaria(config.cor_primaria);
      }
      if (config.cor_nome) {
        setCorNome(config.cor_nome);
      }
    }
  }, [config, empresaId]);

  const totalSteps = 5;
  const stepLabels = ["Negócio", "Perfil", "Contato", "Identidade", "Serviços"];

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem válida");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoUrl(reader.result as string);
    reader.readAsDataURL(file);
    setLogoFile(file);
  };

  const handleSelectPalette = (palette: (typeof THEME_PALETTES)[0]) => {
    setCorPrimaria(palette.primary);
    setCorNome(palette.name);
    setIsCustom(false);
    applyThemeColors(palette.primary);
  };

  const handleCustomColor = (hex: string) => {
    setCustomHex(hex);
    const hsl = hexToHSL(hex);
    setCorPrimaria(hsl);
    setCorNome("Personalizada");
    setIsCustom(true);
    applyThemeColors(hsl);
  };

  const handleComplete = async () => {
    if (!nome.trim()) {
      toast.error("Informe o nome da empresa");
      return;
    }

    setSaving(true);
    try {
      let finalLogoUrl: string | null = null;

      if (logoFile) {
        const fileExt = logoFile.name.split(".").pop();
        const fileName = `logo-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("logos")
          .upload(fileName, logoFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("logos").getPublicUrl(fileName);
        finalLogoUrl = urlData.publicUrl;
      }

      const payload = {
        nome: nome.trim(),
        logo_url: finalLogoUrl || config?.logo_url,
        tipo_estabelecimento: tipo,
        cor_primaria: corPrimaria,
        cor_nome: corNome,
        whatsapp: whatsapp.trim(),
        instagram: instagram.trim(),
        endereco: endereco.trim(),
        onboarding_completo: true,
      };

      if (!empresaId) {
        toast.error("Empresa não encontrada. Contate o administrador.");
        return;
      }

      // 1. Update the empresas table
      const { error: empresaError } = await supabase
        .from("empresas")
        .update(payload)
        .eq("id", empresaId);

      if (empresaError) throw empresaError;

      // 2. Insert services if any selected
      if (selectedServices.length > 0) {
        const presets = PRESETS_SERVICOS[tipo] || [];
        const servicesToInsert = presets
          .filter(p => selectedServices.includes(p.nome))
          .map(p => ({
            nome: p.nome,
            preco: p.preco,
            duracao_minutos: p.duracao,
            categoria: p.categoria,
            empresa_id: empresaId,
            status: 'active'
          }));

        const { error: servicesError } = await supabase
          .from("servicos")
          .insert(servicesToInsert);
        
        if (servicesError) console.error("Erro ao inserir serviços:", servicesError);
      }

      // 3. Add current user as first professional (optional but nice)
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        // Check if professional already exists
        const { data: existingProf } = await supabase
          .from("barbeiros")
          .select("id")
          .eq("user_id", userData.user.id)
          .maybeSingle();

        if (!existingProf) {
          // Get the default unit (Matriz)
          const { data: unitData } = await supabase
            .from("unidades")
            .select("id")
            .eq("empresa_id", empresaId)
            .eq("nome", "Matriz")
            .maybeSingle();

          await supabase.from("barbeiros").insert({
            nome: userData.user.user_metadata?.full_name || nome,
            email: userData.user.email,
            user_id: userData.user.id,
            empresa_id: empresaId,
            unidade_id: unitData?.id,
            status: 'active'
          });
        }
      }

      await refresh();
      toast.success("Sistema configurado com sucesso!");
      navigate("/", { replace: true });
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8f6fc] via-white to-[#f0ecf8] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#660088] to-[#46004e] shadow-lg shadow-[#660088]/20 mb-4">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-[#1a1a2e] tracking-tight">
            Bem-Vindo ao Sistema X
          </h1>
          <p className="text-[#6b6b80] mt-2 text-base">
            Vamos configurar tudo para o seu negócio em poucos passos
          </p>
          <div className="mt-4 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate("/login");
              }}
              className="text-[#9b8fb8] hover:text-[#660088]"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair desta conta
            </Button>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                    i < step
                      ? "bg-gradient-to-br from-[#660088] to-[#46004e] text-white shadow-md shadow-[#660088]/25"
                      : i === step
                      ? "bg-gradient-to-br from-[#660088] to-[#46004e] text-white ring-4 ring-[#660088]/15 shadow-md shadow-[#660088]/25"
                      : "bg-[#ede8f5] text-[#9b8fb8]"
                  }`}
                >
                  {i < step ? <Check className="h-5 w-5" /> : i + 1}
                </div>
                <span className={`text-[10px] font-semibold ${
                  i <= step ? "text-[#660088]" : "text-[#9b8fb8]"
                }`}>
                  {stepLabels[i]}
                </span>
              </div>
              {i < totalSteps - 1 && (
                <div className={`w-12 h-0.5 mb-4 rounded-full transition-colors duration-300 ${
                  i < step ? "bg-gradient-to-r from-[#660088] to-[#46004e]" : "bg-[#e0dae8]"
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-[#660088]/5 border border-[#ede8f5] p-8 animate-fade-in">
          {step === 0 && (
            <OnboardingStepBusiness tipo={tipo} setTipo={setTipo} />
          )}

          {step === 1 && (
            <OnboardingStepProfile
              nome={nome}
              setNome={setNome}
              logoUrl={logoUrl}
              handleLogoSelect={handleLogoSelect}
            />
          )}

          {step === 2 && (
            <OnboardingStepContact
              whatsapp={whatsapp}
              setWhatsapp={setWhatsapp}
              instagram={instagram}
              setInstagram={setInstagram}
              endereco={endereco}
              setEndereco={setEndereco}
            />
          )}

          {step === 3 && (
            <OnboardingStepTheme
              corPrimaria={corPrimaria}
              corNome={corNome}
              customHex={customHex}
              isCustom={isCustom}
              nome={nome}
              handleSelectPalette={handleSelectPalette}
              handleCustomColor={handleCustomColor}
            />
          )}

          {step === 4 && (
            <OnboardingStepServices
              tipo={tipo}
              selectedServices={selectedServices}
              setSelectedServices={setSelectedServices}
            />
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#ede8f5]">
            <Button
              variant="outline"
              onClick={() => setStep(step - 1)}
              disabled={step === 0}
              className="border-[#d8d0e6] text-[#6b6b80] hover:bg-[#f8f6fc] hover:text-[#46004e] rounded-xl"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>

            {step < totalSteps - 1 ? (
              <Button
                onClick={() => {
                  if (step === 1 && !nome.trim()) {
                    toast.error("Informe o nome da empresa");
                    return;
                  }
                  setStep(step + 1);
                }}
                className="bg-gradient-to-r from-[#660088] to-[#46004e] hover:from-[#7a00a3] hover:to-[#590063] text-white rounded-xl shadow-md shadow-[#660088]/20"
              >
                Próximo
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleComplete}
                disabled={saving}
                className="bg-gradient-to-r from-[#660088] to-[#46004e] hover:from-[#7a00a3] hover:to-[#590063] text-white rounded-xl shadow-md shadow-[#660088]/20"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Concluir Configuração
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
