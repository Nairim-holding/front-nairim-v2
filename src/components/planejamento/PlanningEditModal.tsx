'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useCallback, useMemo } from 'react';
import { useMessageContext } from '@/contexts';
import { authFetch } from '@/utils/authFetch';
import { parseCurrencyFromPTBR } from '@/utils/displayFormatters';
import { maskMoney, formatCurrencyRealtime } from '@/utils/masks';
import type { DashboardItem, CategoryDashboard } from './types';

const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

interface Props {
  item: (DashboardItem | CategoryDashboard) & { parentCategoryId?: string; initialPlanType?: 'FIXED' | 'VARIABLE' };
  onClose: () => void;
  onSaved: () => void;
}

export default function PlanningEditModal({ item, onClose, onSaved }: Props) {
  const { showMessage } = useMessageContext();

  const isSubcategory = !!item.parentCategoryId;

  const categoryId = useMemo(() => {
    return isSubcategory ? item.parentCategoryId! : item.id;
  }, [item, isSubcategory]);

  const subcategoryId = useMemo(() => {
    return isSubcategory ? item.id : undefined;
  }, [item, isSubcategory]);

  const [planType, setPlanType] = useState<'FIXED' | 'VARIABLE'>(() => {
    const itemAny = item as any;
    if (itemAny.planning_type) return itemAny.planning_type;
    if (itemAny.initialPlanType) return itemAny.initialPlanType;
    return 'VARIABLE';
  });
  const [defaultAmount, setDefaultAmount] = useState<number>(() => {
    const itemAny = item as any;
    // Só herda valor para o campo FIXO se o planejamento já for FIXO.
    // Para VARIÁVEL o campo fixo começa zerado (não replica o valor do mês).
    return itemAny.planning_type === 'FIXED' ? (itemAny.planned_amount ?? 0) : 0;
  });
  const [defaultAmountInput, setDefaultAmountInput] = useState<string>(() => {
    const itemAny = item as any;
    if (itemAny.planning_type === 'FIXED') {
      const val = itemAny.planned_amount ?? 0;
      return val > 0 ? maskMoney(val) : '';
    }
    return '';
  });
  const [monthlyValues, setMonthlyValues] = useState<Record<number, number>>(() => {
    const itemAny = item as any;
    if (itemAny.planning_type === 'VARIABLE' && itemAny.monthly_values && Array.isArray(itemAny.monthly_values)) {
      return itemAny.monthly_values.reduce((acc: Record<number, number>, mv: any) => {
        acc[mv.month] = mv.amount ?? 0;
        return acc;
      }, {});
    }
    return {};
  });
  const [monthlyValuesInput, setMonthlyValuesInput] = useState<Record<number, string>>(() => {
    const itemAny = item as any;
    const result: Record<number, string> = {};
    if (itemAny.planning_type === 'VARIABLE' && itemAny.monthly_values && Array.isArray(itemAny.monthly_values)) {
      itemAny.monthly_values.forEach((mv: any) => {
        result[mv.month] = mv.amount > 0 ? maskMoney(mv.amount) : '';
      });
    }
    return result;
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const planningId = useMemo(() => {
    return 'planning_id' in item ? item.planning_id : undefined;
  }, [item]);

  const hasExistingPlanning = useMemo(() => {
    return item.planned_amount > 0 && planningId;
  }, [item, planningId]);

  const handleAmountChange = useCallback(
    (setInput: (v: string) => void) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatCurrencyRealtime(e.target.value);
        setInput(formatted);
      },
    [],
  );

  const handleAmountBlur = useCallback(
    (inputVal: string, setParsed: (v: number) => void) =>
      () => {
        const parsed = parseCurrencyFromPTBR(inputVal);
        setParsed(parsed);
      },
    [],
  );

  const handleMonthChange = useCallback((month: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrencyRealtime(e.target.value);
    setMonthlyValuesInput(prev => ({ ...prev, [month]: formatted }));
  }, []);

  const handleMonthBlur = useCallback((month: number, inputVal: string) => {
    const parsed = parseCurrencyFromPTBR(inputVal);
    setMonthlyValues(prev => ({ ...prev, [month]: parsed }));
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        category_id: categoryId,
        type: planType,
      };

      if (subcategoryId) {
        payload.subcategory_id = subcategoryId;
      }

      if (planType === 'FIXED') {
        payload.default_amount = parseCurrencyFromPTBR(defaultAmountInput);
      } else {
        payload.monthly_values = MONTH_NAMES.map((_, i) => {
          const monthNum = i + 1;
          const inputStr = monthlyValuesInput[monthNum] ?? '';
          return { month: monthNum, amount: parseCurrencyFromPTBR(inputStr) };
        });
      }

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
  }, [categoryId, subcategoryId, planType, defaultAmountInput, monthlyValuesInput, showMessage, onSaved]);

  const handleDelete = useCallback(async () => {
    if (!hasExistingPlanning || !planningId) return;

    if (!window.confirm('Tem certeza que deseja remover este planejamento?')) return;

    setIsDeleting(true);
    try {
      const res = await authFetch(`${API_URL}/planning/${planningId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Erro ao remover');
      }
      showMessage('Planejamento removido com sucesso', 'success');
      onSaved();
    } catch (e) {
      showMessage(e instanceof Error ? e.message : 'Erro ao remover planejamento', 'error');
    } finally {
      setIsDeleting(false);
    }
  }, [hasExistingPlanning, planningId, showMessage, onSaved]);

  const inputClass =
    'w-full border border-ui-border rounded-lg px-3 py-2 text-sm text-content bg-surface focus:outline-none focus:border-brand';

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center"
      style={{ backgroundColor: 'var(--color-overlay)' }}
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-surface rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <button
            onClick={onClose}
            className="text-content-muted hover:text-content text-2xl leading-none ml-auto"
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
              value={defaultAmountInput}
              onChange={handleAmountChange(setDefaultAmountInput)}
              onBlur={handleAmountBlur(defaultAmountInput, setDefaultAmount)}
              placeholder="0,00"
              className={inputClass}
              autoFocus
            />
          </div>
        ) : (
          <div className="mb-5">
            <label className="block text-xs font-medium text-content-muted mb-2">Valores mensais (R$)</label>
            <div className="grid grid-cols-3 gap-3">
              {MONTH_NAMES.map((name, i) => {
                const monthNum = i + 1;
                return (
                  <div key={i}>
                    <label className="block text-xs font-medium text-content-secondary mb-1">{name}</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={monthlyValuesInput[monthNum] ?? ''}
                      onChange={e => handleMonthChange(monthNum, e)}
                      onBlur={() => handleMonthBlur(monthNum, monthlyValuesInput[monthNum] ?? '')}
                      placeholder="0,00"
                      className={inputClass}
                      pattern="[0-9,.]*"
                      autoFocus={monthNum === new Date().getMonth() + 1}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}


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
