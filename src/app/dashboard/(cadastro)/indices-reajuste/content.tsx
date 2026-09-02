'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Trash2, Loader2, Info } from 'lucide-react';
import Section from '@/components/layout/PageSection';
import Select from '@/components/ui/Select';
import { useMessageContext } from '@/contexts';
import {
  deleteAdjustmentIndexValueAction,
  listAdjustmentIndexesAction,
  syncAdjustmentIndexesAction,
  upsertAdjustmentIndexValueAction,
} from '@/server/actions/adjustment-index';
import {
  formatReference,
  type AdjustmentIndex,
  type AdjustmentIndexValue,
} from '@/core/entities/adjustment-index';

/**
 * Manutenção dos Índices de Reajuste (Etapa 4).
 *
 * A tela tem duas partes, como o documento pede: o indexador escolhido
 * (sigla + descrição) e a tabela dos valores mensais. Os percentuais podem
 * chegar de duas formas — pelo botão "Atualizar pelo Banco Central", que puxa
 * as séries do SGS, ou digitados à mão (único caminho para o IVAR, que a FGV
 * apura e o Banco Central não espelha no SGS).
 *
 * O indexador aceita "Todos": nesse modo a tabela vira um comparativo mês a
 * mês, com uma coluna por indexador. O filtro de ano vale nos dois modos e
 * permite olhar um exercício inteiro de uma vez.
 */

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** Valor sentinela do ComboBox de indexador para o modo comparativo. */
const ALL_INDEXES = '__all__';
/** Valor sentinela do filtro de ano ("o histórico inteiro"). */
const ALL_YEARS = '__all_years__';

/**
 * Percentual no padrão brasileiro.
 *
 * O acumulado em 12 meses sai sempre com 2 casas — é como o BCB e a FGV
 * divulgam. A variação do mês aceita até 4 porque a coluna é `Decimal(10,4)`
 * e um valor digitado à mão pode ter essa precisão.
 */
const formatPercent = (
  value: number | null | undefined,
  { fixed2 = false }: { fixed2?: boolean } = {},
): string => {
  if (value === null || value === undefined) return '—';
  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: fixed2 ? 2 : 4,
  })}%`;
};

const formatDateTime = (value: Date | string | null | undefined): string => {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR');
};

/** Uma linha do comparativo: um mês de referência com o valor de cada indexador. */
interface ComparisonRow {
  key: string;
  reference_year: number;
  reference_month: number;
  /** Valor do mês por `adjustment_index_id`; ausente quando o indexador não publicou. */
  cells: Record<string, AdjustmentIndexValue | undefined>;
}

export default function AdjustmentIndexesContent() {
  const { showMessage } = useMessageContext();

  const [indexes, setIndexes] = useState<AdjustmentIndex[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [yearFilter, setYearFilter] = useState<string>(ALL_YEARS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const now = new Date();
  const [form, setForm] = useState({
    reference_month: now.getMonth() + 1,
    reference_year: now.getFullYear(),
    monthly_rate: '',
    accumulated_12m: '',
  });

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await listAdjustmentIndexesAction({ limit: 50 });
      if (!result.ok) throw new Error(result.error ?? 'Falha ao carregar os índices');
      const rows = result.data?.data ?? [];
      setIndexes(rows);
      // Mantém a seleção entre recargas; só cai no primeiro na carga inicial.
      setSelectedId((current) =>
        current === ALL_INDEXES || (current && rows.some((r) => r.id === current))
          ? current
          : rows[0]?.id ?? '',
      );
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Erro ao carregar os índices', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showMessage]);

  useEffect(() => { void load(); }, [load]);

  const isComparing = selectedId === ALL_INDEXES;

  const selected = useMemo(
    () => indexes.find((index) => index.id === selectedId) ?? null,
    [indexes, selectedId],
  );

  /** Indexadores que a tabela cobre: todos no comparativo, só um no modo normal. */
  const scopedIndexes = useMemo(
    () => (isComparing ? indexes : selected ? [selected] : []),
    [isComparing, indexes, selected],
  );

  /** Anos presentes nos dados em tela — o filtro nunca oferece um ano vazio. */
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const index of scopedIndexes) {
      for (const value of index.values ?? []) years.add(value.reference_year);
    }
    return [...years].sort((a, b) => b - a);
  }, [scopedIndexes]);

  /**
   * Ano efetivo do filtro. Derivado em vez de guardado em estado: ao trocar de
   * indexador o ano escolhido pode não existir mais, e voltar para "todos" na
   * renderização evita uma tabela vazia sem explicação.
   */
  const activeYear = useMemo(() => {
    const parsed = Number(yearFilter);
    return Number.isInteger(parsed) && availableYears.includes(parsed) ? parsed : null;
  }, [yearFilter, availableYears]);

  const yearFilterOptions = useMemo(
    () => [
      { label: 'Todos os anos', value: ALL_YEARS },
      ...availableYears.map((year) => ({ label: String(year), value: String(year) })),
    ],
    [availableYears],
  );

  const values: AdjustmentIndexValue[] = useMemo(
    () => (selected?.values ?? []).filter((v) => activeYear === null || v.reference_year === activeYear),
    [selected, activeYear],
  );

  const comparisonRows: ComparisonRow[] = useMemo(() => {
    if (!isComparing) return [];
    const rows = new Map<string, ComparisonRow>();
    for (const index of indexes) {
      for (const value of index.values ?? []) {
        if (activeYear !== null && value.reference_year !== activeYear) continue;
        const key = `${value.reference_year}-${value.reference_month}`;
        let row = rows.get(key);
        if (!row) {
          row = {
            key,
            reference_year: value.reference_year,
            reference_month: value.reference_month,
            cells: {},
          };
          rows.set(key, row);
        }
        row.cells[index.id] = value;
      }
    }
    return [...rows.values()].sort(
      (a, b) => b.reference_year - a.reference_year || b.reference_month - a.reference_month,
    );
  }, [isComparing, indexes, activeYear]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await syncAdjustmentIndexesAction({});
      if (!result.ok) throw new Error(result.error ?? 'Falha ao atualizar pelo Banco Central');

      const { synced = [], skipped = [] } = result.data ?? {};
      const imported = synced.reduce((total, item) => total + item.imported, 0);

      if (synced.length > 0) {
        showMessage(`${imported} valores atualizados (${synced.map((s) => s.code).join(', ')}).`, 'success');
      }
      // Falha parcial é normal: um indexador fora do ar não invalida os outros.
      if (skipped.length > 0) {
        showMessage(`Não atualizados: ${skipped.map((s) => `${s.code} — ${s.reason}`).join(' | ')}`, 'info');
      }
      await load();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Erro ao consultar o Banco Central', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddValue = async () => {
    if (!selectedId || isComparing) return;
    if (!form.monthly_rate.trim()) {
      showMessage('Informe o percentual do mês.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const result = await upsertAdjustmentIndexValueAction({
        adjustment_index_id: selectedId,
        reference_month: form.reference_month,
        reference_year: form.reference_year,
        monthly_rate: form.monthly_rate,
        accumulated_12m: form.accumulated_12m || null,
      });
      if (!result.ok) throw new Error(result.error ?? 'Falha ao salvar o valor');
      showMessage('Valor salvo.', 'success');
      setForm((current) => ({ ...current, monthly_rate: '', accumulated_12m: '' }));
      await load();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Erro ao salvar o valor', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteValue = async (id: string) => {
    try {
      const result = await deleteAdjustmentIndexValueAction(id);
      if (!result.ok) throw new Error(result.error ?? 'Falha ao remover o valor');
      showMessage('Valor removido.', 'success');
      await load();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Erro ao remover o valor', 'error');
    }
  };

  const indexOptions = useMemo(
    () => [
      { label: 'Todos os indexadores (comparativo)', value: ALL_INDEXES },
      ...indexes.map((index) => ({ label: `${index.code} — ${index.description}`, value: index.id })),
    ],
    [indexes],
  );

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 12 }, (_, i) => current + 1 - i).map((y) => ({ label: String(y), value: y }));
  }, []);

  return (
    <Section title="Índices de Reajuste">
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="animate-spin text-brand" size={28} />
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* ── Indexador + filtro de ano + atualização automática ────────── */}
          <div className="flex flex-col lg:flex-row lg:items-end gap-3">
            <div className="flex-1">
              <Select
                label="Indexador"
                options={indexOptions}
                value={selectedId}
                onChange={(value) => setSelectedId(String(value))}
                placeholder="Selecione o indexador"
                searchable
                full
              />
            </div>
            <div className="w-full lg:w-[180px]">
              <Select
                label="Ano"
                options={yearFilterOptions}
                value={activeYear === null ? ALL_YEARS : String(activeYear)}
                onChange={(value) => setYearFilter(String(value))}
                full
              />
            </div>
            <button
              type="button"
              onClick={handleSync}
              disabled={isSyncing}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 h-[40px] text-sm font-medium text-white hover:bg-brand-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
            >
              {isSyncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              {isSyncing ? 'Atualizando...' : 'Atualizar pelo Banco Central'}
            </button>
          </div>

          {isComparing ? (
            <p className="text-sm text-content-muted">
              Comparativo de {indexes.length} indexadores
              {activeYear === null ? ' — histórico completo' : ` — ano de ${activeYear}`}.
              Para lançar ou remover valores, escolha um indexador específico.
            </p>
          ) : (
            selected && (
              <p className="text-sm text-content-muted">
                <span className="font-medium text-content-secondary">Descrição:</span> {selected.description}
                {selected.sgs_code
                  ? ` · série SGS ${selected.sgs_code}${selected.sgs_code_12m ? ` / ${selected.sgs_code_12m}` : ''}`
                  : ' · sem série no Banco Central (preenchimento manual)'}
              </p>
            )
          )}

          {!isComparing && selected && !selected.sgs_code && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <Info size={16} className="shrink-0 mt-0.5" />
              <span>
                {selected.code === 'IVAR'
                  ? 'O IVAR é apurado e divulgado pela FGV/IBRE, e o Banco Central não o espelha no SGS — não há série pública para consultar. A atualização automática ignora este indexador; informe os percentuais na tabela abaixo.'
                  : 'O Banco Central não publica este indexador em série consultável, então a atualização automática o ignora. Informe os percentuais na tabela abaixo.'}
              </span>
            </div>
          )}

          {/* ── Lançar valor manualmente ──────────────────────────────────── */}
          {!isComparing && (
            <div className="rounded-lg border border-ui-border-soft p-4">
              <p className="text-sm font-semibold text-content mb-3">Informar percentual</p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-[180px]">
                  <Select
                    label="Mês"
                    options={MONTHS.map((name, i) => ({ label: name, value: i + 1 }))}
                    value={form.reference_month}
                    onChange={(value) => setForm({ ...form, reference_month: Number(value) })}
                    full
                  />
                </div>
                <div className="w-[140px]">
                  <Select
                    label="Ano"
                    options={yearOptions}
                    value={form.reference_year}
                    onChange={(value) => setForm({ ...form, reference_year: Number(value) })}
                    full
                  />
                </div>
                <div className="w-[190px]">
                  <label className="block text-sm font-medium text-content-secondary mb-1.5">
                    Percentual do Mês (%)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.monthly_rate}
                    onChange={(e) => setForm({ ...form, monthly_rate: e.target.value })}
                    placeholder="0,45"
                    className="w-full border border-ui-border rounded-lg px-4 h-[40px] text-[14px] bg-surface outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                  />
                </div>
                <div className="w-[210px]">
                  <label className="block text-sm font-medium text-content-secondary mb-1.5">
                    Acumulado 12 Meses (%)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.accumulated_12m}
                    onChange={(e) => setForm({ ...form, accumulated_12m: e.target.value })}
                    placeholder="opcional"
                    className="w-full border border-ui-border rounded-lg px-4 h-[40px] text-[14px] bg-surface outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddValue}
                  disabled={isSaving || !selectedId}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 h-[40px] text-sm font-medium text-white hover:bg-brand-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  Salvar
                </button>
              </div>
            </div>
          )}

          {isComparing ? (
            /* ── Comparativo: uma coluna por indexador ──────────────────── */
            <div className="overflow-x-auto rounded-lg border border-ui-border-soft">
              <table
                className="w-full border-collapse"
                style={{ minWidth: `${180 + indexes.length * 200}px` }}
              >
                <thead>
                  <tr className="text-left text-[11px] font-semibold text-content-muted uppercase tracking-wide bg-surface-subtle">
                    <th className="px-4 py-2.5 align-bottom" rowSpan={2}>Mês/Ano Referência</th>
                    {indexes.map((index) => (
                      <th
                        key={index.id}
                        colSpan={2}
                        title={index.description}
                        className="px-4 py-2 text-center border-l border-ui-border-soft"
                      >
                        {index.code}
                      </th>
                    ))}
                  </tr>
                  <tr className="text-left text-[10px] font-medium text-content-muted uppercase tracking-wide border-b border-ui-border-soft bg-surface-subtle">
                    {indexes.map((index) => (
                      <Fragment key={index.id}>
                        <th className="px-4 py-1.5 text-right border-l border-ui-border-soft">Mês (%)</th>
                        <th className="px-4 py-1.5 text-right">12 meses (%)</th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={1 + indexes.length * 2}
                        className="px-4 py-10 text-center text-sm text-content-muted"
                      >
                        {activeYear === null
                          ? 'Nenhum valor cadastrado. Use o botão acima para buscar no Banco Central ou informe os percentuais manualmente.'
                          : `Nenhum valor cadastrado para ${activeYear}. Troque o ano ou informe os percentuais manualmente.`}
                      </td>
                    </tr>
                  ) : (
                    comparisonRows.map((row) => (
                      <tr
                        key={row.key}
                        className="text-sm text-content-secondary border-b border-ui-border-soft/60 hover:bg-surface-subtle"
                      >
                        <td className="px-4 py-2 whitespace-nowrap font-medium text-content">
                          {formatReference(row)}
                        </td>
                        {indexes.map((index) => {
                          const cell = row.cells[index.id];
                          return (
                            <Fragment key={index.id}>
                              <td className="px-4 py-2 text-right whitespace-nowrap border-l border-ui-border-soft">
                                {formatPercent(cell?.monthly_rate)}
                              </td>
                              <td className="px-4 py-2 text-right whitespace-nowrap">
                                {formatPercent(cell?.accumulated_12m, { fixed2: true })}
                              </td>
                            </Fragment>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* ── Tabela de valores do indexador selecionado ─────────────── */
            <div className="overflow-x-auto rounded-lg border border-ui-border-soft">
              <table className="w-full min-w-[760px] border-collapse">
                <thead>
                  <tr className="text-left text-[11px] font-semibold text-content-muted uppercase tracking-wide border-b border-ui-border-soft bg-surface-subtle">
                    <th className="px-4 py-2.5">Nome do Indexador</th>
                    <th className="px-4 py-2.5">Mês/Ano Referência</th>
                    <th className="px-4 py-2.5 text-right">Percentual do Mês (%)</th>
                    <th className="px-4 py-2.5 text-right">Acumulado 12 Meses (%)</th>
                    <th className="px-4 py-2.5">Data de Atualização</th>
                    <th className="px-4 py-2.5">Origem</th>
                    <th className="px-4 py-2.5 w-[60px]" />
                  </tr>
                </thead>
                <tbody>
                  {values.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-sm text-content-muted">
                        {activeYear === null
                          ? 'Nenhum valor cadastrado. Use o botão acima para buscar no Banco Central ou informe os percentuais manualmente.'
                          : `Nenhum valor cadastrado para ${activeYear}. Troque o ano ou informe os percentuais manualmente.`}
                      </td>
                    </tr>
                  ) : (
                    values.map((value) => (
                      <tr key={value.id} className="text-sm text-content-secondary border-b border-ui-border-soft/60 hover:bg-surface-subtle">
                        <td className="px-4 py-2 whitespace-nowrap">{selected?.code}</td>
                        <td className="px-4 py-2 whitespace-nowrap">{formatReference(value)}</td>
                        <td className="px-4 py-2 text-right whitespace-nowrap">{formatPercent(value.monthly_rate)}</td>
                        <td className="px-4 py-2 text-right whitespace-nowrap">{formatPercent(value.accumulated_12m, { fixed2: true })}</td>
                        <td className="px-4 py-2 whitespace-nowrap">{formatDateTime(value.synced_at)}</td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <span className={`text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 border ${
                            value.from_api
                              ? 'text-brand border-brand/30'
                              : 'text-content-muted border-ui-border'
                          }`}>
                            {value.from_api ? 'BCB' : 'Manual'}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <button
                            type="button"
                            onClick={() => handleDeleteValue(value.id)}
                            title="Remover valor"
                            aria-label={`Remover valor de ${formatReference(value)}`}
                            className="p-1.5 text-content-muted hover:text-state-error hover:bg-state-error/10 rounded transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}
