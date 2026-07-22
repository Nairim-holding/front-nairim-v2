/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react';
import { useMessageContext } from '@/contexts/MessageContext';
import { authFetch } from '@/utils/authFetch';
import { formatCurrencyRealtime } from '@/utils/masks';
import { formatCurrency, formatDate, parseCurrencyFromPTBR } from '@/utils/displayFormatters';

const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';

interface Option {
  label: string;
  value: string;
}

interface PreviewTransaction {
  id: string;
  description: string;
  amount: number | string;
  status: string;
  effective_date: string;
  event_date: string;
}

interface Props {
  leaseId: string;
  contractNumber?: string;
  startDate?: string;
  endDate?: string;
  onClose: () => void;
  /** Chamado após o cancelamento ser efetivado com sucesso. */
  onCancelled: () => void;
}

const todayISO = () => new Date().toISOString().split('T')[0];

const clampDate = (value: string, min?: string, max?: string) => {
  if (min && value < min) return min;
  if (max && value > max) return max;
  return value;
};

/**
 * Modal de Cancelamento de Locação (3 etapas):
 *  1. Data + Motivo + encargos opcionais (custas/juros/multas).
 *  2. Listagem dos lançamentos do período (data → término) para o usuário
 *     confirmar quais excluir. Concluídos vêm desmarcados por padrão.
 *  3. (Só se houver encargos) Configuração do lançamento de encargo (conta,
 *     categoria, subcategoria, centro de receita, contato, data, valor).
 * O cancelamento só é efetivado no botão final, após confirmação explícita.
 */
export default function LeaseCancellationModal({
  leaseId,
  contractNumber,
  startDate,
  endDate,
  onClose,
  onCancelled,
}: Props) {
  const { showMessage } = useMessageContext();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Etapa 1
  const [date, setDate] = useState(() => clampDate(todayISO(), startDate, endDate));
  const [reason, setReason] = useState('');
  const [custas, setCustas] = useState('');
  const [juros, setJuros] = useState('');
  const [multas, setMultas] = useState('');
  const [dateError, setDateError] = useState('');

  // Etapa 2
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [transactions, setTransactions] = useState<PreviewTransaction[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Etapa 3 — opções e valores do encargo
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const [institutions, setInstitutions] = useState<Option[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<Option[]>([]);
  const [subcategoriesByCat, setSubcategoriesByCat] = useState<Record<string, Option[]>>({});
  const [incomeCenters, setIncomeCenters] = useState<Option[]>([]);
  const [suppliers, setSuppliers] = useState<Option[]>([]);
  const [chargeInstitution, setChargeInstitution] = useState('');
  const [chargeCategory, setChargeCategory] = useState('');
  const [chargeSubcategory, setChargeSubcategory] = useState('');
  const [chargeCenter, setChargeCenter] = useState('');
  const [chargeSupplier, setChargeSupplier] = useState('');
  const [chargeDate, setChargeDate] = useState('');
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeError, setChargeError] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const encargosTotal = useMemo(
    () => parseCurrencyFromPTBR(custas) + parseCurrencyFromPTBR(juros) + parseCurrencyFromPTBR(multas),
    [custas, juros, multas],
  );
  const hasEncargos = encargosTotal > 0;
  const totalSteps = hasEncargos ? 3 : 2;
  const selectedCount = selectedIds.size;

  const validateDate = () => {
    if (!date) return 'Informe a data do cancelamento.';
    if (startDate && date < startDate) return 'A data não pode ser anterior ao início do contrato.';
    if (endDate && date > endDate) return 'A data não pode ser posterior ao término do contrato.';
    return '';
  };

  const goToPreview = async () => {
    const err = validateDate();
    if (err) { setDateError(err); return; }
    setDateError('');
    setLoadingPreview(true);
    try {
      const res = await authFetch(`${API_URL}/leases/${leaseId}/cancellation-preview?date=${date}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Erro ao carregar os lançamentos do período.');
      }
      const json = await res.json();
      const txs: PreviewTransaction[] = json.data?.transactions ?? [];
      setTransactions(txs);
      // Pendentes marcados; concluídos desmarcados por padrão (proteção).
      setSelectedIds(new Set(txs.filter((t) => t.status !== 'COMPLETED').map((t) => t.id)));
      setStep(2);
    } catch (e: any) {
      showMessage(e?.message ?? 'Erro ao carregar os lançamentos.', 'error');
    } finally {
      setLoadingPreview(false);
    }
  };

  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const loadOptions = async () => {
    if (optionsLoaded) return;
    try {
      const [catRes, subRes, instRes, centRes, supRes] = await Promise.all([
        authFetch(`${API_URL}/financial-category?limit=1000&filter[is_active]=true`),
        authFetch(`${API_URL}/financial-subcategory?limit=1000&filter[is_active]=true`),
        authFetch(`${API_URL}/financial-institution?limit=1000`),
        authFetch(`${API_URL}/financial-center?limit=1000&filter[is_active]=true`),
        authFetch(`${API_URL}/financial-supplier?limit=1000`),
      ]);
      const [cats, subs, insts, cents, sups] = await Promise.all([
        catRes.json(), subRes.json(), instRes.json(), centRes.json(), supRes.json(),
      ]);

      const allCats = cats?.data ?? cats ?? [];
      setIncomeCategories(
        allCats.filter((c: any) => c.type === 'INCOME').map((c: any) => ({ label: c.name, value: c.id })),
      );
      const subMap: Record<string, Option[]> = {};
      (subs?.data ?? subs ?? []).forEach((s: any) => {
        if (!subMap[s.category_id]) subMap[s.category_id] = [];
        subMap[s.category_id].push({ label: s.name, value: s.id });
      });
      setSubcategoriesByCat(subMap);
      setInstitutions((insts?.data ?? insts ?? []).map((i: any) => ({ label: i.name, value: i.id })));
      setIncomeCenters(
        (cents?.data ?? cents ?? []).filter((c: any) => c.type === 'INCOME').map((c: any) => ({ label: c.name, value: c.id })),
      );
      setSuppliers(
        (sups?.data ?? sups ?? []).map((s: any) => ({ label: s.legal_name || s.name || 'Sem nome', value: s.id })),
      );
      setOptionsLoaded(true);
    } catch {
      showMessage('Erro ao carregar as opções de lançamento do encargo.', 'error');
    }
  };

  const goToCharge = async () => {
    await loadOptions();
    setChargeDate((prev) => prev || date);
    setChargeAmount((prev) => prev || formatCurrencyRealtime(String(Math.round(encargosTotal * 100))));
    setStep(3);
  };

  const submitCancellation = async () => {
    if (hasEncargos) {
      if (!chargeInstitution) { setChargeError('Selecione a conta do encargo.'); return; }
      if (!chargeCategory) { setChargeError('Selecione a categoria do encargo.'); return; }
      if (parseCurrencyFromPTBR(chargeAmount) <= 0) { setChargeError('Informe o valor do encargo.'); return; }
    }
    setChargeError('');
    setSubmitting(true);
    try {
      const body: any = {
        date,
        reason,
        transactionIds: Array.from(selectedIds),
      };
      if (hasEncargos) {
        body.charge = {
          financial_institution_id: chargeInstitution,
          category_id: chargeCategory,
          subcategory_id: chargeSubcategory || null,
          center_id: chargeCenter || null,
          supplier_id: chargeSupplier || null,
          date: chargeDate || date,
          amount: parseCurrencyFromPTBR(chargeAmount),
          description: `Encargo de cancelamento - Contrato ${contractNumber ?? ''}`.trim(),
        };
      }
      const res = await authFetch(`${API_URL}/leases/${leaseId}/cancel`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Erro ao cancelar a locação.');
      }
      showMessage('Locação cancelada com sucesso.', 'success');
      onCancelled();
    } catch (e: any) {
      showMessage(e?.message ?? 'Erro ao cancelar a locação.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const moneyField = (label: string, value: string, setValue: (v: string) => void) => (
    <div className="flex flex-col gap-1">
      <label className="text-[13px] font-medium text-content-secondary">{label}</label>
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[13px] text-content-muted">R$</span>
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(formatCurrencyRealtime(e.target.value))}
          placeholder="0,00"
          className="w-full pl-8 pr-2 h-9 text-[13px] border border-ui-border rounded-lg outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand bg-surface"
        />
      </div>
    </div>
  );

  const selectField = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    options: Option[],
    { required = false, emptyLabel = 'Selecione...' }: { required?: boolean; emptyLabel?: string } = {},
  ) => (
    <div className="flex flex-col gap-1">
      <label className="text-[13px] font-medium text-content-secondary">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 h-9 text-[13px] border border-ui-border rounded-lg outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand bg-surface"
      >
        <option value="">{emptyLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--color-overlay)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}
    >
      <div
        className="bg-surface rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex justify-between items-start mb-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-red-50 text-red-600"><AlertTriangle size={20} /></div>
            <div>
              <h2 className="text-lg font-semibold text-content">Cancelamento de Locação</h2>
              <p className="text-xs text-content-muted">
                {contractNumber ? `Contrato ${contractNumber} · ` : ''}Etapa {step} de {totalSteps}
              </p>
            </div>
          </div>
          <button onClick={onClose} disabled={submitting} className="text-content-muted hover:text-content text-2xl leading-none disabled:opacity-50" aria-label="Fechar">×</button>
        </div>

        {/* ETAPA 1 */}
        {step === 1 && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-[13px] font-medium text-content-secondary">
                Data do cancelamento <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={date}
                min={startDate || undefined}
                max={endDate || undefined}
                onChange={(e) => { setDate(e.target.value); setDateError(''); }}
                className={`w-full px-2 h-9 text-[13px] border rounded-lg outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand bg-surface ${dateError ? 'border-red-500' : 'border-ui-border'}`}
              />
              {dateError && <p className="text-red-500 text-[11px]">{dateError}</p>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[13px] font-medium text-content-secondary">Motivo do cancelamento</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Ex.: saída antecipada do inquilino"
                className="w-full px-2 py-2 text-[13px] border border-ui-border rounded-lg outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand bg-surface resize-none"
              />
            </div>

            <div className="rounded-lg border border-ui-border-soft bg-surface-subtle p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-content-muted mb-2">Encargos do cancelamento (opcional)</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {moneyField('Custas', custas, setCustas)}
                {moneyField('Juros', juros, setJuros)}
                {moneyField('Multas', multas, setMultas)}
              </div>
              {hasEncargos && (
                <p className="text-[12px] text-content-secondary mt-2">
                  Total de encargos: <span className="font-semibold">{formatCurrency(encargosTotal)}</span> — será configurado como um lançamento na última etapa.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={onClose} className="px-4 py-2 text-sm text-content-secondary bg-surface-subtle rounded-lg hover:bg-surface-muted transition-colors">Cancelar</button>
              <button
                onClick={goToPreview}
                disabled={loadingPreview}
                className="px-5 py-2 text-sm font-medium text-white bg-brand rounded-lg hover:bg-brand-hover disabled:opacity-60 transition-colors flex items-center gap-2"
              >
                {loadingPreview && <Loader2 size={16} className="animate-spin" />}
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* ETAPA 2 — listagem */}
        {step === 2 && (
          <div className="mt-4 space-y-3">
            <p className="text-[13px] text-content-secondary">
              Lançamentos de <strong>{formatDate(date)}</strong> até o término do contrato. Marque os que deseja excluir.
              Concluídos (pagos) vêm desmarcados por segurança.
            </p>

            {transactions.length === 0 ? (
              <div className="rounded-lg border border-ui-border-soft bg-surface-subtle p-6 text-center text-[13px] text-content-muted">
                Nenhum lançamento no período.
              </div>
            ) : (
              <div className="border border-ui-border-soft rounded-lg overflow-hidden max-h-[45vh] overflow-y-auto">
                <table className="min-w-full text-[13px]">
                  <thead className="bg-surface-muted text-content-secondary sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left w-8"></th>
                      <th className="px-3 py-2 text-left">Descrição</th>
                      <th className="px-3 py-2 text-left whitespace-nowrap">Data</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap">Valor</th>
                      <th className="px-3 py-2 text-center whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ui-border-soft">
                    {transactions.map((t) => {
                      const isCompleted = t.status === 'COMPLETED';
                      return (
                        <tr key={t.id} className={selectedIds.has(t.id) ? 'bg-red-50/40' : ''}>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(t.id)}
                              onChange={() => toggleId(t.id)}
                              className="w-4 h-4 cursor-pointer"
                            />
                          </td>
                          <td className="px-3 py-2 text-content">{t.description}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-content-secondary">{formatDate(t.effective_date)}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap font-medium text-content">{formatCurrency(Number(t.amount))}</td>
                          <td className="px-3 py-2 text-center whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${isCompleted ? 'text-green-700 bg-green-50 border-green-200' : 'text-yellow-700 bg-yellow-50 border-yellow-200'}`}>
                              {isCompleted ? 'Concluído' : 'Pendente'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <p className="text-[12px] text-content-muted">
              {selectedCount} lançamento(s) marcado(s) para exclusão.
            </p>
            {(() => {
              const uncheckedCompleted = transactions.filter(
                (t) => t.status === 'COMPLETED' && !selectedIds.has(t.id),
              ).length;
              return uncheckedCompleted > 0 ? (
                <p className="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  {uncheckedCompleted} lançamento(s) concluído(s) NÃO serão excluídos.
                  Marque-os acima se também devem ser removidos no cancelamento.
                </p>
              ) : null;
            })()}

            <div className="flex justify-between gap-2 pt-2">
              <button onClick={() => setStep(1)} className="px-4 py-2 text-sm text-content-secondary bg-surface-subtle rounded-lg hover:bg-surface-muted transition-colors flex items-center gap-1">
                <ArrowLeft size={16} /> Voltar
              </button>
              {hasEncargos ? (
                <button onClick={goToCharge} className="px-5 py-2 text-sm font-medium text-white bg-brand rounded-lg hover:bg-brand-hover transition-colors">
                  Continuar
                </button>
              ) : (
                <button
                  onClick={submitCancellation}
                  disabled={submitting}
                  className="px-5 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors flex items-center gap-2"
                >
                  {submitting && <Loader2 size={16} className="animate-spin" />}
                  Confirmar Cancelamento
                </button>
              )}
            </div>
          </div>
        )}

        {/* ETAPA 3 — encargo */}
        {step === 3 && (
          <div className="mt-4 space-y-4">
            <p className="text-[13px] text-content-secondary">
              Configure o lançamento do encargo (receita). Total informado: <strong>{formatCurrency(encargosTotal)}</strong>.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {selectField('Conta', chargeInstitution, setChargeInstitution, institutions, { required: true })}
              {selectField('Categoria (receita)', chargeCategory, (v) => { setChargeCategory(v); setChargeSubcategory(''); }, incomeCategories, { required: true })}
              {selectField('Subcategoria', chargeSubcategory, setChargeSubcategory, subcategoriesByCat[chargeCategory] ?? [], { emptyLabel: 'Nenhuma' })}
              {selectField('Centro de Receita', chargeCenter, setChargeCenter, incomeCenters, { emptyLabel: 'Nenhum' })}
              {selectField('Contato', chargeSupplier, setChargeSupplier, suppliers, { emptyLabel: 'Nenhum' })}
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-content-secondary">Data</label>
                <input
                  type="date"
                  value={chargeDate}
                  onChange={(e) => setChargeDate(e.target.value)}
                  className="w-full px-2 h-9 text-[13px] border border-ui-border rounded-lg outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand bg-surface"
                />
              </div>
              {moneyField('Valor', chargeAmount, setChargeAmount)}
            </div>

            {chargeError && <p className="text-red-500 text-[12px]">{chargeError}</p>}

            <div className="flex justify-between gap-2 pt-2">
              <button onClick={() => setStep(2)} disabled={submitting} className="px-4 py-2 text-sm text-content-secondary bg-surface-subtle rounded-lg hover:bg-surface-muted transition-colors flex items-center gap-1 disabled:opacity-50">
                <ArrowLeft size={16} /> Voltar
              </button>
              <button
                onClick={submitCancellation}
                disabled={submitting}
                className="px-5 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors flex items-center gap-2"
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                Confirmar Cancelamento
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
