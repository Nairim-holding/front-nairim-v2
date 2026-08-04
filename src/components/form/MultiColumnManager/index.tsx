'use client';

import { useState, useRef, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { Plus, Trash2, Edit2, X, Search } from 'lucide-react';
import Toggle from '@/components/ui/Toggle';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ManagerColumn {
  id: string;
  name: string;
  is_active: boolean;
  is_system?: boolean;
  created_at?: string;
  deleted_at?: string;
  [key: string]: unknown;
}

export type FormMode = 'IDLE' | 'CREATE_PARENT' | 'EDIT_PARENT' | 'CREATE_CHILD' | 'EDIT_CHILD';

interface FormData {
  id: string;
  name: string;
  is_active: boolean;
  [key: string]: unknown;
}

interface MultiColumnManagerProps {
  titleParent: string;
  titleChild: string;
  hasChild?: boolean;
  parentData: ManagerColumn[];
  childData: ManagerColumn[];
  childRelationKey: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSaveParent: (data: any, mode: 'CREATE' | 'EDIT') => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSaveChild: (data: any, parentId: string, mode: 'CREATE' | 'EDIT') => Promise<any>;
  onDeleteParent: (id: string, name: string) => Promise<void>;
  onDeleteChild: (id: string, name: string) => Promise<void>;
  isLoading: boolean;
  resetTrigger?: unknown;
  /** Campos extras exibidos apenas no formulário do Parent (entre Nome e Status). */
  parentExtraFields?: (formData: FormData, setFormData: (updater: (prev: FormData) => FormData) => void) => ReactNode;
  /** Valores iniciais dos campos extras do Parent ao abrir o formulário (create ou edit). */
  parentExtraDefaults?: (record: ManagerColumn | null) => Record<string, unknown>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EMPTY_FORM: FormData = { id: '', name: '', is_active: true };

function normalizeText(text: string): string {
  return text ? text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : '';
}

function sortByCreatedAt(items: ManagerColumn[]): ManagerColumn[] {
  return [...items].sort(
    (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MultiColumnManager({
  titleParent,
  titleChild,
  hasChild = true,
  parentData,
  childData,
  childRelationKey,
  onSaveParent,
  onSaveChild,
  onDeleteParent,
  onDeleteChild,
  isLoading,
  resetTrigger,
  parentExtraFields,
  parentExtraDefaults,
}: MultiColumnManagerProps) {
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [searchParent, setSearchParent] = useState('');
  const [searchChild, setSearchChild] = useState('');
  const [formMode, setFormMode] = useState<FormMode>('IDLE');
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the name input when the form opens
  useEffect(() => {
    if (formMode === 'IDLE') return;
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const len = inputRef.current.value.length;
        inputRef.current.setSelectionRange(len, len);
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [formMode]);

  // Reset all state when the active tab changes
  useEffect(() => {
    setFormMode('IDLE');
    setFormData(EMPTY_FORM);
    setSelectedParentId(null);
    setSearchParent('');
    setSearchChild('');
  }, [resetTrigger]);

  // ─── Derived lists ──────────────────────────────────────────────────────────

  const displayedParents = useMemo(
    () =>
      sortByCreatedAt(
        parentData
          .filter((p) => !p.deleted_at)
          .filter((p) => normalizeText(p.name).includes(normalizeText(searchParent))),
      ),
    [parentData, searchParent],
  );

  const displayedChildren = useMemo(
    () =>
      sortByCreatedAt(
        childData
          .filter((c) => c[childRelationKey] === selectedParentId && !c.deleted_at)
          .filter((c) => normalizeText(c.name).includes(normalizeText(searchChild))),
      ),
    [childData, childRelationKey, selectedParentId, searchChild],
  );

  // ─── Actions ────────────────────────────────────────────────────────────────

  const openForm = useCallback((mode: FormMode, record: ManagerColumn | null = null) => {
    setFormMode(mode);
    const extra = mode.includes('PARENT') ? parentExtraDefaults?.(record) ?? {} : {};
    setFormData({
      id: record?.id ?? '',
      name: record?.name ?? '',
      is_active: record !== null ? record.is_active : true,
      ...extra,
    });
  }, [parentExtraDefaults]);

  const closeForm = useCallback(() => {
    setFormMode('IDLE');
    setFormData(EMPTY_FORM);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!formData.name.trim()) return;

    setIsSaving(true);
    try {
      const isCreate = formMode.includes('CREATE');
      const apiMode = isCreate ? 'CREATE' : 'EDIT';

      if (formMode === 'CREATE_PARENT' || formMode === 'EDIT_PARENT') {
        // Formulário do Parent pode ter campos extras (ex.: dfc_group) — inclui tudo.
        const result = await onSaveParent(formData, apiMode);
        if (formMode === 'CREATE_PARENT' && result?.id && hasChild) {
          setSelectedParentId(result.id);
        }
      } else {
        const payload = { id: formData.id, name: formData.name, is_active: formData.is_active };
        await onSaveChild(payload, selectedParentId!, apiMode);
      }

      closeForm();
    } catch {
      // Error toast is handled by the parent page
    } finally {
      setIsSaving(false);
    }
  }, [formData, formMode, selectedParentId, hasChild, onSaveParent, onSaveChild, closeForm]);

  const handleDeleteParent = useCallback(
    async (e: React.MouseEvent, parent: ManagerColumn) => {
      e.stopPropagation();
      try {
        await onDeleteParent(parent.id, parent.name);
        if (selectedParentId === parent.id) {
          setSelectedParentId(null);
          closeForm();
        }
      } catch {
        // Error toast is handled by the parent page
      }
    },
    [onDeleteParent, selectedParentId, closeForm],
  );

  const handleDeleteChild = useCallback(
    async (e: React.MouseEvent, child: ManagerColumn) => {
      e.stopPropagation();
      try {
        await onDeleteChild(child.id, child.name);
        if (formData.id === child.id) closeForm();
      } catch {
        // Error toast is handled by the parent page
      }
    },
    [onDeleteChild, formData.id, closeForm],
  );

  const handleSelectParent = useCallback(
    (parent: ManagerColumn) => {
      setSelectedParentId(parent.id);
      // Categorias internas do sistema não podem ser editadas: apenas seleciona
      // (para visualizar), sem abrir o formulário de edição.
      if (parent.is_system) {
        closeForm();
        return;
      }
      openForm('EDIT_PARENT', parent);
    },
    [openForm, closeForm],
  );

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
      </div>
    );
  }

  const formTitle = {
    CREATE_PARENT: `Novo ${titleParent}`,
    EDIT_PARENT: `Editar ${titleParent}`,
    CREATE_CHILD: `Novo ${titleChild}`,
    EDIT_CHILD: `Editar ${titleChild}`,
    IDLE: '',
  }[formMode];

  const fieldLabel = formMode.includes('PARENT') ? `do ${titleParent}` : `do ${titleChild}`;
  const submitLabel = formMode.includes('CREATE') ? 'Criar' : 'Salvar';

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={`grid grid-cols-1 ${hasChild ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-6 min-h-screen md:min-h-[70vh] flex-1`}>

      {/* ── Column 1: Parent list ── */}
      <div className="flex flex-col border border-ui-border rounded-xl bg-surface-subtle overflow-hidden">
        <div className="bg-surface p-3 border-b border-ui-border">
          <div className="flex justify-between items-center mb-3 px-1">
            <h3 className="font-bold text-content text-[15px]">{titleParent}</h3>
            <button
              onClick={() => openForm('CREATE_PARENT')}
              className="p-1 hover:bg-brand/10 text-brand rounded-md transition-colors"
              title={`Novo ${titleParent}`}
            >
              <Plus size={18} />
            </button>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
            <input
              type="text"
              placeholder={`Buscar ${titleParent.toLowerCase()}...`}
              value={searchParent}
              onChange={(e) => setSearchParent(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-[13px] bg-surface-subtle border border-ui-border rounded-lg outline-none focus:border-brand transition-colors"
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-2">
          {displayedParents.length === 0 ? (
            <p className="text-[13px] text-content-muted text-center mt-10">Nenhum registro encontrado.</p>
          ) : (
            displayedParents.map((parent) => (
              <div
                key={parent.id}
                onClick={() => handleSelectParent(parent)}
                className={`group flex justify-between items-center px-3 py-2.5 cursor-pointer rounded-lg mb-1 transition-colors ${
                  selectedParentId === parent.id
                    ? 'bg-brand/10 text-brand font-medium'
                    : 'hover:bg-ui-border-soft text-content-secondary'
                }`}
              >
                <span className={`truncate text-[14px] ${!parent.is_active ? 'opacity-60 line-through text-content-muted' : ''}`}>
                  {parent.name}
                </span>
                {parent.is_system ? (
                  <span className="flex-shrink-0 ml-2 text-[10px] font-semibold uppercase tracking-wide text-content-muted bg-ui-border-soft px-2 py-0.5 rounded">
                    Sistema
                  </span>
                ) : (
                  <div className={`flex gap-1 flex-shrink-0 ml-2 transition-opacity ${selectedParentId === parent.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSelectParent(parent); }}
                      className="p-1 hover:bg-brand/20 rounded text-brand"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={(e) => handleDeleteParent(e, parent)}
                      className="p-1 hover:bg-red-100 rounded text-state-error"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Column 2: Child list (conditional) ── */}
      {hasChild && (
        <div className="flex flex-col border border-ui-border rounded-xl bg-surface-subtle overflow-hidden">
          <div className="bg-surface p-3 border-b border-ui-border">
            <div className="flex justify-between items-center mb-3 px-1">
              <h3 className="font-bold text-content text-[15px]">{titleChild}</h3>
              <button
                onClick={() => openForm('CREATE_CHILD')}
                disabled={!selectedParentId}
                className={`p-1 rounded-md transition-colors ${
                  selectedParentId ? 'hover:bg-brand/10 text-brand cursor-pointer' : 'text-ui-border cursor-not-allowed'
                }`}
                title={`Novo ${titleChild}`}
              >
                <Plus size={18} />
              </button>
            </div>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
              <input
                type="text"
                placeholder={`Buscar ${titleChild.toLowerCase()}...`}
                value={searchChild}
                onChange={(e) => setSearchChild(e.target.value)}
                disabled={!selectedParentId}
                className="w-full pl-9 pr-3 py-2 text-[13px] bg-surface-subtle border border-ui-border rounded-lg outline-none focus:border-brand transition-colors disabled:opacity-50"
              />
            </div>
          </div>

          <div className="overflow-y-auto flex-1 p-2">
            {!selectedParentId ? (
              <p className="text-[13px] text-content-muted text-center mt-10">Selecione um item ao lado.</p>
            ) : displayedChildren.length === 0 ? (
              <p className="text-[13px] text-content-muted text-center mt-10">Nenhum registro encontrado.</p>
            ) : (
              displayedChildren.map((child) => (
                <div
                  key={child.id}
                  onClick={() => openForm('EDIT_CHILD', child)}
                  className={`group flex justify-between items-center px-3 py-2.5 cursor-pointer rounded-lg mb-1 transition-colors ${
                    formData.id === child.id && formMode === 'EDIT_CHILD'
                      ? 'bg-brand/10 text-brand font-medium'
                      : 'hover:bg-ui-border-soft text-content-secondary'
                  }`}
                >
                  <span className={`truncate text-[14px] ${!child.is_active ? 'opacity-60 line-through text-content-muted' : ''}`}>
                    {child.name}
                  </span>
                  <div className={`flex gap-1 flex-shrink-0 ml-2 transition-opacity ${formData.id === child.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <button
                      onClick={(e) => { e.stopPropagation(); openForm('EDIT_CHILD', child); }}
                      className="p-1 hover:bg-brand/20 rounded text-brand"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={(e) => handleDeleteChild(e, child)}
                      className="p-1 hover:bg-red-100 rounded text-state-error"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Column 3: Inline form ── */}
      <div className="flex flex-col">
        {formMode === 'IDLE' ? (
          <div className="flex flex-col items-center justify-center border border-dashed border-ui-border rounded-xl bg-surface-subtle text-content-muted p-6 text-center">
            <p className="text-[14px]">
              Selecione uma ação nas listas {hasChild ? 'ao lado' : ''} para adicionar ou editar.
            </p>
          </div>
        ) : (
          <div className="flex flex-col border border-brand/30 rounded-xl bg-surface overflow-hidden shadow-md animate-fade-in">
            <div className="flex justify-between items-center p-4 border-b border-ui-border bg-surface-subtle flex-shrink-0">
              <h3 className="font-bold text-brand text-[15px]">{formTitle}</h3>
              <button onClick={closeForm} className="text-content-muted hover:text-content transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-semibold text-content-secondary">
                  Nome {fieldLabel}
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  className="w-full px-3 py-2.5 text-[14px] border border-ui-border rounded-lg outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-all"
                />
              </div>

              {formMode.includes('PARENT') && parentExtraFields?.(formData, setFormData)}

              <div className="flex flex-col gap-2 mt-2">
                <label className="text-[13px] font-semibold text-content-secondary">Status</label>
                <Toggle
                  checked={formData.is_active}
                  onChange={(val) => setFormData((prev) => ({ ...prev, is_active: val }))}
                  label={formData.is_active ? 'Ativo' : 'Inativo'}
                />
              </div>

              <div className="flex justify-end gap-2 mt-2 pt-4 border-t border-ui-border-soft">
                <button
                  onClick={closeForm}
                  className="px-4 py-2 text-[14px] font-medium border border-ui-border rounded-lg hover:bg-surface-subtle transition-colors text-content-secondary"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSaving}
                  className="px-4 py-2 text-[14px] font-medium bg-brand text-content-inverse rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isSaving ? 'Salvando...' : submitLabel}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
