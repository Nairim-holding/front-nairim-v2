"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface CalendarPickerProps {
  dateRange: { from: string; to: string };
  onChange: (range: { from: string; to: string }) => void;
}

// Helper para converter string de data para Date local (sem timezone issues)
function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export default function CalendarPicker({ dateRange, onChange }: CalendarPickerProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selecting, setSelecting] = useState<'from' | 'to'>('from');

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    
    const days: Array<{ date: number | null; isCurrentMonth: boolean }> = [];
    
    // Empty cells for days before the first day of month
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push({ date: null, isCurrentMonth: false });
    }
    
    // Days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: i, isCurrentMonth: true });
    }
    
    return days;
  };

  const isDateInRange = (day: number) => {
    if (!dateRange.from || !dateRange.to) return false;
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return dateStr > dateRange.from && dateStr < dateRange.to;
  };

  const isDateSelected = (day: number, type: 'from' | 'to') => {
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return dateStr === (type === 'from' ? dateRange.from : dateRange.to);
  };

  const isToday = (day: number) => {
    const today = new Date();
    return day === today.getDate() && 
           currentMonth.getMonth() === today.getMonth() && 
           currentMonth.getFullYear() === today.getFullYear();
  };

  const handleDateClick = (day: number) => {
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    if (selecting === 'from') {
      onChange({ from: dateStr, to: dateStr });
      setSelecting('to');
    } else {
      if (dateStr < dateRange.from) {
        onChange({ from: dateStr, to: dateRange.from });
      } else {
        onChange({ from: dateRange.from, to: dateStr });
      }
      setSelecting('from');
    }
  };

  const days = getDaysInMonth(currentMonth);

  return (
    <div className="mb-2">
      {/* Instruction compacta */}
      <div className="mb-2 text-[11px] text-content-secondary bg-surface-subtle rounded-md p-1.5">
        {selecting === 'from' ? (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
            Clique na <strong>data inicial</strong>
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
            Agora clique na <strong>data final</strong>
          </span>
        )}
      </div>

      {/* Header com mês/ano e navegação */}
      <div className="flex items-center justify-between mb-2 px-1">
        <button
          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
          className="p-1 hover:bg-surface-subtle rounded transition-colors"
        >
          <ChevronLeft size={16} className="text-content-secondary" />
        </button>
        <span className="text-xs font-semibold text-content">
          {monthNames[currentMonth.getMonth()]} <span className="text-content-muted font-normal">{currentMonth.getFullYear()}</span>
        </span>
        <button
          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
          className="p-1 hover:bg-surface-subtle rounded transition-colors"
        >
          <ChevronRight size={16} className="text-content-secondary" />
        </button>
      </div>

      {/* Dias da semana */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {weekDays.map((day, i) => (
          <div key={i} className="text-center text-[10px] font-semibold text-content-muted py-0.5">
            {day}
          </div>
        ))}
      </div>

      {/* Grid de dias - mais compacto */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day, index) => (
          <div key={index} className="aspect-square">
            {day.date ? (
              <button
                onClick={() => handleDateClick(day.date!)}
                className={`w-full h-full rounded-md text-xs font-medium transition-all relative ${
                  isDateSelected(day.date!, 'from') && isDateSelected(day.date!, 'to')
                    ? 'bg-brand text-content-inverse shadow-sm'
                    : isDateSelected(day.date!, 'from')
                    ? 'bg-brand text-content-inverse shadow-sm ring-2 ring-brand/30'
                    : isDateSelected(day.date!, 'to')
                    ? 'bg-brand text-content-inverse shadow-sm ring-2 ring-brand/30'
                    : isDateInRange(day.date!)
                    ? 'bg-brand/15 text-brand hover:bg-brand/25'
                    : isToday(day.date!)
                    ? 'ring-1 ring-brand text-brand hover:bg-surface-subtle'
                    : 'hover:bg-surface-subtle text-content-secondary'
                }`}
              >
                <span className="relative z-10">{day.date}</span>
                {isDateSelected(day.date!, 'from') && !isDateSelected(day.date!, 'to') && (
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[7px] font-normal text-brand">De</span>
                )}
                {isDateSelected(day.date!, 'to') && !isDateSelected(day.date!, 'from') && (
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[7px] font-normal text-brand">Até</span>
                )}
              </button>
            ) : (
              <div className="w-full h-full" />
            )}
          </div>
        ))}
      </div>

      {/* Resumo compacto */}
      <div className="mt-2 text-center">
        <div className="inline-flex items-center gap-1.5 bg-surface-subtle rounded-md px-2 py-1">
          <span className="text-xs font-medium text-content">
            {dateRange.from ? parseDateString(dateRange.from).toLocaleDateString('pt-BR') : '--/--/----'}
          </span>
          <span className="text-content-muted text-xs">→</span>
          <span className="text-xs font-medium text-content">
            {dateRange.to ? parseDateString(dateRange.to).toLocaleDateString('pt-BR') : '--/--/----'}
          </span>
        </div>
      </div>
    </div>
  );
}
