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

function formatDateISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDateDisplay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function getDefaultDateRange(): { from: string; to: string } {
  const today = new Date();
  const first = new Date(today.getFullYear(), 0, 1);
  return { from: formatDateISO(first), to: formatDateISO(today) };
}

export default function AuditoriaIptuContent() {
  const { showMessage } = useMessageContext();
  const popoverRef = useRef<HTMLDivElement>(null);
  const defaults = useMemo(() => getDefaultDateRange(), []);

  const [dateRange, setDateRange] = useState(defaults);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [hasSettings, setHasSettings] = useState<boolean | null>(null);

  const [rows, setRows] = useState<IptuAuditRow[]>([]);
  const [totals, setTotals] = useState({ income: 0, expense: 0, balance: 0 });
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
      const result = await getIptuAuditAction({ startDate: dateRange.from, endDate: dateRange.to });

      if (!result.ok) {
        // Configuração ainda não definida (400 "Configure as categorias...")
        // — não é erro, é o primeiro uso. Um erro real (500/403) também cai
        // aqui, igual ao comportamento original do fetch cru.
        setHasSettings(false);
        setRows([]);
        setTotals({ income: 0, expense: 0, balance: 0 });
        return;
      }

      setHasSettings(true);
      setRows(Array.isArray(result.data?.rows) ? result.data.rows : []);
      setTotals(result.data?.totals ?? { income: 0, expense: 0, balance: 0 });
    } catch (error) {
      console.error('[AuditoriaIptuContent] Erro ao carregar auditoria:', error);
      showMessage('Erro ao carregar a Auditoria de IPTU.', 'error', 4000);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, showMessage]);

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
                    setIsCalendarOpen(false);
                  }}
                />
              </div>
            )}
          </div>
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
            <div className="h-[320px]">
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
