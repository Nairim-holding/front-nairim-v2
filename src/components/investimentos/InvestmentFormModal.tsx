'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useMessageContext, usePopupContext } from '@/contexts';
import Select from '@/components/ui/Select';
import {
  listFinancialInstitutionsAction,
  quickCreateFinancialInstitutionAction,
} from '@/server/actions/financial-institution';
import {
  createInvestmentAction,
  deleteInvestmentAction,
  updateInvestmentAction,
} from '@/server/actions/investment';
import { formatCurrencyRealtime, maskMoney } from '@/utils/masks';
import { parseCurrencyFromPTBR } from '@/utils/displayFormatters';
import { INVESTMENT_PRODUCT_TYPE_OPTIONS } from '@/shared/utils/investment-product-types';
import ModalShell, {
  ModalCancelButton,
  ModalPrimaryButton,
  modalInputClass,
  modalLabelClass,
} from './ModalShell';
import FieldLabel, { INVESTMENT_FIELD_HINTS } from './FieldLabel';
import FinancialInstitutionFormModal from './FinancialInstitutionFormModal';
import type { Investment, InvestmentProductType } from './types';

/**
 * Modal "Novo Investimento" / "Editar Investimento".
 *
 * A lista de "Inst. Financeira - Partição" vem do cadastro de Instituições
 * Financeiras do Financeiro (mesma tabela usada por Lançamentos e Locações) —
 * não há cadastro paralelo aqui. O "+" ao lado do rótulo faz o cadastro rápido
 * pelo mesmo endpoint do restante do sistema.
 *
 * O select "Copiar dados de outro investimento" (só na criação) preenche o
 * formulário a partir de um papel já cadastrado, menos data e valor — que são
 * sempre da nova aplicação.
 */

interface Props {
  /** Ausente = criação. */
  investment?: Investment | null;
  /** Investimentos já cadastrados, para o "Copiar dados de outro investimento". */
  existing: Investment[];
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  financial_institution_id: string;
  partition: string;
  issuer: string;
  product_type: InvestmentProductType | '';
  product: string;
  application_date: string;
  maturity_date: string;
  liquidity_days: string;
  liquidity_at_maturity: boolean;
  invested_amount: string;
  notes: string;
  /** Só editável depois de criado — é o que alimenta o filtro "Investimento liquidado". */
  liquidated_at: string;
}

const EMPTY_FORM: FormState = {
  financial_institution_id: '',
  partition: 'Principal',
  issuer: '',
  product_type: '',
  product: '',
  application_date: '',
  maturity_date: '',
  liquidity_days: '',
  liquidity_at_maturity: false,
  invested_amount: '',
  notes: '',
  liquidated_at: '',
};

export default function InvestmentFormModal({ investment, existing, onClose, onSaved }: Props) {
  const { showMessage } = useMessageContext();
  const { showPopup } = usePopupContext();
  const isEditing = !!investment;

  const [institutions, setInstitutions] = useState<{ id: string; name: string }[]>([]);
  const [copyFromId, setCopyFromId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [quickCreateName, setQuickCreateName] = useState<string | null>(null);
  // Fallback quando o cadastro rápido (só nome) falha — abre o cadastro
  // completo em vez de deixar o usuário travado num erro genérico.
  const [institutionFormFallback, setInstitutionFormFallback] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() =>
    investment
      ? {
          financial_institution_id: investment.financial_institution_id,
          partition: investment.partition,
          issuer: investment.issuer,
          product_type: investment.product_type,
          product: investment.product,
          application_date: investment.application_date,
          maturity_date: investment.maturity_date ?? '',
          liquidity_days: investment.liquidity_days != null ? String(investment.liquidity_days) : '',
          liquidity_at_maturity: investment.liquidity_at_maturity,
          invested_amount: maskMoney(investment.invested_amount),
          notes: investment.notes ?? '',
          liquidated_at: investment.liquidated_at ?? '',
        }
      : EMPTY_FORM,
  );

  const loadInstitutions = useCallback(async () => {
    // `limit` é validado em 1..150 no schema de listagem — mesma chamada que
    // Lançamentos e Locações fazem para popular seus selects.
    const result = await listFinancialInstitutionsAction({ limit: 100, 'filter[is_active]': 'true' });
    if (!result.ok) {
      showMessage(result.error ?? 'Não foi possível carregar as instituições financeiras', 'error');
      return [];
    }
    const list = result.data.data.map((item) => ({ id: item.id, name: item.name }));
    setInstitutions(list);
    return list;
  }, [showMessage]);

  useEffect(() => {
    loadInstitutions();
  }, [loadInstitutions]);

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  /** Copia o cadastro de outro investimento, menos data/valor da aplicação. */
  const handleCopyFrom = useCallback(
    (id: string) => {
      setCopyFromId(id);
      const source = existing.find((item) => item.id === id);
      if (!source) return;
      setForm((prev) => ({
        ...prev,
        financial_institution_id: source.financial_institution_id,
        partition: source.partition,
        issuer: source.issuer,
        product_type: source.product_type,
        product: source.product,
        maturity_date: source.maturity_date ?? '',
        liquidity_days: source.liquidity_days != null ? String(source.liquidity_days) : '',
        liquidity_at_maturity: source.liquidity_at_maturity,
        notes: source.notes ?? '',
      }));
    },
    [existing],
  );

  const handleQuickCreate = useCallback(async () => {
    const name = quickCreateName?.trim();
    if (!name) return;
    const result = await quickCreateFinancialInstitutionAction({ name });
    if (!result.ok) {
      // O modo rápido só manda o nome — se falhar (ex.: erro do servidor),
      // abre o cadastro completo com os mesmos campos da tela de Instituições
      // Financeiras em vez de deixar o usuário travado no erro genérico.
      setInstitutionFormFallback(name);
      return;
    }
    await loadInstitutions();
    set('financial_institution_id', result.data.id);
    setQuickCreateName(null);
    showMessage('Instituição financeira cadastrada', 'success');
  }, [quickCreateName, loadInstitutions, set, showMessage]);

  const handleInstitutionFormSaved = useCallback(
    async (created: { id: string }) => {
      await loadInstitutions();
      set('financial_institution_id', created.id);
      setInstitutionFormFallback(null);
      setQuickCreateName(null);
    },
    [loadInstitutions, set],
  );

  const institutionOptions = useMemo(
    () => institutions.map((item) => ({ value: item.id, label: `${item.name} - ${form.partition || 'Principal'}` })),
    [institutions, form.partition],
  );

  const copyOptions = useMemo(
    () =>
      existing.map((item) => ({
        value: item.id,
        label: `${item.financial_institution_name ?? ''} - ${item.partition} | ${item.issuer} | ${item.product}`,
      })),
    [existing],
  );

  const handleSubmit = useCallback(async () => {
    const amount = parseCurrencyFromPTBR(form.invested_amount);

    if (!form.financial_institution_id) return showMessage('Selecione a instituição financeira', 'error');
    if (!form.issuer.trim()) return showMessage('Informe o emissor', 'error');
    if (!form.product_type) return showMessage('Selecione o tipo do produto', 'error');
    if (!form.product.trim()) return showMessage('Informe o produto', 'error');
    if (!form.application_date) return showMessage('Informe a data da aplicação', 'error');
    if (amount <= 0) return showMessage('Informe o valor investido', 'error');
    if (form.liquidity_at_maturity && !form.maturity_date) {
      return showMessage('Informe o vencimento para liquidez apenas no vencimento', 'error');
    }

    const payload = {
      financial_institution_id: form.financial_institution_id,
      partition: form.partition.trim() || 'Principal',
      issuer: form.issuer.trim(),
      product_type: form.product_type,
      product: form.product.trim(),
      application_date: form.application_date,
      maturity_date: form.maturity_date || null,
      liquidity_days: form.liquidity_at_maturity || !form.liquidity_days ? null : Number(form.liquidity_days),
      liquidity_at_maturity: form.liquidity_at_maturity,
      invested_amount: amount,
      notes: form.notes.trim() || null,
      // Só na edição: um investimento nasce ativo, nunca liquidado.
      ...(isEditing ? { liquidated_at: form.liquidated_at || null } : {}),
    };

    setIsSaving(true);
    try {
      const result = isEditing
        ? await updateInvestmentAction(investment!.id, payload)
        : await createInvestmentAction(payload);
      if (!result.ok) throw new Error(result.errors?.join('; ') || result.error);
      showMessage(isEditing ? 'Investimento atualizado com sucesso' : 'Investimento criado com sucesso', 'success');
      onSaved();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Erro ao salvar o investimento', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [form, isEditing, investment, onSaved, showMessage]);

  const handleDelete = useCallback(() => {
    if (!investment) return;
    // Confirmação pelo ConfirmDialog do projeto (mesmo de Cartões, Locações
    // etc.) em vez do `window.confirm` nativo.
    showPopup(
      'Excluir Investimento',
      `Tem certeza que deseja excluir o investimento "${investment.product}"? Os aportes e saldos mensais também serão removidos.`,
      async () => {
        setIsDeleting(true);
        try {
          const result = await deleteInvestmentAction(investment.id);
          if (!result.ok) throw new Error(result.error);
          showMessage('Investimento excluído com sucesso', 'success');
          onSaved();
        } catch (error) {
          showMessage(error instanceof Error ? error.message : 'Erro ao excluir o investimento', 'error');
        } finally {
          setIsDeleting(false);
        }
      },
      () => {},
    );
  }, [investment, onSaved, showMessage, showPopup]);

  return (
    <ModalShell
      title={isEditing ? 'Editar Investimento' : 'Novo Investimento'}
      onClose={onClose}
      maxWidth="max-w-2xl"
      footer={
        <>
          {isEditing && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting || isSaving}
              className="mr-auto px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              {isDeleting ? 'Excluindo…' : 'Excluir Investimento'}
            </button>
          )}
          <ModalCancelButton onClick={onClose} />
          <ModalPrimaryButton onClick={handleSubmit} disabled={isSaving || isDeleting}>
            {isSaving ? 'Salvando…' : isEditing ? 'Salvar' : 'Criar'}
          </ModalPrimaryButton>
        </>
      }
    >
      {!isEditing && (
        <div className="mb-4">
          <label className={modalLabelClass}>Copiar dados de outro investimento</label>
          <Select options={copyOptions} value={copyFromId} onChange={(v) => handleCopyFrom(String(v))} searchable />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <FieldLabel
            required
            action={
              <button
                type="button"
                onClick={() => setQuickCreateName(quickCreateName === null ? '' : null)}
                className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded bg-brand text-white hover:bg-brand-hover transition-colors"
                title="Cadastrar nova instituição financeira"
              >
                <Plus size={11} />
              </button>
            }
          >
            Inst. Financeira - Partição
          </FieldLabel>

          {quickCreateName !== null ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={quickCreateName}
                onChange={(e) => setQuickCreateName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleQuickCreate()}
                placeholder="Nome da instituição"
                className={modalInputClass}
                autoFocus
              />
              <button
                type="button"
                onClick={handleQuickCreate}
                className="shrink-0 rounded-lg bg-brand px-3 py-2 text-xs font-medium text-white hover:bg-brand-hover transition-colors"
              >
                Salvar
              </button>
            </div>
          ) : (
            <Select
              options={institutionOptions}
              value={form.financial_institution_id}
              onChange={(v) => set('financial_institution_id', String(v))}
              searchable
            />
          )}
        </div>

        <div>
          <FieldLabel required hint={INVESTMENT_FIELD_HINTS.issuer}>
            Emissor
          </FieldLabel>
          <input
            type="text"
            value={form.issuer}
            onChange={(e) => set('issuer', e.target.value)}
            className={modalInputClass}
            placeholder="Banco ABC"
          />
        </div>

        <div>
          <FieldLabel required hint={INVESTMENT_FIELD_HINTS.productType}>
            Tipo do Produto
          </FieldLabel>
          <Select
            options={INVESTMENT_PRODUCT_TYPE_OPTIONS}
            value={form.product_type}
            onChange={(v) => set('product_type', v as InvestmentProductType)}
            searchable
          />
        </div>

        <div>
          <FieldLabel required hint={INVESTMENT_FIELD_HINTS.product}>
            Produto
          </FieldLabel>
          <input
            type="text"
            value={form.product}
            onChange={(e) => set('product', e.target.value)}
            className={modalInputClass}
            placeholder="CDB - 120% do CDI"
          />
        </div>

        <div>
          <FieldLabel required hint={INVESTMENT_FIELD_HINTS.applicationDate}>
            Data da aplicação
          </FieldLabel>
          <input
            type="date"
            value={form.application_date}
            onChange={(e) => set('application_date', e.target.value)}
            className={modalInputClass}
          />
        </div>

        <div>
          <FieldLabel hint={INVESTMENT_FIELD_HINTS.maturityDate}>Vencimento</FieldLabel>
          <input
            type="date"
            value={form.maturity_date}
            onChange={(e) => set('maturity_date', e.target.value)}
            className={modalInputClass}
          />
        </div>

        <div>
          <FieldLabel hint={INVESTMENT_FIELD_HINTS.liquidityDays}>Liquidez em dias</FieldLabel>
          <input
            type="number"
            min={0}
            value={form.liquidity_at_maturity ? '' : form.liquidity_days}
            onChange={(e) => set('liquidity_days', e.target.value)}
            disabled={form.liquidity_at_maturity}
            className={modalInputClass}
          />
        </div>

        <div>
          <FieldLabel required>Valor investido</FieldLabel>
          <input
            type="text"
            inputMode="numeric"
            value={form.invested_amount}
            onChange={(e) => set('invested_amount', formatCurrencyRealtime(e.target.value))}
            className={modalInputClass}
            placeholder="0,00"
          />
        </div>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm text-content cursor-pointer">
        <input
          type="checkbox"
          checked={form.liquidity_at_maturity}
          onChange={(e) => set('liquidity_at_maturity', e.target.checked)}
          className="w-4 h-4 accent-[color:var(--color-brand-primary)]"
        />
        Liquidez apenas no vencimento
      </label>

      {isEditing && (
        <div className="mt-4">
          <FieldLabel hint="Preenchido, o investimento passa a contar como liquidado no filtro da tela.">
            Liquidado em
          </FieldLabel>
          <input
            type="date"
            value={form.liquidated_at}
            onChange={(e) => set('liquidated_at', e.target.value)}
            className={modalInputClass}
          />
        </div>
      )}

      <div className="mt-4">
        <label className={modalLabelClass}>Observações</label>
        <input
          type="text"
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          className={modalInputClass}
          placeholder="Objetivo A"
        />
      </div>

      {institutionFormFallback !== null && (
        <FinancialInstitutionFormModal
          initialName={institutionFormFallback}
          onClose={() => setInstitutionFormFallback(null)}
          onSaved={handleInstitutionFormSaved}
        />
      )}
    </ModalShell>
  );
}
