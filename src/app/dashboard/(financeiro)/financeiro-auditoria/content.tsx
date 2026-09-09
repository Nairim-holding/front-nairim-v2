'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Settings, RefreshCw } from 'lucide-react';
import Section from '@/components/layout/PageSection';
import CalendarPicker from '@/components/ui/CalendarPicker';
import { getIptuAuditAction } from '@/server/actions/iptu-audit';
import { useMessageContext } from '@/contexts/MessageContext';
import IptuAuditSettingsModal from './_components/IptuAuditSettingsModal';
import IptuAuditTable, { type IptuAuditRow } from './_components/IptuAuditTable';
import IptuAuditChart from './_components/IptuAuditChart';
import IptuAuditComparativeChart, { type IptuAuditPeriodPoint } from './_components/IptuAuditComparativeChart';
import IptuAuditPropertyFilter, { type PropertyOption } from './_components/IptuAuditPropertyFilter';

function formatDateDisplay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

/** Ano inteiro — é o recorte natural do IPTU (Tarefa 4.1: "selecionar o ano de análise"). */
function yearRange(year: number): { from: string; to: string } {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

/** Anos oferecidos no seletor: do ano corrente até 5 anos atrás. */
const YEAR_OPTIONS = (() => {
  const current = new Date().getFullYear();
  return Array.from({ length: 6 }, (_, i) => current - i);
})();

export default function AuditoriaIptuContent() {
  const { showMessage } = useMessageContext();
  const popoverRef = useRef<HTMLDivElement>(null);
  const currentYear = useMemo(() => new Date().getFullYear(), []);

  const [selectedYear, setSelectedYear] = useState<number | null>(currentYear);
  const [dateRange, setDateRange] = useState(() => yearRange(new Date().getFullYear()));
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [hasSettings, setHasSettings] = useState<boolean | null>(null);
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);

  const [rows, setRows] = useState<IptuAuditRow[]>([]);
  const [totals, setTotals] = useState({ income: 0, expense: 0, balance: 0 });
  const [monthly, setMonthly] = useState<IptuAuditPeriodPoint[]>([]);
  const [yearly, setYearly] = useState<IptuAuditPeriodPoint[]>([]);
  const [availableProperties, setAvailableProperties] = useState<PropertyOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) setIsCalendarOpen(false);
    };
    if (isCalendarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isCalendarOpen]);

  const fetchAudit = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getIptuAuditAction({
        startDate: dateRange.from,
        endDate: dateRange.to,
        ...(selectedProperties.length > 0 ? { propertyIds: selectedProperties } : {}),
      });

      if (!result.ok) {
        // Configuração ainda não definida (400 "Configure as categorias...")
        // — não é erro, é o primeiro uso. Um erro real (500/403) também cai
        // aqui, igual ao comportamento original do fetch cru.
        setHasSettings(false);
        setRows([]);
        setTotals({ income: 0, expense: 0, balance: 0 });
        setMonthly([]);
        setYearly([]);
        return;
      }

      setHasSettings(true);
      setRows(Array.isArray(result.data?.rows) ? result.data.rows : []);
      setTotals(result.data?.totals ?? { income: 0, expense: 0, balance: 0 });
      setMonthly(Array.isArray(result.data?.monthly) ? result.data.monthly : []);
      setYearly(Array.isArray(result.data?.yearly) ? result.data.yearly : []);
      setAvailableProperties(Array.isArray(result.data?.availableProperties) ? result.data.availableProperties : []);
    } catch (error) {
      console.error('[AuditoriaIptuContent] Erro ao carregar auditoria:', error);
      showMessage('Erro ao carregar a Auditoria de IPTU.', 'error', 4000);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, selectedProperties, showMessage]);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  const handleSettingsSaved = useCallback(() => {
    setIsSettingsOpen(false);
    fetchAudit();
  }, [fetchAudit]);

  return (
    <Section title="Auditoria de IPTU">
      <div className="flex flex-col gap-4 relative">
        <div className="flex gap-3 items-center flex-wrap">
          {/* Ano de análise: o recorte padrão da auditoria. "Personalizado"
              libera o intervalo livre do calendário ao lado. */}
          <select
            value={selectedYear ?? ''}
            onChange={(e) => {
              const value = e.target.value;
              if (!value) {
                setSelectedYear(null);
                return;
              }
              const year = Number(value);
              setSelectedYear(year);
              setDateRange(yearRange(year));
            }}
            className="border border-ui-border rounded-lg px-3 py-2 text-sm text-content bg-surface hover:bg-surface-subtle focus:outline-none focus:border-brand transition-colors"
            title="Ano de análise"
          >
            {YEAR_OPTIONS.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
            <option value="">Personalizado</option>
          </select>

          <div className="relative" ref={popoverRef}>
            <button
              onClick={() => setIsCalendarOpen((o) => !o)}
              className="flex items-center gap-2 border border-ui-border rounded-lg px-3 py-2 text-sm text-content bg-surface hover:bg-surface-subtle focus:outline-none focus:border-brand transition-colors"
            >
              <Calendar size={16} className="text-content-secondary" />
              <span className="font-medium whitespace-nowrap">
                {formatDateDisplay(dateRange.from)} — {formatDateDisplay(dateRange.to)}
              </span>
            </button>
            {isCalendarOpen && (
              <div className="absolute top-full left-0 mt-2 bg-surface border border-ui-border-soft rounded-lg shadow-lg z-[200] p-4">
                <CalendarPicker
                  dateRange={dateRange}
                  onChange={(range) => {
                    setDateRange(range);
                    setSelectedYear(null);
                    setIsCalendarOpen(false);
                  }}
                />
              </div>
            )}
          </div>

          <IptuAuditPropertyFilter
            options={availableProperties}
            selected={selectedProperties}
            onChange={setSelectedProperties}
          />

          <button
            onClick={() => fetchAudit()}
            disabled={isLoading}
            className="p-2 rounded-lg border border-ui-border text-content-muted hover:text-content hover:bg-surface-subtle disabled:opacity-50 transition-colors"
            title="Recarregar"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 p-2 rounded-lg border border-ui-border text-content-muted hover:text-content hover:bg-surface-subtle transition-colors ml-auto"
            title="Configurações da Auditoria de IPTU"
          >
            <Settings size={16} />
            <span className="text-sm font-medium hidden sm:inline">Configurações</span>
          </button>
        </div>

        {hasSettings === false && !isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center border border-dashed border-ui-border rounded-xl">
            <p className="text-content-secondary text-sm max-w-md">
              Configure as categorias de Receita (restituição de IPTU) e Despesa (IPTU pago) para gerar a auditoria.
            </p>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-content-inverse text-sm font-medium hover:bg-brand-hover transition-colors"
            >
              <Settings size={16} />
              Configurar agora
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <IptuAuditComparativeChart rows={rows} monthly={monthly} yearly={yearly} isLoading={isLoading} />
              <IptuAuditChart rows={rows} isLoading={isLoading} />
            </div>
            <IptuAuditTable rows={rows} totals={totals} isLoading={isLoading} />
          </>
        )}
      </div>

      {isSettingsOpen && (
        <IptuAuditSettingsModal
          onClose={() => setIsSettingsOpen(false)}
          onSaved={handleSettingsSaved}
        />
      )}
    </Section>
  );
}
