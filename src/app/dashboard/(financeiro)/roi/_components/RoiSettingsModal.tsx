'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, Settings } from 'lucide-react';
import Select from '@/components/ui/Select';
import { useMessageContext } from '@/contexts/MessageContext';
import { getRoiSettingsAction, saveRoiSettingsAction } from '@/server/actions/property-roi';
import { ROI_LINE_DEFINITIONS, emptyRoiLines, type RoiCategoryOption, type RoiLineKey, type RoiLines } from '@/core/entities/property-roi';

interface RoiSettingsModalProps {
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Configuração do ROI: qual categoria/subcategoria do Financeiro alimenta cada
 * linha do cálculo. Abre já preenchida pelos nomes da planilha quando a
 * empresa tem categorias com esses nomes.
 */
export default function RoiSettingsModal({ canEdit, onClose, onSaved }: RoiSettingsModalProps) {
  const { showMessage } = useMessageContext();
  const [categories, setCategories] = useState<RoiCategoryOption[]>([]);
  const [lines, setLines] = useState<RoiLines>(emptyRoiLines);
  const [saved, setSaved] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getRoiSettingsAction().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setCategories(result.data.categories);
        setLines(result.data.lines);
        setSaved(result.data.saved);
      } else {
        showMessage(result.error ?? 'Erro ao carregar a configuração do ROI.', 'error', 4000);
      }
      setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [showMessage]);

  const setLine = (key: RoiLineKey, patch: Partial<RoiLines[RoiLineKey]>) =>
    setLines((current) => ({ ...current, [key]: { ...current[key], ...patch } }));

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const result = await saveRoiSettingsAction({ lines });
      if (!result.ok) throw new Error(result.error ?? 'Erro ao salvar configuração.');
      showMessage('Configuração do ROI salva com sucesso', 'success', 2500);
      onSaved();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Erro ao salvar configuração.', 'error', 4000);
    } finally {
      setIsSaving(false);
    }
  }, [lines, showMessage, onSaved]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-surface rounded-2xl shadow-xl border border-ui-border-soft w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ui-border-soft">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-brand" />
            <h2 className="text-sm font-semibold text-content">Configurar ROI por Imóvel</h2>
          </div>
          <button type="button" onClick={onClose} className="text-content-muted hover:text-content transition-colors" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-content-muted text-sm">Carregando...</div>
        ) : (
          <div className="px-5 py-4 flex flex-col gap-4 overflow-y-auto">
            <p className="text-xs text-content-muted">
              Escolha a categoria e a subcategoria do Financeiro usadas em cada linha do cálculo. Sem subcategoria, entram todos os lançamentos da categoria.
              {!saved && ' As linhas abaixo foram sugeridas pelos nomes das categorias — confira e salve.'}
            </p>

            {ROI_LINE_DEFINITIONS.map((definition) => {
              const type = definition.side === 'income' ? 'INCOME' : 'EXPENSE';
              const line = lines[definition.key];
              const categoryOptions = categories.filter((category) => category.type === type).map((category) => ({ label: category.name, value: category.id }));
              const subcategoryOptions = (categories.find((category) => category.id === line.category_id)?.subcategories ?? []).map((sub) => ({ label: sub.name, value: sub.id }));
              return (
                <div key={definition.key} className="rounded-lg border border-ui-border-soft p-3">
                  <p className="text-sm font-semibold text-content">{definition.label}</p>
                  <p className="mb-2 text-[11px] text-content-muted">
                    Planilha: {definition.categoryName} / {definition.subcategoryName} · {definition.side === 'income' ? 'Centro de Receita' : 'Centro de Custo'} do imóvel
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Select
                      label="Categoria"
                      options={categoryOptions}
                      searchable
                      value={line.category_id ?? ''}
                      onChange={(value) => setLine(definition.key, { category_id: String(value) || null, subcategory_id: null })}
                      placeholder="Não considerar"
                      disabled={!canEdit}
                    />
                    <Select
                      label="Subcategoria (opcional)"
                      options={subcategoryOptions}
                      searchable
                      value={line.subcategory_id ?? ''}
                      onChange={(value) => setLine(definition.key, { subcategory_id: String(value) || null })}
                      placeholder="Todas as subcategorias"
                      disabled={!canEdit || !line.category_id}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-ui-border-soft">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-content-secondary hover:bg-surface-subtle transition-colors">
            {canEdit ? 'Cancelar' : 'Fechar'}
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-brand text-content-inverse hover:bg-brand-hover disabled:opacity-50 transition-colors"
            >
              {isSaving ? 'Salvando...' : 'Salvar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
