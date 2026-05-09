'use client';

import { useState, useCallback, useMemo } from 'react';
import { useMessageContext } from '@/contexts';
import { maskCurrencyInput, parseCurrencyFromPTBR } from '@/utils/formatters';
import { authFetch } from '@/utils/authFetch';
import type { DashboardItem, CategoryDashboard } from './types';

const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const initAmount = (v?: number | null): string => {
  if (!v) return '';
  return maskCurrencyInput(Math.round(v * 100).toString());
};

interface Props {
  item: DashboardItem | CategoryDashboard;
  year: number;
  onClose: () => void;
  onSaved: () => void;
}

export default function PlanningEditModal({ item, year, onClose, onSaved }: Props) {
  const { showMessage } = useMessageContext();

  const categoryId = useMemo(() => {
    if ('type' in item) return item.id;
    return item.id;
  }, [item]);

  const [planType, setPlanType] = useState<'FIXED' | 'VARIABLE'>('FIXED');
  const [defaultAmount, setDefaultAmount] = useState('');
  const [monthlyValues, setMonthlyValues] = useState<Record<number, string>>({});
  const [minRecommended, setMinRecommended] = useState(() => initAmount(item.min));
  const [maxRecommended, setMaxRecommended] = useState(() => initAmount(item.max));
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const planningId = useMemo(() => {
    return 'planning_id' in item ? item.planning_id : undefined;
  }, [item]);

  const hasExistingPlanning = useMemo(() => {
    return item.planned_amount > 0 && planningId;
  }, [item, planningId]);

  const applyMask = useCallback(
    (setter: (v: string) => void) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setter(maskCurrencyInput(e.target.value.replace(/\D/g, '')));
      },
    [],
  );

  const handleMonthChange = useCallback((month: number, raw: string) => {
    setMonthlyValues(prev => ({ ...prev, [month]: maskCurrencyInput(raw.replace(/\D/g, '')) }));
  }, []);

  const handleSave = useCallback(async () => {
    if (planType === 'FIXED' && !defaultAmount) {
      showMessage('Informe um valor para o planejamento fixo', 'error');
      return;
    }

    if (planType === 'VARIABLE' && !Object.values(monthlyValues).some(v => v)) {
      showMessage('Informe pelo menos um valor mensal', 'error');
      return;
    }

    const minRecValue = minRecommended ? parseCurrencyFromPTBR(minRecommended) : undefined;
    const maxRecValue = maxRecommended ? parseCurrencyFromPTBR(maxRecommended) : undefined;

    if (minRecValue !== undefined && maxRecValue !== undefined && minRecValue >= maxRecValue) {
      showMessage('O mínimo recomendado deve ser menor que o máximo', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        category_id: categoryId,
        year,
        type: planType,
      };

      if (planType === 'FIXED') {
        payload.default_amount = parseCurrencyFromPTBR(defaultAmount);
      } else {
        payload.monthly_values = MONTH_NAMES.map((_, i) => ({
          month: i + 1,
          amount: parseCurrencyFromPTBR(monthlyValues[i + 1] ?? '0'),
        })).filter(mv => mv.amount > 0);
      }

      if (minRecValue !== undefined) payload.min_recommended = minRecValue;
      if (maxRecValue !== undefined) payload.max_recommended = maxRecValue;

      const res = await authFetch(`${API_URL}/planning`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Erro ao salvar');
      }

      showMessage('Planejamento salvo com sucesso', 'success');
      onSaved();
    } catch (e) {
      showMessage(e instanceof Error ? e.message : 'Erro ao salvar planejamento', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [categoryId, year, planType, defaultAmount, monthlyValues, minRecommended, maxRecommended, showMessage, onSaved]);

  const handleDelete = useCallback(async () => {
    if (!hasExistingPlanning || !planningId) return;

    if (!window.confirm('Tem certeza que deseja remover este planejamento?')) return;

    setIsDeleting(true);
    try {
      const res = await authFetch(`${API_URL}/planning/${planningId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error();
      showMessage('Planejamento removido com sucesso', 'success');
      onSaved();
    } catch (e) {
      showMessage('Erro ao remover planejamento', 'error');
    } finally {
      setIsDeleting(false);
    }
  }, [hasExistingPlanning, planningId, showMessage, onSaved]);

  const inputClass =
    'w-full border border-ui-border rounded-lg px-3 py-2 text-sm text-content bg-surface focus:outline-none focus:border-brand';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'var(--color-overlay)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-xs text-content-muted uppercase tracking-wide">
              {'type' in item ? item.name : item.name}
            </p>
            <h2 className="text-lg font-semibold text-content">{item.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-content-muted hover:text-content text-2xl leading-none ml-4"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          {(['FIXED', 'VARIABLE'] as const).map(t => (
            <button
              key={t}
              onClick={() => setPlanType(t)}
              className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                planType === t
                  ? 'bg-brand text-white'
                  : 'bg-surface-subtle text-content-secondary hover:bg-surface-muted'
              }`}
            >
              {t === 'FIXED' ? 'Fixo (1 valor)' : 'Variável (12 meses)'}
            </button>
          ))}
        </div>

        {planType === 'FIXED' ? (
          <div className="mb-5">
            <label className="block text-xs font-medium text-content-muted mb-1">
              Valor mensal (R$)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={defaultAmount}
              onChange={applyMask(setDefaultAmount)}
              placeholder="0,00"
              className={inputClass}
              autoFocus
            />
          </div>
        ) : (
          <div className="mb-5">
            <label className="block text-xs font-medium text-content-muted mb-2">Valores mensais (R$)</label>
            <div className="grid grid-cols-3 gap-3">
              {MONTH_NAMES.map((name, i) => (
                <div key={i}>
                  <label className="block text-xs font-medium text-content-secondary mb-1">{name}</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={monthlyValues[i + 1] ?? ''}
                    onChange={e => handleMonthChange(i + 1, e.target.value)}
                    placeholder="0,00"
                    className={inputClass}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-4 mb-6 border-t border-ui-border-soft">
          <div>
            <label className="block text-xs font-medium text-content-muted mb-1">
              Mínimo recomendado (R$)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={minRecommended}
              onChange={applyMask(setMinRecommended)}
              placeholder="0,00"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-content-muted mb-1">
              Máximo recomendado (R$)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={maxRecommended}
              onChange={applyMask(setMaxRecommended)}
              placeholder="0,00"
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasExistingPlanning && (
            <button
              onClick={handleDelete}
              disabled={isDeleting || isSaving}
              className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              {isDeleting ? 'Removendo…' : 'Remover Planejamento'}
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-content-secondary bg-surface-subtle rounded-lg hover:bg-surface-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || isDeleting}
              className="px-5 py-2 text-sm font-medium text-white bg-brand rounded-lg hover:bg-brand-hover disabled:opacity-50 transition-colors"
            >
              {isSaving ? 'Salvando…' : 'Salvar Planejamento'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
