/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, Edit2, X, Search } from "lucide-react";
import Toggle from "@/components/Ui/Toggle";

// Tipagens genéricas
export interface ManagerColumn {
  id: string;
  name: string;
  is_active: boolean;
  is_system?: boolean;
  [key: string]: any;
}

export type FormMode = 'IDLE' | 'CREATE_PARENT' | 'EDIT_PARENT' | 'CREATE_CHILD' | 'EDIT_CHILD';

interface MultiColumnManagerProps {
  titleParent: string;
  titleChild: string;
  // Controle de 1 ou 2 níveis
  hasChild?: boolean;
  // Dados brutos
  parentData: ManagerColumn[];
  childData: ManagerColumn[];
  // Relações (para saber como conectar o filho ao pai)
  childRelationKey: string;
  // Eventos de Ação que quem chamar o componente vai gerenciar
  onSaveParent: (data: any, mode: 'CREATE' | 'EDIT') => Promise<any>;
  onSaveChild: (data: any, parentId: string, mode: 'CREATE' | 'EDIT') => Promise<any>;
  onDeleteParent: (id: string, name: string) => Promise<void>;
  onDeleteChild: (id: string, name: string) => Promise<void>;
  isLoading: boolean;
  
  // Gatilho para limpar e fechar o formulário ao trocar de aba (ex: Despesa -> Receita)
  resetTrigger?: any; 
}

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
  resetTrigger // <-- Pegamos a prop aqui
}: MultiColumnManagerProps) {
  
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  
  // Buscas
  const [searchParent, setSearchParent] = useState('');
  const [searchChild, setSearchChild] = useState('');
  
  // Controle do Formulário
  const [formMode, setFormMode] = useState<FormMode>('IDLE');
  const [formData, setFormData] = useState({ id: '', name: '', is_active: true });
  const [isSaving, setIsSaving] = useState(false);

  // Referência para o Input de Nome
  const inputRef = useRef<HTMLInputElement>(null);

  // Efeito 1: Focar no input e colocar o cursor no final do texto
  useEffect(() => {
    if (formMode !== 'IDLE') {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          // Pega o tamanho do texto atual e joga o cursor para o final
          const length = inputRef.current.value.length;
          inputRef.current.setSelectionRange(length, length);
        }
      }, 50);
    }
  }, [formMode]);

  // Efeito 2: Escutar o gatilho (resetTrigger) para fechar tudo ao trocar de aba
  useEffect(() => {
    // Sempre que o valor de resetTrigger mudar, nós fechamos o form e limpamos seleções
    setFormMode('IDLE');
    setFormData({ id: '', name: '', is_active: true });
    setSelectedParentId(null);
    setSearchParent('');
    setSearchChild('');
  }, [resetTrigger]);

  const normalizeText = (text: string) => 
    text ? text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : '';

  // Filtros: Ordenando pela data de criação decrescente
  const displayedParents = parentData
    .filter(p => !p.deleted_at)
    .filter(p => normalizeText(p.name).includes(normalizeText(searchParent)))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const displayedChildren = childData
    .filter(c => c[childRelationKey] === selectedParentId && !c.deleted_at)
    .filter(c => normalizeText(c.name).includes(normalizeText(searchChild)))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const openForm = (mode: FormMode, data: any = null) => {
    setFormMode(mode);
    setFormData({
      id: data?.id || '',
      name: data?.name || '',
      is_active: data !== null ? data.is_active : true
    });
  };

  const closeForm = () => {
    setFormMode('IDLE');
    setFormData({ id: '', name: '', is_active: true });
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;

    setIsSaving(true);
    try {
      const payload = { id: formData.id, name: formData.name, is_active: formData.is_active };

      if (formMode === 'CREATE_PARENT' || formMode === 'EDIT_PARENT') {
        const result = await onSaveParent(payload, formMode.includes('CREATE') ? 'CREATE' : 'EDIT');
        if (formMode === 'CREATE_PARENT' && result?.id && hasChild) {
          setSelectedParentId(result.id);
        }
      } else {
        await onSaveChild(payload, selectedParentId!, formMode.includes('CREATE') ? 'CREATE' : 'EDIT');
      }
      
      closeForm();
    } catch (error) {
      // O erro normalmente já exibirá um toast no componente pai
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteParentClick = async (e: React.MouseEvent, parent: ManagerColumn) => {
    e.stopPropagation();
    try {
      await onDeleteParent(parent.id, parent.name);
      // Só limpa se a exclusão passar sem throw error no componente pai
      if (selectedParentId === parent.id) {
        setSelectedParentId(null);
        closeForm();
      }
    } catch (error) {
      // Falha na exclusão, faz nada
    }
  };

  const handleDeleteChildClick = async (e: React.MouseEvent, child: ManagerColumn) => {
    e.stopPropagation();
    try {
      await onDeleteChild(child.id, child.name);
      // Só limpa o form se a exclusão for de fato executada
      if (formData.id === child.id) {
        closeForm();
      }
    } catch (error) {
       // Falha na exclusão, faz nada
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 ${hasChild ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-6`}>
      {/* COLUNA 1: PAI */}
      <div className="flex flex-col border border-ui-border rounded-xl bg-surface-subtle overflow-hidden h-[550px]">
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
            displayedParents.map(parent => (
              <div 
                key={parent.id}
                onClick={() => {
                  setSelectedParentId(parent.id);
                  openForm('EDIT_PARENT', parent);
                }}
                className={`group flex justify-between items-center px-3 py-2.5 cursor-pointer rounded-lg mb-1 transition-colors ${
                  selectedParentId === parent.id 
                    ? 'bg-brand/10 text-brand font-medium' 
                    : 'hover:bg-ui-border-soft text-content-secondary'
                }`}
              >
                <span className={`truncate text-[14px] ${!parent.is_active ? 'opacity-60 line-through text-content-muted' : ''}`}>
                  {parent.name}
                </span>

                <div className={`flex gap-1 flex-shrink-0 ml-2 ${selectedParentId === parent.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setSelectedParentId(parent.id); openForm('EDIT_PARENT', parent); }}
                    className="p-1 hover:bg-brand/20 rounded text-brand"
                  >
                    <Edit2 size={14} />
                  </button>
                  {!parent.is_system && (
                    <button 
                      onClick={(e) => handleDeleteParentClick(e, parent)}
                      className="p-1 hover:bg-red-100 rounded text-state-error"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* COLUNA 2: FILHO (Exibido condicionalmente) */}
      {hasChild && (
        <div className="flex flex-col border border-ui-border rounded-xl bg-surface-subtle overflow-hidden h-[550px]">
          <div className="bg-surface p-3 border-b border-ui-border">
            <div className="flex justify-between items-center mb-3 px-1">
              <h3 className="font-bold text-content text-[15px]">{titleChild}</h3>
              <button 
                onClick={() => openForm('CREATE_CHILD')}
                disabled={!selectedParentId}
                className={`p-1 rounded-md transition-colors ${
                  selectedParentId 
                    ? 'hover:bg-brand/10 text-brand cursor-pointer' 
                    : 'text-ui-border cursor-not-allowed'
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
              displayedChildren.map(child => (
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

                  <div className={`flex gap-1 flex-shrink-0 ml-2 ${formData.id === child.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); openForm('EDIT_CHILD', child); }}
                      className="p-1 hover:bg-brand/20 rounded text-brand"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={(e) => handleDeleteChildClick(e, child)}
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

      {/* COLUNA 3: FORMULÁRIO */}
      <div className="flex flex-col h-[550px]">
        {formMode === 'IDLE' ? (
          <div className="flex flex-col items-center justify-center h-full border border-dashed border-ui-border rounded-xl bg-surface-subtle text-content-muted p-6 text-center">
            <p className="text-[14px]">Selecione uma ação nas listas {hasChild ? 'ao lado' : ''} para adicionar ou editar.</p>
          </div>
        ) : (
          <div className="flex flex-col border border-brand/30 rounded-xl bg-surface overflow-hidden h-fit shadow-md animate-fade-in">
            <div className="flex justify-between items-center p-4 border-b border-ui-border bg-surface-subtle">
              <h3 className="font-bold text-brand text-[15px]">
                {formMode === 'CREATE_PARENT' && `Novo ${titleParent}`}
                {formMode === 'EDIT_PARENT' && `Editar ${titleParent}`}
                {formMode === 'CREATE_CHILD' && `Novo ${titleChild}`}
                {formMode === 'EDIT_CHILD' && `Editar ${titleChild}`}
              </h3>
              <button onClick={closeForm} className="text-content-muted hover:text-content transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <div className="p-5 flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-semibold text-content-secondary">
                  Nome {formMode.includes('PARENT') ? `do ${titleParent}` : `do ${titleChild}`}
                </label>
                <input 
                  ref={inputRef} 
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2.5 text-[14px] border border-ui-border rounded-lg outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-all"
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                />
              </div>

              <div className="flex flex-col gap-2 mt-2">
                <label className="text-[13px] font-semibold text-content-secondary">Status</label>
                <Toggle 
                  checked={formData.is_active}
                  onChange={(val) => setFormData({ ...formData, is_active: val })}
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
                  {isSaving ? 'Salvando...' : (formMode.includes('CREATE') ? 'Criar' : 'Salvar')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}