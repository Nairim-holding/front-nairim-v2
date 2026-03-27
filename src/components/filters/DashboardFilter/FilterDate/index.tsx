"use client";

import { useState, useEffect, useRef } from "react";

interface DateFilterProps {
  initialStartDate?: string;
  initialEndDate?: string;
  onApply: (startDate: string, endDate: string) => void;
}

// Função para pegar o primeiro e último dia do mês atual
const getThisMonthRange = () => {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const format = (d: Date) => d.toISOString().split("T")[0];
  return { start: format(firstDay), end: format(lastDay) };
};

// Nomes dos meses em português
const monthNames = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const formatMonthYear = (date: string) => {
  if (!date) return "";
  const d = new Date(date);
  return `${monthNames[d.getMonth()]} / ${d.getFullYear()}`;
};

export default function FilterDate({
  initialStartDate,
  initialEndDate,
  onApply,
}: DateFilterProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const thisMonth = getThisMonthRange();

  const [isOpen, setIsOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string>("thisMonth");
  const [startDate, setStartDate] = useState<string>(
    initialStartDate || thisMonth.start
  );
  const [endDate, setEndDate] = useState<string>(
    initialEndDate || thisMonth.end
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectOption = (option: string) => {
    setSelectedOption(option);
    if (option === "thisMonth") {
      setStartDate(thisMonth.start);
      setEndDate(thisMonth.end);
    }
  };

  const applyFilter = () => {
    if (!startDate || !endDate) return;
    onApply(startDate, endDate);
    setIsOpen(false);
  };

  // Limites de 2 anos
  const maxDate = new Date().toISOString().split("T")[0];
  const minDate = new Date(
    new Date(endDate).setFullYear(new Date(endDate).getFullYear() - 2)
  )
    .toISOString()
    .split("T")[0];

  // Impede digitação fora do limite
  const handleStartDateChange = (value: string) => {
    if (value < minDate) {
      setStartDate(minDate);
    } else if (value > maxDate) {
      setStartDate(maxDate);
    } else {
      setStartDate(value);
    }
    setSelectedOption("custom");
  };

  const handleEndDateChange = (value: string) => {
    if (value < minDate) {
      setEndDate(minDate);
    } else if (value > maxDate) {
      setEndDate(maxDate);
    } else {
      setEndDate(value);
    }
    setSelectedOption("custom");
  };

  const getDisplayText = () => {
    if (selectedOption === "thisMonth") {
      const now = new Date();
      return `Período / ${monthNames[now.getMonth()]} / ${now.getFullYear()}`;
    }
    if (!startDate || !endDate) return "Período - Customizado";

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (
      start.getMonth() === end.getMonth() &&
      start.getFullYear() === end.getFullYear()
    ) {
      return `Período - ${monthNames[start.getMonth()]} - ${start.getFullYear()}`;
    }

    return `Período - ${formatMonthYear(startDate)} até ${formatMonthYear(
      endDate
    )}`;
  };

  return (
    <div className="relative flex flex-col max-w-[450px] w-full" ref={dropdownRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="cursor-pointer w-full  max-w-[450px] h-[45px] border-[2px] border-ui-border rounded-lg px-5 flex items-center justify-between bg-surface hover:shadow-md transition"
      >
        <p className="text-content-secondary">{getDisplayText()}</p>
        <span className="ml-2">
          <svg
            width="20"
            height="18"
            viewBox="0 0 20 18"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M18 7V5C18 4.73478 17.8946 4.48043 17.7071 4.29289C17.5196 4.10536 17.2652 4 17 4H16V5C16 5.26522 15.8946 5.51957 15.7071 5.70711C15.5196 5.89464 15.2652 6 15 6C14.7348 6 14.4804 5.89464 14.2929 5.70711C14.1054 5.51957 14 5.26522 14 5V4H6V5C6 5.26522 5.89464 5.51957 5.70711 5.70711C5.51957 5.89464 5.26522 6 5 6C4.73478 6 4.48043 5.89464 4.29289 5.70711C4.10536 5.51957 4 5.26522 4 5V4H3C2.73478 4 2.48043 4.10536 2.29289 4.29289C2.10536 4.48043 2 4.73478 2 5V7H18ZM18 9H2V15C2 15.2652 2.10536 15.5196 2.29289 15.7071C2.48043 15.8946 2.73478 16 3 16H17C17.2652 16 17.5196 15.8946 17.7071 15.7071C17.8946 15.5196 18 15.2652 18 15V9ZM16 2H17C17.7956 2 18.5587 2.31607 19.1213 2.87868C19.6839 3.44129 20 4.20435 20 5V15C20 15.7956 19.6839 16.5587 19.1213 17.1213C18.5587 17.6839 17.7956 18 17 18H3C2.20435 18 1.44129 17.6839 0.87868 17.1213C0.31607 16.5587 0 15.7956 0 15L0 5C0 4.20435 0.31607 3.44129 0.87868 2.87868C1.44129 2.31607 2.20435 2 3 2H4V1C4 0.734784 4.10536 0.48043 4.29289 0.292893C4.48043 0.105357 4.73478 0 5 0C5.26522 0 5.51957 0.105357 5.70711 0.292893C5.89464 0.48043 6 0.734784 6 1V2H14V1C14 0.734784 14.1054 0.48043 14.2929 0.292893C14.4804 0.105357 14.7348 0 15 0C15.2652 0 15.5196 0.105357 15.7071 0.292893C15.8946 0.48043 16 0.734784 16 1V2Z"
              fill="var(--color-text-muted)"
            />
          </svg>
        </span>
      </div>

      {isOpen && (
        <div className="absolute top-[45px] left-0 w-full max-w-[450px] bg-surface border border-ui-border rounded shadow-lg p-4 z-50">
          <div className="flex flex-col gap-2 mb-3">
            <button
              onClick={() => selectOption("thisMonth")}
              className="text-left px-2 py-1 hover:bg-surface-subtle rounded"
            >
              {`${monthNames[new Date().getMonth()]} - ${new Date().getFullYear()}`}
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-col">
              <input
                type="date"
                className="border border-ui-border rounded px-2 py-1 flex-1 w-full"
                value={startDate}
                min={minDate}
                max={maxDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
              />
              <span>até</span>
              <input
                type="date"
                className="border border-ui-border rounded px-2 py-1 flex-1 w-full"
                value={endDate}
                min={minDate}
                max={maxDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
              />
            </div>
            <button
              onClick={applyFilter}
              className="mt-2 w-full bg-brand hover:bg-brand-hover text-content-inverse py-2 rounded transition"
            >
              Filtrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
