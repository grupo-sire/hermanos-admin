import * as React from "react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateRangePickerProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  className?: string;
}

const presets = [
  {
    label: "Hoje",
    getValue: () => ({
      from: startOfDay(new Date()),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: "Ontem",
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 1)),
      to: endOfDay(subDays(new Date(), 1)),
    }),
  },
  {
    label: "Últimos 7 dias",
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 6)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: "Últimos 30 dias",
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 29)),
      to: endOfDay(new Date()),
    }),
  },
];

export function DateRangePicker({
  dateRange,
  onDateRangeChange,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [internalRange, setInternalRange] = React.useState<DateRange | undefined>(dateRange);

  // Sync internal range when popover opens or dateRange changes from outside
  React.useEffect(() => {
    if (open) {
      setInternalRange(dateRange);
    }
  }, [open, dateRange]);

  const isSameDayStr = (d1?: Date, d2?: Date) => {
    if (!d1 || !d2) return false;
    return format(d1, "yyyy-MM-dd") === format(d2, "yyyy-MM-dd");
  };

  const getDisplayLabel = () => {
    if (!dateRange?.from) return "Selecionar período";

    for (const preset of presets) {
      const presetRange = preset.getValue();
      if (
        isSameDayStr(dateRange.from, presetRange.from) &&
        isSameDayStr(dateRange.to, presetRange.to)
      ) {
        return preset.label;
      }
    }

    if (dateRange.to && !isSameDayStr(dateRange.from, dateRange.to)) {
      return `${format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} - ${format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}`;
    }
    return format(dateRange.from, "dd/MM/yyyy", { locale: ptBR });
  };

  const handleCalendarSelect = (range: DateRange | undefined) => {
    if (!range) {
      setInternalRange(undefined);
      return;
    }

    // 1º Clique: Selecionou apenas a data inicial (from), aguarda o 2º clique!
    if (range.from && !range.to) {
      setInternalRange({ from: range.from, to: undefined });
      return;
    }

    // 2º Clique: Selecionou a data final (to) -> Aplica o período e fecha o popover!
    if (range.from && range.to) {
      const fromDate = range.from < range.to ? range.from : range.to;
      const toDate = range.from < range.to ? range.to : range.from;

      const finalRange = {
        from: startOfDay(fromDate),
        to: endOfDay(toDate),
      };

      setInternalRange(finalRange);
      onDateRangeChange(finalRange);
      setOpen(false); // Fecha automaticamente no 2º clique!
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-between text-left font-normal btn-soft min-w-[200px]",
            !dateRange && "text-muted-foreground",
            className
          )}
        >
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            <span>{getDisplayLabel()}</span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="flex">
          <div className="border-r border-border p-3 space-y-1">
            {presets.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className="w-full justify-start text-sm"
                onClick={() => {
                  onDateRangeChange(preset.getValue());
                  setOpen(false);
                }}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <div className="p-3">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={internalRange}
              onSelect={handleCalendarSelect}
              numberOfMonths={2}
              locale={ptBR}
              className="pointer-events-auto"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
