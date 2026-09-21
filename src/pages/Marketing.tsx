import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Target, Star, TrendingUp, Layout } from "lucide-react";
import CRM from "./CRM";
import OrigemTrafegoSection from "@/components/marketing/OrigemTrafegoSection";
import AvaliacoesReputacaoSection from "@/components/marketing/AvaliacoesReputacaoSection";
import LtvRetencaoSection from "@/components/marketing/LtvRetencaoSection";
import VitrineAgendamentoSection from "@/components/marketing/VitrineAgendamentoSection";

export default function Marketing() {
  const [activeTab, setActiveTab] = useState("crm");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketing & Performance"
        description="Gestão unificada do CRM & WhatsApp IA, Atribuição de Tráfego, Reputação Google Business, LTV & Retenção e Vitrine."
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 p-1 rounded-xl h-auto flex-wrap gap-1 shadow-sm">
          <TabsTrigger
            value="crm"
            className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-900 dark:data-[state=active]:text-zinc-100 text-zinc-600 dark:text-zinc-400 font-semibold data-[state=active]:shadow-sm"
          >
            <MessageSquare className="h-4 w-4 text-emerald-500" />
            CRM & WhatsApp IA
          </TabsTrigger>

          <TabsTrigger
            value="trafego"
            className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-900 dark:data-[state=active]:text-zinc-100 text-zinc-600 dark:text-zinc-400 font-semibold data-[state=active]:shadow-sm"
          >
            <Target className="h-4 w-4 text-blue-500" />
            Origem de Tráfego
          </TabsTrigger>

          <TabsTrigger
            value="avaliacoes"
            className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-900 dark:data-[state=active]:text-zinc-100 text-zinc-600 dark:text-zinc-400 font-semibold data-[state=active]:shadow-sm"
          >
            <Star className="h-4 w-4 text-amber-500 fill-amber-500/20" />
            Avaliações & Reputação
          </TabsTrigger>

          <TabsTrigger
            value="ltv"
            className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-900 dark:data-[state=active]:text-zinc-100 text-zinc-600 dark:text-zinc-400 font-semibold data-[state=active]:shadow-sm"
          >
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            LTV & Retenção
          </TabsTrigger>

          <TabsTrigger
            value="vitrine"
            className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-900 dark:data-[state=active]:text-zinc-100 text-zinc-600 dark:text-zinc-400 font-semibold data-[state=active]:shadow-sm"
          >
            <Layout className="h-4 w-4 text-purple-500" />
            Vitrine do Agendamento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="crm" className="m-0 focus-visible:outline-none">
          <CRM />
        </TabsContent>

        <TabsContent value="trafego" className="m-0 focus-visible:outline-none">
          <OrigemTrafegoSection />
        </TabsContent>

        <TabsContent value="avaliacoes" className="m-0 focus-visible:outline-none">
          <AvaliacoesReputacaoSection />
        </TabsContent>

        <TabsContent value="ltv" className="m-0 focus-visible:outline-none">
          <LtvRetencaoSection />
        </TabsContent>

        <TabsContent value="vitrine" className="m-0 focus-visible:outline-none">
          <VitrineAgendamentoSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
