"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type ViewMode = "days" | "months" | "years";

export interface CalendarPickerProps {
  dateRange: { from: string; to: string };
  onChange: (range: { from: string; to: string }) => void;
}

function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatISO(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MONTH_NAMES_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const WEEK_DAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const YEARS_PER_PAGE = 12;

export default function CalendarPicker({ dateRange, onChange }: CalendarPickerProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selecting, setSelecting] = useState<"from" | "to">("from");
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("days");
  const [yearPageStart, setYearPageStart] = useState(() => {
    const y = new Date().getFullYear();
    return Math.floor(y / YEARS_PER_PAGE) * YEARS_PER_PAGE;
  });

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const days: Array<number | null> = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= lastDate; i++) days.push(i);
    return days;
  };

  const effectiveFrom = pendingFrom ?? dateRange.from;

  const isInRange = (day: number) => {
    const str = formatISO(currentMonth.getFullYear(), currentMonth.getMonth() + 1, day);
    const from = pendingFrom ?? dateRange.from;
    const to = pendingFrom ? null : dateRange.to;
    if (!from || !to) return false;
    return str > from && str < to;
  };

  const isSelected = (day: number, type: "from" | "to") => {
    const str = formatISO(currentMonth.getFullYear(), currentMonth.getMonth() + 1, day);
    if (type === "from") return str === (pendingFrom ?? dateRange.from);
    return !pendingFrom && str === dateRange.to;
  };

  const isToday = (day: number) => {
    const today = new Date();
    return day === today.getDate() &&
      currentMonth.getMonth() === today.getMonth() &&
      currentMonth.getFullYear() === today.getFullYear();
  };

  const handleDayClick = (day: number) => {
    const dateStr = formatISO(currentMonth.getFullYear(), currentMonth.getMonth() + 1, day);
    if (selecting === "from") {
      setPendingFrom(dateStr);
      setSelecting("to");
    } else {
      const from = pendingFrom ?? dateRange.from;
      if (dateStr <= from) {
        onChange({ from: dateStr, to: from });
      } else {
        onChange({ from, to: dateStr });
      }
      setPendingFrom(null);
      setSelecting("from");
    }
  };

  const handleMonthSelect = (monthIndex: number) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), monthIndex, 1));
    setViewMode("days");
  };

  const handleYearSelect = (year: number) => {
    setCurrentMonth(new Date(year, currentMonth.getMonth(), 1));
    setViewMode("months");
  };

  const years = Array.from({ length: YEARS_PER_PAGE }, (_, i) => yearPageStart + i);

  const displayFrom = pendingFrom ?? dateRange.from;
  const displayTo = pendingFrom ? null : dateRange.to;

  return (
    <div className="w-[224px]">
      {/* Instruction */}
      <div className="mb-2 text-[11px] text-content-secondary bg-surface-subtle rounded-md p-1.5 flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse shrink-0" />
        {selecting === "from"
          ? <span>Clique na <strong>data inicial</strong></span>
          : <span>Clique na <strong>data final</strong></span>}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <button
          type="button"
          onClick={() => {
            if (viewMode === "days") setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
            else if (viewMode === "months") setCurrentMonth(new Date(currentMonth.getFullYear() - 1, currentMonth.getMonth(), 1));
            else setYearPageStart(y => y - YEARS_PER_PAGE);
          }}
          className="p-1 hover:bg-surface-subtle rounded transition-colors"
        >
          <ChevronLeft size={16} className="text-content-secondary" />
        </button>

        <button
          type="button"
          onClick={() => {
            if (viewMode === "days") setViewMode("months");
            else if (viewMode === "months") setViewMode("years");
            else setViewMode("days");
          }}
          className="text-xs font-semibold text-content hover:text-brand transition-colors px-1 py-0.5 rounded hover:bg-surface-subtle"
        >
          {viewMode === "days" && (
            <>{MONTH_NAMES_FULL[currentMonth.getMonth()]} <span className="text-content-muted font-normal">{currentMonth.getFullYear()}</span></>
          )}
          {viewMode === "months" && (
            <span>{currentMonth.getFullYear()}</span>
          )}
          {viewMode === "years" && (
            <span>{yearPageStart} – {yearPageStart + YEARS_PER_PAGE - 1}</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            if (viewMode === "days") setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
            else if (viewMode === "months") setCurrentMonth(new Date(currentMonth.getFullYear() + 1, currentMonth.getMonth(), 1));
            else setYearPageStart(y => y + YEARS_PER_PAGE);
          }}
          className="p-1 hover:bg-surface-subtle rounded transition-colors"
        >
          <ChevronRight size={16} className="text-content-secondary" />
        </button>
      </div>

      {/* Day view */}
      {viewMode === "days" && (
        <>
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {WEEK_DAYS.map((d, i) => (
              <div key={i} className="text-center text-[10px] font-semibold text-content-muted py-0.5">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {getDaysInMonth(currentMonth).map((day, i) => (
              <div key={i} className="aspect-square">
                {day ? (
                  <button
                    type="button"
                    onClick={() => handleDayClick(day)}
                    className={`w-full h-full rounded-md text-xs font-medium transition-all relative ${
                      isSelected(day, "from") && isSelected(day, "to")
                        ? "bg-brand text-content-inverse shadow-sm"
                        : isSelected(day, "from")
                        ? "bg-brand text-content-inverse shadow-sm ring-2 ring-brand/30"
                        : isSelected(day, "to")
                        ? "bg-brand text-content-inverse shadow-sm ring-2 ring-brand/30"
                        : isInRange(day)
                        ? "bg-brand/15 text-brand hover:bg-brand/25"
                        : isToday(day)
                        ? "ring-1 ring-brand text-brand hover:bg-surface-subtle"
                        : "hover:bg-surface-subtle text-content-secondary"
                    }`}
                  >
                    <span className="relative z-10">{day}</span>
                    {isSelected(day, "from") && !isSelected(day, "to") && (
                      <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[7px] font-normal text-brand">De</span>
                    )}
                    {isSelected(day, "to") && !isSelected(day, "from") && (
                      <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[7px] font-normal text-brand">Até</span>
                    )}
                  </button>
                ) : (
                  <div className="w-full h-full" />
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Month view */}
      {viewMode === "months" && (
        <div className="grid grid-cols-3 gap-1 mt-1">
          {MONTH_NAMES.map((name, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleMonthSelect(i)}
              className={`py-2 rounded-md text-xs font-medium transition-colors ${
                i === currentMonth.getMonth()
                  ? "bg-brand text-content-inverse"
                  : "hover:bg-surface-subtle text-content-secondary"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {/* Year view */}
      {viewMode === "years" && (
        <div className="grid grid-cols-3 gap-1 mt-1">
          {years.map(year => (
            <button
              key={year}
              type="button"
              onClick={() => handleYearSelect(year)}
              className={`py-2 rounded-md text-xs font-medium transition-colors ${
                year === currentMonth.getFullYear()
                  ? "bg-brand text-content-inverse"
                  : "hover:bg-surface-subtle text-content-secondary"
              }`}
            >
              {year}
            </button>
          ))}
        </div>
      )}

      {/* Summary */}
      <div className="mt-2 text-center">
        <div className="inline-flex items-center gap-1.5 bg-surface-subtle rounded-md px-2 py-1">
          <span className="text-xs font-medium text-content">
            {displayFrom ? parseDateString(displayFrom).toLocaleDateString("pt-BR") : "--/--/----"}
          </span>
          <span className="text-content-muted text-xs">→</span>
          <span className="text-xs font-medium text-content">
            {displayTo ? parseDateString(displayTo).toLocaleDateString("pt-BR") : "--/--/----"}
          </span>
        </div>
      </div>
    </div>
  );
}
