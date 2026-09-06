'use client';

import { useEffect, useMemo, useState } from 'react';
import { Building2, CalendarDays, CheckCircle2, Landmark, Search, WalletCards, X } from 'lucide-react';
import { listAgenciesAction } from '@/server/actions/agency';
import {
  completeLeaseCreditReconciliationAction,
  searchLeaseCreditCandidatesAction,
} from '@/server/actions/financial-transaction';
import type { CreditCandidate } from '@/core/entities/credit-reconciliation';
import { formatCurrency, parseCurrencyFromPTBR } from '@/utils/formatters';
import { describeActionError } from '@/shared/actions/action-result';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Checkbox from '@/components/ui/Checkbox';
import HolidayManager from './HolidayManager';

interface Option {
  label: string;
  value: string;
}

interface Props {
  institutions: Option[];
  onClose: () => void;
  onCompleted: (updated: number) => void;
}

const today = () => {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

export default function LeaseCreditReconciliationModal({ institutions, onClose, onCompleted }: Props) {
  const [creditDate, setCreditDate] = useState(today);
  const [amount, setAmount] = useState('');
  const [institutionId, setInstitutionId] = useState('');
  const [agencies, setAgencies] = useState<Option[]>([]);
  const [agencyIds, setAgencyIds] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<CreditCandidate[] | null>(null);
  const [selectedLeaseId, setSelectedLeaseId] = useState('');
  const [isLoadingAgencies, setIsLoadingAgencies] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    listAgenciesAction({ limit: 150, page: 1 })
      .then((result) => {
        if (!result.ok) throw new Error(result.error);
        const options = result.data.data.map((agency) => ({
          value: agency.id,
          label: agency.trade_name || agency.legal_name,
        }));
        setAgencies(options);
        setAgencyIds(options.map((option) => option.value));
      })
      .catch(() => setError('Não foi possível carregar as imobiliárias.'))
      .finally(() => setIsLoadingAgencies(false));
  }, []);

  const allSelected = agencies.length > 0 && agencyIds.length === agencies.length;
  const creditedAmount = useMemo(() => parseCurrencyFromPTBR(amount), [amount]);
  const exactMatches = candidates?.filter((candidate) => candidate.amount_matches).length ?? 0;
  const creditYear = Number(creditDate.slice(0, 4)) || new Date().getFullYear();

  const payload = () => ({
    credit_date: creditDate,
    credited_amount: creditedAmount,
    financial_institution_id: institutionId,
    agency_ids: agencyIds,
  });

  const search = async () => {
    setError('');
    setSelectedLeaseId('');
    if (!creditDate || !institutionId || creditedAmount <= 0 || agencyIds.length === 0) {
      setError('Preencha a data, o valor, a instituição e ao menos uma imobiliária.');
      return;
    }
    setIsSearching(true);
    const result = await searchLeaseCreditCandidatesAction(payload());
    setIsSearching(false);
    if (!result.ok) {
      setCandidates(null);
      setError(describeActionError(result, 'Não foi possível pesquisar as locações.'));
      return;
    }
    setCandidates(result.data);
    const exact = result.data.find((candidate) => candidate.amount_matches);
    if (exact) setSelectedLeaseId(exact.lease_id);
  };

  const complete = async () => {
    if (!selectedLeaseId) return;
    setError('');
    setIsCompleting(true);
    const result = await completeLeaseCreditReconciliationAction({ ...payload(), lease_id: selectedLeaseId });
    setIsCompleting(false);
    if (!result.ok) {
      setError(describeActionError(result, 'Não foi possível concluir os lançamentos.'));
      return;
    }
    onCompleted(result.data.updated_transactions);
  };

  const toggleAgency = (id: string) => {
    setAgencyIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3"
      style={{ backgroundColor: 'var(--color-overlay)' }}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ui-border-soft">
          <div>
            <h2 className="text-lg font-semibold text-content">Identificar crédito de locação</h2>
            <p className="text-xs text-content-muted mt-0.5">Encontre a locação pelo crédito líquido recebido no extrato.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-subtle" aria-label="Fechar">
            <X size={19} className="text-content-muted" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 sm:p-5 space-y-4">
          <section className="rounded-xl border border-ui-border-soft bg-surface-subtle/50 p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-content">Dados do crédito</h3>
                <p className="mt-0.5 text-xs text-content-muted">Informe exatamente como o crédito aparece no extrato bancário.</p>
              </div>
              <span className="hidden sm:inline-flex items-center rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-medium text-brand">1. Pesquisar</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input
                id="lease-credit-date"
                label="Data do crédito"
                required
                type="date"
                value={creditDate}
                onChange={(event) => setCreditDate(event.target.value)}
                svg={<CalendarDays size={15} />}
                full
              />
              <Input
                id="lease-credit-amount"
                label="Valor líquido do crédito"
                required
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="R$ 0,00"
                mask="money"
                svg={<WalletCards size={15} />}
                full
              />
              <Select
                id="lease-credit-institution"
                label="Instituição financeira"
                required
                value={institutionId}
                onChange={(value) => setInstitutionId(String(value))}
                options={institutions}
                placeholder="Selecione a instituição"
                searchable
                svg={<Landmark size={15} />}
                full
              />
            </div>

            <fieldset className="rounded-lg border border-ui-border-soft bg-surface p-3">
              <legend className="flex items-center gap-1.5 px-1 text-sm font-medium text-content"><Building2 size={14} /> Imobiliárias</legend>
            {isLoadingAgencies ? (
              <p className="text-sm text-content-muted">Carregando...</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <div className="rounded-full border border-ui-border-soft px-2.5 py-1.5">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={agencyIds.length > 0 && !allSelected}
                    onChange={() => setAgencyIds(allSelected ? [] : agencies.map((item) => item.value))}
                    label={`Todas (${agencies.length})`}
                  />
                </div>
                {agencies.map((agency) => (
                  <div key={agency.value} className={`rounded-full border px-2.5 py-1.5 transition-colors ${agencyIds.includes(agency.value) ? 'border-brand/40 bg-brand/5' : 'border-ui-border-soft hover:bg-surface-subtle'}`}>
                    <Checkbox
                      checked={agencyIds.includes(agency.value)}
                      onChange={() => toggleAgency(agency.value)}
                      label={agency.label}
                    />
                  </div>
                ))}
              </div>
            )}
            </fieldset>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-content-muted">{agencyIds.length} imobiliária(s) selecionada(s)</span>
              <button onClick={search} disabled={isSearching || isLoadingAgencies} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium disabled:opacity-50">
                <Search size={16} className={isSearching ? 'animate-pulse' : ''} />
                {isSearching ? 'Analisando...' : 'Pesquisar possíveis locações'}
              </button>
            </div>
          </section>

          {error && <p className="rounded-lg bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</p>}

          {candidates && (
            <section className="rounded-xl border border-ui-border-soft p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-content">2. Possíveis locações</h3>
                <span className="text-xs text-content-muted">{exactMatches} correspondência(s) exata(s) de {candidates.length} candidata(s)</span>
              </div>
              {candidates.length === 0 ? (
                <div className="text-center py-8 rounded-lg border border-dashed border-ui-border text-sm text-content-muted">Nenhuma locação pendente corresponde à data e aos filtros informados.</div>
              ) : (
                <div className="space-y-2">
                  {candidates.map((candidate) => (
                    <label key={candidate.lease_id} className={`block rounded-lg border p-3 cursor-pointer transition-colors ${selectedLeaseId === candidate.lease_id ? 'border-brand bg-brand/5' : 'border-ui-border-soft hover:bg-surface-subtle'}`}>
                      <div className="flex gap-3">
                        <input type="radio" name="candidate" checked={selectedLeaseId === candidate.lease_id} onChange={() => setSelectedLeaseId(candidate.lease_id)} className="mt-1" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-content">{candidate.property_title}</span>
                            {candidate.amount_matches && <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5"><CheckCircle2 size={12} /> Valor correspondente</span>}
                          </div>
                          <p className="text-sm text-content-secondary">{candidate.tenant_name} · {candidate.agency_name}</p>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3 text-xs">
                            <div><span className="block text-content-muted">Aluguel bruto</span><strong className="text-emerald-600">{formatCurrency(candidate.gross_amount)}</strong></div>
                            <div><span className="block text-content-muted">Restituição IPTU</span><strong className="text-emerald-600">{formatCurrency(candidate.property_tax_refund)}</strong></div>
                            <div><span className="block text-content-muted">IRRF</span><strong className="text-orange-600">− {formatCurrency(candidate.income_tax_withheld)}</strong></div>
                            <div><span className="block text-content-muted">Comissão</span><strong className="text-orange-600">− {formatCurrency(candidate.agency_commission)}</strong></div>
                            <div><span className="block text-content-muted">Líquido calculado</span><strong className="text-content">{formatCurrency(candidate.net_amount)}</strong></div>
                          </div>
                          <p className="mt-2 text-[11px] text-content-muted">Vencimentos: aluguel {candidate.rent_due_day}, IPTU {candidate.tax_due_day ?? '—'}, condomínio {candidate.condo_due_day ?? '—'} · {candidate.pending_transaction_ids.length} lançamento(s) pendente(s)</p>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </section>
          )}

          <HolidayManager key={creditYear} year={creditYear} onError={setError} />
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-ui-border-soft">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-surface-subtle text-content-secondary text-sm">Cancelar</button>
          <button onClick={complete} disabled={!selectedLeaseId || isCompleting} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium disabled:opacity-50">
            {isCompleting ? 'Concluindo...' : 'Confirmar locação e concluir lançamentos'}
          </button>
        </div>
      </div>
    </div>
  );
}
