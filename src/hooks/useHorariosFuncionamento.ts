import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Feriado {
  id: string;
  unidade_id: string | null;
  data: string;
  descricao: string;
  fechado: boolean;
  horario_abertura: string | null;
  horario_fechamento: string | null;
}

const MAP_DIA_SEMANA_INDEX: Record<number, string> = {
  0: "domingo",
  1: "segunda",
  2: "terca",
  3: "quarta",
  4: "quinta",
  5: "sexta",
  6: "sabado",
};

/** Função auxiliar para formatar Date em YYYY-MM-DD usando horário local */
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function useHorariosFuncionamento(unidadeId: string | null) {
  const [horariosSemana, setHorariosSemana] = useState<Record<string, { aberto: boolean; abertura: string; fechamento: string }> | null>(null);
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [unidadeId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [unidadeRes, feriadosRes] = await Promise.all([
        unidadeId ? supabase.from("unidades").select("horarios_semana").eq("id", unidadeId).single() : Promise.resolve({ data: null, error: null }),
        supabase.from("horarios_feriados").select("*"),
      ]);

      const savedExpedienteStr = unidadeId ? localStorage.getItem(`hermanos_unidade_expediente_${unidadeId}`) : null;

      if (savedExpedienteStr) {
        setHorariosSemana(JSON.parse(savedExpedienteStr));
      } else if (unidadeRes.data && (unidadeRes.data as any).horarios_semana) {
        setHorariosSemana((unidadeRes.data as any).horarios_semana);
      } else {
        setHorariosSemana(null);
      }

      if (feriadosRes.data) {
        setFeriados((feriadosRes.data as any) || []);
      }
    } catch (err) {
      console.error("Erro ao carregar horarios de funcionamento:", err);
    } finally {
      setLoading(false);
    }
  };

  /** Verifica se a data dada é um dia fechado na unidade ou por feriado */
  const isDayClosed = (date: Date): boolean => {
    if (!date) return false;
    const dateStr = formatLocalDate(date);

    // 1. Verificar se é feriado / exceção
    const feriado = feriados.find((f) => f.data === dateStr && (!f.unidade_id || f.unidade_id === unidadeId));
    if (feriado) {
      return feriado.fechado;
    }

    // 2. Verificar o dia da semana no expediente da unidade
    if (horariosSemana) {
      const dayOfWeekIndex = date.getDay(); // 0 = Domingo
      const diaKey = MAP_DIA_SEMANA_INDEX[dayOfWeekIndex];
      const confDia = horariosSemana[diaKey];
      if (confDia !== undefined) {
        return !confDia.aberto;
      }
    }

    // Padrão: Domingo (0) é fechado por padrão se não configurado
    if (date.getDay() === 0) return true;

    return false;
  };

  /** Retorna horários de abertura/fechamento para a data específica */
  const getHorariosForDate = (date: Date) => {
    if (!date) return null;
    const dateStr = formatLocalDate(date);
    const feriado = feriados.find((f) => f.data === dateStr && (!f.unidade_id || f.unidade_id === unidadeId));

    if (feriado) {
      return {
        aberto: !feriado.fechado,
        horario_abertura: feriado.horario_abertura || "09:00",
        horario_fechamento: feriado.horario_fechamento || "14:00",
      };
    }

    if (horariosSemana) {
      const dayOfWeekIndex = date.getDay();
      const diaKey = MAP_DIA_SEMANA_INDEX[dayOfWeekIndex];
      const confDia = horariosSemana[diaKey];

      if (confDia) {
        return {
          aberto: confDia.aberto,
          horario_abertura: confDia.abertura,
          horario_fechamento: confDia.fechamento,
        };
      }
    }

    // Padrão: Domingo fechado
    if (date.getDay() === 0) {
      return { aberto: false, horario_abertura: "09:00", horario_fechamento: "14:00" };
    }

    return {
      aberto: true,
      horario_abertura: "09:00",
      horario_fechamento: "20:00",
    };
  };

  return { horariosSemana, feriados, loading, isDayClosed, getHorariosForDate };
}
