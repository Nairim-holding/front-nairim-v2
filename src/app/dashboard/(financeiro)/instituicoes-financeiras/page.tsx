/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useMemo } from "react";
import Section from "@/components/Section";
import { Plus, Trash2, Edit2, X, Search, Landmark } from "lucide-react";
import { useMessageContext } from "@/contexts/MessageContext";
import { usePopupContext } from "@/contexts/PopupContext";
import DynamicFormManager from "@/components/DynamicFormManager";
import Toggle from "@/components/Ui/Toggle"; 
import { FormStep } from "@/types/types";

type FormMode = 'IDLE' | 'CREATE' | 'EDIT';

export default function InstituicoesFinanceirasPage() {
  const { showMessage } = useMessageContext();
  const { showPopup } = usePopupContext();

  const [isLoading, setIsLoading] = useState(true);
  const [institutions, setInstitutions] = useState<any[]>([]);
  
  // Controles de Tela
  const [search, setSearch] = useState('');
  const [formMode, setFormMode] = useState<FormMode>('IDLE');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const baseURL = process.env.NEXT_PUBLIC_URL_API;

  const fetchData = async () => {
    try {
      const res = await fetch(`${baseURL}/financial-institution?limit=1000`);
      const data = await res.json();
      setInstitutions(data?.data || data || []);
    } catch (_error) {
      showMessage("Erro ao carregar as instituições financeiras.", "error");
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

  // Filtro e Ordenação
  const displayedInstitutions = institutions
    .filter(i => !i.deleted_at)
    .filter(i => {
      const term = normalizeText(search);
      return normalizeText(i.name).includes(term) || 
             normalizeText(i.bank_number || '').includes(term) ||
             normalizeText(i.agency_number || '').includes(term) ||
             normalizeText(i.account_number || '').includes(term);
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const openForm = (mode: FormMode, id: string | null = null) => {
    setSelectedId(id);
    setFormMode(mode);
  };

  const closeForm = () => {
    setFormMode('IDLE');
    setSelectedId(null);
    fetchData(); 
  };

  const handleDelete = (id: string, name: string) => {
    showPopup(
      `Excluir Instituição`,
      `Tem certeza que deseja excluir "${name}"?`,
      async () => {
        try {
          const res = await fetch(`${baseURL}/financial-institution/${id}`, { method: 'DELETE' });
          if (!res.ok) {
            const result = await res.json().catch(() => ({}));
            throw new Error(result.message || `Erro ao excluir Instituição.`);
          }
          
          showMessage("Excluída com sucesso!", "success");
          if (selectedId === id) closeForm();
          await fetchData();
        } catch (error: any) {
          showMessage(error.message, "error");
        }
      },
      () => {}
    );
  };

  // Tratamento de dados (Garante a leitura de strings ou booleanos falsos)
  const transformDataForLoad = (apiResponse: any) => {
    const data = apiResponse.data || apiResponse;
    if (!data) return {};

    return {
      name: data.name || '',
      bank_number: data.bank_number || '',
      agency_number: data.agency_number || '',
      account_number: data.account_number || '',
      is_active: data.is_active === false || String(data.is_active) === 'false' ? false : true 
    };
  };

  const transformPayloadForSave = (data: any) => {
    // Log para você debugar silenciosamente (se o valor não chegar, já sabemos que o form manager barrou o campo customizado)
    const isActive = data.is_active === false || String(data.is_active) === 'false' ? false : true;
    
    return {
      name: data.name,
      bank_number: data.bank_number || null,
      agency_number: data.agency_number || null,
      account_number: data.account_number || null,
      is_active: isActive
    };
  };

  const steps: FormStep[] = useMemo(() => {
    return [
      {
        title: 'Dados da Instituição',
        icon: <Landmark size={20} />,
        fields: [
          { field: 'name', label: 'Nome da Instituição', type: 'text', required: true, autoFocus: true, className: 'col-span-full' },
          { field: 'bank_number', label: 'Número do Banco', type: 'text', placeholder: 'Ex: 341', required: false },
          { field: 'agency_number', label: 'Agência', type: 'text', placeholder: 'Ex: 1234-X', required: false },
          { field: 'account_number', label: 'Número da Conta', type: 'text', placeholder: 'Ex: 12345-6', required: false },
          { 
            field: 'is_active', 
            label: 'Status', 
            type: 'custom', 
            defaultValue: true, 
            className: 'col-span-full',
            render: (value: any, _: any, onChange: any) => {
              const isChecked = value === false || String(value) === 'false' ? false : true;
              
              return (
                <div className="mt-2">
                  {/* TRUQUE MESTRE: Input escondido força o formulário nativo/react-hook-form a ler o valor */}
                  <input type="hidden" name="is_active" value={String(isChecked)} />
                  <Toggle 
                    checked={isChecked}
                    onChange={(val) => onChange(Boolean(val))}
                    label={isChecked ? 'Ativo' : 'Inativo'}
                  />
                </div>
              );
            } 
          },
        ]
      }
    ];
  }, []);

  return (
    <Section title="Gerenciar Instituições Financeiras">
      <div className="bg-surface p-6 rounded-xl shadow-sm border border-ui-border w-full">
        
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* COLUNA 1: LISTA DE INSTITUIÇÕES */}
            <div className="lg:col-span-1 flex flex-col border border-ui-border rounded-xl bg-surface-subtle overflow-hidden h-[calc(100vh-180px)] min-h-[600px]">
              <div className="bg-surface p-3 border-b border-ui-border">
                <div className="flex justify-between items-center mb-3 px-1">
                  <h3 className="font-bold text-content text-[15px]">Instituições</h3>
                  <button 
                    onClick={() => openForm('CREATE')}
                    className="p-1 hover:bg-brand/10 text-brand rounded-md transition-colors"
                    title="Nova Instituição"
                  >
                    <Plus size={18} />
                  </button>
                </div>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
                  <input 
                    type="text" 
                    placeholder="Buscar por nome ou conta..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-[13px] bg-surface-subtle border border-ui-border rounded-lg outline-none focus:border-brand transition-colors"
                  />
                </div>
              </div>
              
              <div className="overflow-y-auto flex-1 p-2">
                {displayedInstitutions.length === 0 ? (
                  <p className="text-[13px] text-content-muted text-center mt-10">Nenhuma instituição encontrada.</p>
                ) : (
                  displayedInstitutions.map(inst => (
                    <div 
                      key={inst.id}
                      onClick={() => openForm('EDIT', inst.id)}
                      className={`group flex justify-between items-center px-3 py-2.5 cursor-pointer rounded-lg mb-1 transition-colors ${
                        selectedId === inst.id 
                          ? 'bg-brand/10 text-brand border border-brand/20' 
                          : 'hover:bg-ui-border-soft text-content-secondary border border-transparent'
                      }`}
                    >
                      <div className="flex flex-col overflow-hidden w-full">
                        <span className={`truncate text-[14px] font-medium ${inst.is_active === false ? 'opacity-60 line-through text-content-muted' : ''}`}>
                          {inst.name}
                        </span>
                        
                        {(inst.bank_number || inst.agency_number || inst.account_number) && (
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {inst.bank_number && <span className="text-[10px] font-medium bg-surface border border-ui-border px-1.5 py-0.5 rounded text-content-secondary">Bco: {inst.bank_number}</span>}
                            {inst.agency_number && <span className="text-[10px] font-medium bg-surface border border-ui-border px-1.5 py-0.5 rounded text-content-secondary">Ag: {inst.agency_number}</span>}
                            {inst.account_number && <span className="text-[10px] font-medium bg-surface border border-ui-border px-1.5 py-0.5 rounded text-content-secondary">Cc: {inst.account_number}</span>}
                          </div>
                        )}
                      </div>

                      <div className={`flex items-center gap-1 flex-shrink-0 ml-2 ${selectedId === inst.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); openForm('EDIT', inst.id); }}
                          className="p-1 hover:bg-brand/20 rounded text-brand"
                          title="Editar"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDelete(inst.id, inst.name); }}
                          className="p-1 hover:bg-red-100 rounded text-state-error"
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* COLUNAS 2 E 3: FORMULÁRIO GIGANTE */}
            <div className="lg:col-span-2 flex flex-col h-[calc(100vh-180px)] min-h-[600px] overflow-y-auto relative rounded-xl border border-ui-border bg-surface">
              {formMode === 'IDLE' ? (
                <div className="flex flex-col items-center justify-center h-full border border-dashed border-ui-border rounded-xl bg-surface-subtle text-content-muted p-6 text-center m-4">
                  <p className="text-[15px]">Selecione uma instituição na lista ao lado para editar seus detalhes ou clique em <strong>+</strong> para criar uma nova.</p>
                </div>
              ) : (
                <div className="relative p-2">
                  <button 
                    onClick={closeForm} 
                    className="absolute top-6 right-6 z-20 p-1.5 bg-surface-subtle rounded-full text-content-muted hover:text-content hover:bg-ui-border transition-colors shadow-sm"
                    title="Fechar Formulário"
                  >
                    <X size={18} />
                  </button>

                  <div className="pointer-events-auto">
                    <DynamicFormManager
                      key={`${formMode}-${selectedId}`}
                      resource="financial-institution"
                      title="Instituição Financeira"
                      basePath="" 
                      mode={formMode === 'CREATE' ? 'create' : 'edit'}
                      id={selectedId || undefined}
                      steps={steps}
                      transformData={transformDataForLoad}
                      transformResponse={transformPayloadForSave}
                      onSubmitSuccess={() => {
                        showMessage(`Instituição ${formMode === 'CREATE' ? 'criada' : 'atualizada'} com sucesso!`, 'success');
                        closeForm();
                      }}
                    />
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