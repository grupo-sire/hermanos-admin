import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay, addMinutes, parseISO, isWithinInterval } from "date-fns";

interface Appointment {
  id: string;
  barbeiro_id: string;
  data_hora: string;
  duracao_minutos: number;
  status: string;
}

interface Block {
  id: string;
  barbeiro_id: string | null;
  data_inicio: string;
  data_fim: string;
}

export function useAvailability() {
  const [loading, setLoading] = useState(false);

  const fetchBusySlots = useCallback(async (date: Date, empresaId: string, unidadeId?: string) => {
    setLoading(true);
    try {
      const start = startOfDay(date).toISOString();
      const end = endOfDay(date).toISOString();

      // Fetch appointments
      let agQuery = supabase
        .from("agendamentos")
        .select("id, barbeiro_id, data_hora, duracao_minutos, status")
        .eq("empresa_id", empresaId)
        .gte("data_hora", start)
        .lte("data_hora", end)
        .neq("status", "cancelado");

      if (unidadeId) agQuery = agQuery.eq("unidade_id", unidadeId);

      // Fetch blocks
      let blQuery = supabase
        .from("agenda_bloqueios")
        .select("id, barbeiro_id, data_inicio, data_fim")
        .eq("empresa_id", empresaId)
        .gte("data_fim", start)
        .lte("data_inicio", end);

      if (unidadeId) blQuery = blQuery.eq("unidade_id", unidadeId);

      const [agRes, blRes] = await Promise.all([agQuery, blQuery]);

      return {
        appointments: (agRes.data || []) as Appointment[],
        blocks: (blRes.data || []) as Block[],
      };
    } finally {
      setLoading(false);
    }
  }, []);

  const isProfessionalAvailable = useCallback((
    time: string, // "HH:mm"
    date: Date,
    duration: number,
    professionalId: string,
    busyData: { appointments: Appointment[]; blocks: Block[] }
  ) => {
    const [h, m] = time.split(":").map(Number);
    const slotStart = new Date(date);
    slotStart.setHours(h, m, 0, 0);
    const slotEnd = addMinutes(slotStart, duration);

    // Check appointments
    const hasAppointmentOverlap = busyData.appointments.some(ag => {
      if (ag.barbeiro_id !== professionalId) return false;
      const agStart = parseISO(ag.data_hora);
      const agEnd = addMinutes(agStart, ag.duracao_minutos);
      
      return (
        (slotStart >= agStart && slotStart < agEnd) || // Slot starts during appointment
        (slotEnd > agStart && slotEnd <= agEnd) ||    // Slot ends during appointment
        (agStart >= slotStart && agStart < slotEnd)    // Appointment starts during slot
      );
    });

    if (hasAppointmentOverlap) return false;

    // Check blocks
    const hasBlockOverlap = busyData.blocks.some(bl => {
      // If block has no professionalId, it blocks everyone in the unit
      if (bl.barbeiro_id && bl.barbeiro_id !== professionalId) return false;
      
      const blStart = parseISO(bl.data_inicio);
      const blEnd = parseISO(bl.data_fim);

      return (
        (slotStart >= blStart && slotStart < blEnd) ||
        (slotEnd > blStart && slotEnd <= blEnd) ||
        (blStart >= slotStart && blStart < slotEnd)
      );
    });

    if (hasBlockOverlap) return false;

    return true;
  }, []);

  return {
    loading,
    fetchBusySlots,
    isProfessionalAvailable,
  };
}
