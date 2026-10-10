'use client';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, X, Building2 } from 'lucide-react';
import { useAuth, useMessageContext } from '@/contexts';
import { clonePropertiesAction, getPropertyCloneCompaniesAction } from '@/server/actions/property';
import { CheckboxGroup } from '@/app/dashboard/(financeiro)/relatorios/_components/FiltersPanel';

export default function PropertyCloneControl({ ids, onCloned }: { ids: string[]; onCloned: () => void }) {
  const { user } = useAuth(); const { showMessage } = useMessageContext();
  const [busy, setBusy] = useState(false); const [companies, setCompanies] = useState<{ id: string; name: string }[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]); const [search, setSearch] = useState('');
  const [results, setResults] = useState<{ company: string; property: string; ok: boolean; error?: string }[] | null>(null);
  const execute = async (companyIds: string[]) => {
    setBusy(true);
    try {
      const result = await clonePropertiesAction({ property_ids: ids, company_ids: companyIds });
      if (!result.ok) throw new Error(result.error);
      const failed = result.data.filter(row => !row.ok).length;
      showMessage(`${result.data.length - failed} cópia(s) concluída(s)${failed ? `; ${failed} com falha` : ''}.`, failed ? 'error' : 'success');
      if (failed) setResults(result.data);
      else { setCompanies(null); onCloned(); }
    } catch (error) { showMessage(error instanceof Error ? error.message : 'Erro ao duplicar imóveis.', 'error'); }
    finally { setBusy(false); }
  };
  const open = async () => {
    setBusy(true);
    try {
      const result = await getPropertyCloneCompaniesAction();
      if (!result.ok) throw new Error(result.error);
      if (result.data.length === 1) { await execute([result.data[0].id]); return; }
      setCompanies(result.data); setSelected(user?.company_id ? [user.company_id] : []); setSearch(''); setResults(null);
    } catch (error) { showMessage(error instanceof Error ? error.message : 'Erro ao carregar empresas.', 'error'); }
    finally { setBusy(false); }
  };
  const close = () => { if (busy) return; setCompanies(null); if (results) { setResults(null); onCloned(); } };
  const filtered = companies?.filter(company => company.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))) ?? [];
  return <>
    <button type="button" aria-label="Duplicar imóveis selecionados" title="Duplicar imóveis selecionados" disabled={busy || !ids.length}
      onClick={() => void open()} className="rounded p-2 text-content-muted transition-colors hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-50"><Copy size={20} /></button>
    {(companies || results) && createPortal(<div role="dialog" aria-modal="true" aria-labelledby="property-clone-title" className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4"
      onKeyDown={event => { if (event.key === 'Escape') close(); if (event.key === 'Tab') { const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')); const first = elements[0]; const last = elements.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } } }}>
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-ui-border bg-surface p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between"><h2 id="property-clone-title" className="font-semibold text-content">{results ? 'Resultado da duplicação' : 'Duplicar imóveis'}</h2><button type="button" disabled={busy} aria-label="Fechar duplicação" onClick={close} className="p-2 text-content-muted"><X size={18} /></button></div>
        {results ? <div className="overflow-auto text-sm text-content">{results.map((row,index) => <p key={index} className="border-b border-ui-border py-2">{row.company}: {row.property} — {row.ok ? 'Concluído' : row.error}</p>)}</div> : <>
          <p className="mb-3 text-sm text-content-secondary">Selecione as empresas que receberão {ids.length} imóvel(is). Endereços, valores, IPTUs e documentos serão copiados. Locações e lançamentos permanecem no cadastro original.</p>
          <input autoFocus aria-label="Buscar empresa para duplicar" placeholder="Buscar empresa" value={search} onChange={event => setSearch(event.target.value)} className="mb-3 rounded-lg border border-ui-border bg-surface p-2 text-content" />
          <div className="overflow-auto"><CheckboxGroup icon={<Building2 size={16} />} title="Empresas" options={filtered.map(company => ({ value: company.id, label: company.id === user?.company_id ? `Atual — ${company.name}` : company.name }))}
            selected={selected.filter(id => filtered.some(company => company.id === id))} onChange={ids => setSelected([...selected.filter(id => !filtered.some(company => company.id === id)), ...ids])}
            onToggle={id => setSelected(previous => previous.includes(id) ? previous.filter(value => value !== id) : [...previous,id])} /></div>
          <button type="button" disabled={busy || !selected.length} onClick={() => void execute(selected)} className="mt-4 rounded-lg bg-brand px-4 py-2 text-sm text-white disabled:opacity-50">{busy ? 'Duplicando…' : 'Duplicar'}</button>
        </>}
      </div>
    </div>, document.body)}
  </>;
}
