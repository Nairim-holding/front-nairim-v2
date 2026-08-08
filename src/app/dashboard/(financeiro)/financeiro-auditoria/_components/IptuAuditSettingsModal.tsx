'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Settings } from 'lucide-react';
import Select, { type Option } from '@/components/ui/Select';
import { authFetch } from '@/utils/authFetch';
import { useMessageContext } from '@/contexts/MessageContext';

const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';

interface CategoryOption {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
}

interface SubcategoryOption {
  id: string;
  name: string;
  category_id: string;
}

export interface IptuAuditSettingsValue {
  income_category_id: string | null;
  income_subcategory_id: string | null;
  expense_category_id: string | null;
  expense_subcategory_id: string | null;
}

interface IptuAuditSettingsModalProps {
  onClose: () => void;
  onSaved: (settings: IptuAuditSettingsValue) => void;
}

/** Configuração da Auditoria de IPTU (Tarefa 3.1, Passo 2 do guia de correções): quais categoria/subcategoria de receita e despesa representam a restituição e o pagamento do IPTU. */
export default function IptuAuditSettingsModal({ onClose, onSaved }: IptuAuditSettingsModalProps) {
  const { showMessage } = useMessageContext();
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [subcategories, setSubcategories] = useState<SubcategoryOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [incomeCategoryId, setIncomeCategoryId] = useState('');
  const [incomeSubcategoryId, setIncomeSubcategoryId] = useState('');
  const [expenseCategoryId, setExpenseCategoryId] = useState('');
  const [expenseSubcategoryId, setExpenseSubcategoryId] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [catRes, subRes, settingsRes] = await Promise.all([
          authFetch(`${API_URL}/financial-category?limit=1000&filter[is_active]=true`),
          authFetch(`${API_URL}/financial-subcategory?limit=1000&filter[is_active]=true`),
          authFetch(`${API_URL}/financial-audit/iptu/settings`),
        ]);

        const [catJson, subJson, settingsJson] = await Promise.all([
          catRes.json(), subRes.json(), settingsRes.json(),
        ]);

        if (cancelled) return;

        setCategories(Array.isArray(catJson?.data) ? catJson.data : []);
        setSubcategories(Array.isArray(subJson?.data) ? subJson.data : []);

        const settings = settingsJson?.data;
        if (settings) {
          setIncomeCategoryId(settings.income_category_id ?? '');
          setIncomeSubcategoryId(settings.income_subcategory_id ?? '');
          setExpenseCategoryId(settings.expense_category_id ?? '');
          setExpenseSubcategoryId(settings.expense_subcategory_id ?? '');
        }
      } catch (error) {
        console.error('[IptuAuditSettingsModal] Erro ao carregar dados:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const incomeCategoryOptions: Option[] = useMemo(
    () => categories.filter((c) => c.type === 'INCOME').map((c) => ({ label: c.name, value: c.id })),
    [categories]
  );
  const expenseCategoryOptions: Option[] = useMemo(
    () => categories.filter((c) => c.type === 'EXPENSE').map((c) => ({ label: c.name, value: c.id })),
    [categories]
  );
  const incomeSubcategoryOptions: Option[] = useMemo(
    () => subcategories.filter((s) => s.category_id === incomeCategoryId).map((s) => ({ label: s.name, value: s.id })),
    [subcategories, incomeCategoryId]
  );
  const expenseSubcategoryOptions: Option[] = useMemo(
    () => subcategories.filter((s) => s.category_id === expenseCategoryId).map((s) => ({ label: s.name, value: s.id })),
    [subcategories, expenseCategoryId]
  );

  const handleIncomeCategoryChange = useCallback((value: string | number) => {
    setIncomeCategoryId(String(value));
    setIncomeSubcategoryId('');
  }, []);

  const handleExpenseCategoryChange = useCallback((value: string | number) => {
    setExpenseCategoryId(String(value));
    setExpenseSubcategoryId('');
  }, []);

  const handleSave = useCallback(async () => {
    if (!incomeCategoryId || !expenseCategoryId) {
      showMessage('Selecione ao menos a Categoria de Receita e a Categoria de Despesa.', 'error', 4000);
      return;
    }

    setIsSaving(true);
    try {
      const payload: IptuAuditSettingsValue = {
        income_category_id: incomeCategoryId || null,
        income_subcategory_id: incomeSubcategoryId || null,
        expense_category_id: expenseCategoryId || null,
        expense_subcategory_id: expenseSubcategoryId || null,
      };

      const response = await authFetch(`${API_URL}/financial-audit/iptu/settings`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message ?? 'Erro ao salvar configuração.');
      }

      showMessage('Configuração da Auditoria de IPTU salva com sucesso', 'success', 2500);
      onSaved(payload);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Erro ao salvar configuração.', 'error', 4000);
    } finally {
      setIsSaving(false);
    }
  }, [incomeCategoryId, incomeSubcategoryId, expenseCategoryId, expenseSubcategoryId, showMessage, onSaved]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-surface rounded-2xl shadow-xl border border-ui-border-soft w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ui-border-soft">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-brand" />
            <h2 className="text-sm font-semibold text-content">Configurar Auditoria de IPTU</h2>
          </div>
          <button type="button" onClick={onClose} className="text-content-muted hover:text-content transition-colors">
            <X size={18} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-content-muted text-sm">Carregando...</div>
        ) : (
          <div className="px-5 py-4 flex flex-col gap-4">
            <div>
              <p className="text-xs font-semibold text-state-success uppercase tracking-wide mb-2">Receita — Restituição de IPTU</p>
              <div className="flex flex-col gap-2">
                <Select
                  label="Categoria"
                  options={incomeCategoryOptions}
                  value={incomeCategoryId}
                  onChange={handleIncomeCategoryChange}
                  placeholder="Selecione a categoria"
                />
                <Select
                  label="Subcategoria (opcional)"
                  options={incomeSubcategoryOptions}
                  value={incomeSubcategoryId}
                  onChange={(v) => setIncomeSubcategoryId(String(v))}
                  placeholder="Todas as subcategorias"
                  disabled={!incomeCategoryId}
                />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-state-warning uppercase tracking-wide mb-2">Despesa — IPTU Pago</p>
              <div className="flex flex-col gap-2">
                <Select
                  label="Categoria"
                  options={expenseCategoryOptions}
                  value={expenseCategoryId}
                  onChange={handleExpenseCategoryChange}
                  placeholder="Selecione a categoria"
                />
                <Select
                  label="Subcategoria (opcional)"
                  options={expenseSubcategoryOptions}
                  value={expenseSubcategoryId}
                  onChange={(v) => setExpenseSubcategoryId(String(v))}
                  placeholder="Todas as subcategorias"
                  disabled={!expenseCategoryId}
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-ui-border-soft">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-content-secondary hover:bg-surface-subtle transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-brand text-content-inverse hover:bg-brand-hover disabled:opacity-50 transition-colors"
          >
            {isSaving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
