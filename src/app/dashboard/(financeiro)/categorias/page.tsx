/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from "react";
import Section from "@/components/Section";
import { Plus, Trash2, Edit2, X, Search } from "lucide-react";
import { useMessageContext } from "@/contexts/MessageContext";
import { usePopupContext } from "@/contexts/PopupContext";
import Toggle from "@/components/Ui/Toggle";

type FormMode = 'IDLE' | 'CREATE_CAT' | 'EDIT_CAT' | 'CREATE_SUB' | 'EDIT_SUB';

export default function CategoriasESubcategoriasPage() {
  const { showMessage } = useMessageContext();
  const { showPopup } = usePopupContext();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Dados
  const [categories, setCategories] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  
  // Controles de Tela
  const [transactionType, setTransactionType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  
  // Buscas
  const [searchCat, setSearchCat] = useState('');
  const [searchSub, setSearchSub] = useState('');
  
  // Controle do Formulário
  const [formMode, setFormMode] = useState<FormMode>('IDLE');
  const [formData, setFormData] = useState({ id: '', name: '', is_active: true });

  const baseURL = process.env.NEXT_PUBLIC_URL_API;

  const fetchData = async () => {
    try {
      const [catRes, subRes] = await Promise.all([
        fetch(`${baseURL}/financial-category?limit=1000`),
        fetch(`${baseURL}/financial-subcategory?limit=1000`)
      ]);
      const catData = await catRes.json();
      const subData = await subRes.json();
      
      setCategories(catData?.data || catData || []);
      setSubcategories(subData?.data || subData || []);
    } catch (error) {
      showMessage("Erro ao carregar os dados.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const normalizeText = (text: string) => 
    text ? text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : '';

  // Filtros: Ordenando pela data de criação decrescente (Os mais novos primeiro)
  const displayedCategories = categories
    .filter(c => c.type === transactionType && !c.deleted_at)
    .filter(c => normalizeText(c.name).includes(normalizeText(searchCat)))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const displayedSubcategories = subcategories
    .filter(s => s.category_id === selectedCategoryId && !s.deleted_at)
    .filter(s => normalizeText(s.name).includes(normalizeText(searchSub)))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const handleTypeChange = (type: 'EXPENSE' | 'INCOME') => {
    setTransactionType(type);
    setSelectedCategoryId(null);
    setSearchCat('');
    setSearchSub('');
    setFormMode('IDLE');
  };

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
    if (!formData.name.trim()) {
      showMessage("O nome é obrigatório.", "error");
      return;
    }

    setIsSaving(true);
    try {
      let url = '';
      let method = '';
      const body: any = { name: formData.name, is_active: formData.is_active };

      if (formMode === 'CREATE_CAT') {
        url = `${baseURL}/financial-category`;
        method = 'POST';
        body.type = transactionType;
      } else if (formMode === 'EDIT_CAT') {
        url = `${baseURL}/financial-category/${formData.id}`;
        method = 'PUT';
      } else if (formMode === 'CREATE_SUB') {
        url = `${baseURL}/financial-subcategory`;
        method = 'POST';
        body.category_id = selectedCategoryId;
      } else if (formMode === 'EDIT_SUB') {
        url = `${baseURL}/financial-subcategory/${formData.id}`;
        method = 'PUT';
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.message || "Erro ao salvar.");
      }

      showMessage("Salvo com sucesso!", "success");
      closeForm();
      
      // Se acabou de criar uma categoria nova, já selecionamos ela logo após carregar os dados
      const newCategoryData = formMode === 'CREATE_CAT' ? await res.json() : null;
      
      await fetchData();

      if (newCategoryData && newCategoryData.id) {
        setSelectedCategoryId(newCategoryData.id);
      }

    } catch (error: any) {
      showMessage(error.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (type: 'CAT' | 'SUB', id: string, name: string) => {
    const resource = type === 'CAT' ? 'financial-category' : 'financial-subcategory';
    const text = type === 'CAT' ? 'categoria' : 'subcategoria';

    showPopup(
      `Excluir ${text}`,
      `Tem certeza que deseja excluir "${name}"?`,
      async () => {
        try {
          const res = await fetch(`${baseURL}/${resource}/${id}`, { method: 'DELETE' });
          if (!res.ok) {
            const result = await res.json().catch(() => ({}));
            throw new Error(result.message || `Erro ao excluir ${text}.`);
          }
          
          showMessage("Excluído com sucesso!", "success");
          if (type === 'CAT' && selectedCategoryId === id) {
            setSelectedCategoryId(null);
            closeForm();
          } else if (type === 'SUB' && formData.id === id) {
            closeForm();
          }
          await fetchData();
        } catch (error: any) {
          showMessage(error.message, "error");
        }
      },
      () => {}
    );
  };

  return (
    <Section title="Gerenciar Categorias">
      <div className="bg-surface p-6 rounded-xl shadow-sm border border-ui-border max-w-5xl mx-auto w-full">
        
        <div className="flex mb-6 rounded-lg overflow-hidden w-fit border border-ui-border bg-surface-subtle">
          <button
            onClick={() => handleTypeChange('EXPENSE')}
            className={`px-8 py-2.5 text-sm font-bold transition-all ${
              transactionType === 'EXPENSE' 
                ? 'bg-brand text-content-inverse shadow-md' 
                : 'text-content-secondary hover:text-content'
            }`}
          >
            Despesa
          </button>
          <button
            onClick={() => handleTypeChange('INCOME')}
            className={`px-8 py-2.5 text-sm font-bold transition-all ${
              transactionType === 'INCOME' 
                ? 'bg-brand text-content-inverse shadow-md' 
                : 'text-content-secondary hover:text-content'
            }`}
          >
            Receita
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* COLUNA 1: CATEGORIAS */}
            <div className="flex flex-col border border-ui-border rounded-xl bg-surface-subtle overflow-hidden h-[550px]">
              <div className="bg-surface p-3 border-b border-ui-border">
                <div className="flex justify-between items-center mb-3 px-1">
                  <h3 className="font-bold text-content text-[15px]">Categoria</h3>
                  <button 
                    onClick={() => openForm('CREATE_CAT')}
                    className="p-1 hover:bg-brand/10 text-brand rounded-md transition-colors"
                    title="Nova Categoria"
                  >
                    <Plus size={18} />
                  </button>
                </div>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
                  <input 
                    type="text" 
                    placeholder="Buscar categoria..." 
                    value={searchCat}
                    onChange={(e) => setSearchCat(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-[13px] bg-surface-subtle border border-ui-border rounded-lg outline-none focus:border-brand transition-colors"
                  />
                </div>
              </div>
              
              <div className="overflow-y-auto flex-1 p-2">
                {displayedCategories.length === 0 ? (
                  <p className="text-[13px] text-content-muted text-center mt-10">Nenhuma categoria encontrada.</p>
                ) : (
                  displayedCategories.map(cat => (
                    <div 
                      key={cat.id}
                      onClick={() => {
                        setSelectedCategoryId(cat.id);
                        openForm('EDIT_CAT', cat);
                      }}
                      className={`group flex justify-between items-center px-3 py-2.5 cursor-pointer rounded-lg mb-1 transition-colors ${
                        selectedCategoryId === cat.id 
                          ? 'bg-brand/10 text-brand font-medium' 
                          : 'hover:bg-ui-border-soft text-content-secondary'
                      }`}
                    >
                      <span className={`truncate text-[14px] ${!cat.is_active ? 'opacity-60 line-through text-content-muted' : ''}`}>
                        {cat.name}
                      </span>

                      <div className={`flex gap-1 flex-shrink-0 ml-2 ${selectedCategoryId === cat.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSelectedCategoryId(cat.id); openForm('EDIT_CAT', cat); }}
                          className="p-1 hover:bg-brand/20 rounded text-brand"
                        >
                          <Edit2 size={14} />
                        </button>
                        {!cat.is_system && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDelete('CAT', cat.id, cat.name); }}
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

            {/* COLUNA 2: SUBCATEGORIAS */}
            <div className="flex flex-col border border-ui-border rounded-xl bg-surface-subtle overflow-hidden h-[550px]">
              <div className="bg-surface p-3 border-b border-ui-border">
                <div className="flex justify-between items-center mb-3 px-1">
                  <h3 className="font-bold text-content text-[15px]">Subcategoria</h3>
                  <button 
                    onClick={() => openForm('CREATE_SUB')}
                    disabled={!selectedCategoryId}
                    className={`p-1 rounded-md transition-colors ${
                      selectedCategoryId 
                        ? 'hover:bg-brand/10 text-brand cursor-pointer' 
                        : 'text-ui-border cursor-not-allowed'
                    }`}
                    title="Nova Subcategoria"
                  >
                    <Plus size={18} />
                  </button>
                </div>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
                  <input 
                    type="text" 
                    placeholder="Buscar subcategoria..." 
                    value={searchSub}
                    onChange={(e) => setSearchSub(e.target.value)}
                    disabled={!selectedCategoryId}
                    className="w-full pl-9 pr-3 py-2 text-[13px] bg-surface-subtle border border-ui-border rounded-lg outline-none focus:border-brand transition-colors disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="overflow-y-auto flex-1 p-2">
                {!selectedCategoryId ? (
                  <p className="text-[13px] text-content-muted text-center mt-10">Selecione uma categoria ao lado.</p>
                ) : displayedSubcategories.length === 0 ? (
                  <p className="text-[13px] text-content-muted text-center mt-10">Nenhuma subcategoria encontrada.</p>
                ) : (
                  displayedSubcategories.map(sub => (
                    <div 
                      key={sub.id}
                      onClick={() => openForm('EDIT_SUB', sub)}
                      className={`group flex justify-between items-center px-3 py-2.5 cursor-pointer rounded-lg mb-1 transition-colors ${
                        formData.id === sub.id && formMode === 'EDIT_SUB'
                          ? 'bg-brand/10 text-brand font-medium'
                          : 'hover:bg-ui-border-soft text-content-secondary'
                      }`}
                    >
                      <span className={`truncate text-[14px] ${!sub.is_active ? 'opacity-60 line-through text-content-muted' : ''}`}>
                        {sub.name}
                      </span>

                      <div className={`flex gap-1 flex-shrink-0 ml-2 ${formData.id === sub.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); openForm('EDIT_SUB', sub); }}
                          className="p-1 hover:bg-brand/20 rounded text-brand"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDelete('SUB', sub.id, sub.name); }}
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

            {/* COLUNA 3: FORMULÁRIO */}
            <div className="flex flex-col h-[550px]">
              {formMode === 'IDLE' ? (
                <div className="flex flex-col items-center justify-center h-full border border-dashed border-ui-border rounded-xl bg-surface-subtle text-content-muted p-6 text-center">
                  <p className="text-[14px]">Selecione uma ação nas listas ao lado para adicionar ou editar.</p>
                </div>
              ) : (
                <div className="flex flex-col border border-brand/30 rounded-xl bg-surface overflow-hidden h-fit shadow-md animate-fade-in">
                  <div className="flex justify-between items-center p-4 border-b border-ui-border bg-surface-subtle">
                    <h3 className="font-bold text-brand text-[15px]">
                      {formMode === 'CREATE_CAT' && 'Nova Categoria'}
                      {formMode === 'EDIT_CAT' && 'Editar Categoria'}
                      {formMode === 'CREATE_SUB' && 'Nova Subcategoria'}
                      {formMode === 'EDIT_SUB' && 'Editar Subcategoria'}
                    </h3>
                    <button onClick={closeForm} className="text-content-muted hover:text-content transition-colors">
                      <X size={18} />
                    </button>
                  </div>
                  
                  <div className="p-5 flex flex-col gap-5">
                    <div className="flex flex-col gap-2">
                      <label className="text-[13px] font-semibold text-content-secondary">
                        Nome da {formMode.includes('CAT') ? 'Categoria' : 'Subcategoria'}
                      </label>
                      <input 
                        type="text"
                        autoFocus
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2.5 text-[14px] border border-ui-border rounded-lg outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-all"
                        placeholder="Ex: Alimentação"
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
        )}
      </div>
    </Section>
  );
}