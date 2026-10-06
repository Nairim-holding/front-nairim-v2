'use client';

import { useEffect, useState } from 'react';
import { getPublicSiteSettingsAction, savePublicSiteSettingsAction } from '@/server/actions/public-site';
import { useMessageContext } from '@/contexts/MessageContext';

export default function PublicSiteSettings() {
  const [companies, setCompanies] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { showMessage } = useMessageContext();

  useEffect(() => {
    let active = true;
    getPublicSiteSettingsAction().then(result => {
      if (!active) return;
      if (!result.ok) { setError(result.error); return; }
      setCompanies(result.data.companies);
      setCompanyId(result.data.companyId);
    }).catch(() => { if (active) setError('Não foi possível carregar as empresas.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function save() {
    setSaving(true);
    try {
      const result = await savePublicSiteSettingsAction(companyId);
      if (!result.ok) throw new Error(result.error);
      showMessage('Empresa da página principal atualizada.', 'success');
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Não foi possível salvar.', 'error');
    } finally { setSaving(false); }
  }

  return (
    <section className="bg-surface border border-ui-border rounded-2xl p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-content">Página principal</h2>
      <p className="text-sm text-content-secondary mt-2 mb-4">Escolha a empresa cujos imóveis, logo e cores serão exibidos para os visitantes do site. A seleção vale para todos os visitantes.</p>
      {error ? <p role="alert" className="text-red-600">{error}</p> : (
        <>
          <label htmlFor="public-site-company" className="block text-sm font-medium mb-2">Empresa da vitrine pública</label>
          <select id="public-site-company" value={companyId} onChange={event => setCompanyId(event.target.value)} disabled={loading || saving} className="w-full rounded-lg border border-ui-border bg-surface p-3 text-content">
            <option value="">{loading ? 'Carregando empresas…' : 'Selecione uma empresa'}</option>
            {companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
          </select>
          <button type="button" onClick={save} disabled={loading || saving || !companyId} className="mt-4 rounded-lg bg-brand px-4 py-2 text-white disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar empresa da página principal'}</button>
        </>
      )}
    </section>
  );
}
