/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useMemo } from "react";
import Section from "@/components/Section";
import { Plus, Trash2, Edit2, X, Search } from "lucide-react";
import { useMessageContext } from "@/contexts/MessageContext";
import { usePopupContext } from "@/contexts/PopupContext";
import DynamicFormManager from "@/components/DynamicFormManager";
import ContactManager from "@/components/ContactManager";
import { FormStep } from "@/types/types";
import {
  MapPin, Phone, FileText, Hash,
  Building as BuildingIcon, Globe, MapPin as MapPinIcon
} from 'lucide-react';

// VIEW removido!
type FormMode = 'IDLE' | 'CREATE' | 'EDIT';

export default function FornecedoresPage() {
  const { showMessage } = useMessageContext();
  const { showPopup } = usePopupContext();

  const [isLoading, setIsLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  
  // Controles de Tela
  const [search, setSearch] = useState('');
  const [formMode, setFormMode] = useState<FormMode>('IDLE');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Estado para controlar o desbloqueio dos campos de endereço no cadastro/edição
  const [isManualAddress, setIsManualAddress] = useState(false);

  const baseURL = process.env.NEXT_PUBLIC_URL_API;

  const fetchData = async () => {
    try {
      const res = await fetch(`${baseURL}/financial-supplier?limit=1000`);
      const data = await res.json();
      setSuppliers(data?.data || data || []);
    } catch (_error) {
      showMessage("Erro ao carregar os fornecedores.", "error");
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

  const displayedSuppliers = suppliers
    .filter(s => !s.deleted_at)
    .filter(s => {
      const term = normalizeText(search);
      return normalizeText(s.legal_name).includes(term) || 
             normalizeText(s.trade_name || '').includes(term) || 
             normalizeText(s.cnpj || '').includes(term);
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const openForm = (mode: FormMode, id: string | null = null) => {
    setSelectedId(id);
    setFormMode(mode);
    setIsManualAddress(false); // Reseta o status do endereço ao abrir o form
  };

  const closeForm = () => {
    setFormMode('IDLE');
    setSelectedId(null);
    fetchData(); // Recarrega a lista para trazer as atualizações
  };

  const handleDelete = (id: string, name: string) => {
    showPopup(
      `Excluir Fornecedor`,
      `Tem certeza que deseja excluir "${name}"?`,
      async () => {
        try {
          const res = await fetch(`${baseURL}/financial-supplier/${id}`, { method: 'DELETE' });
          if (!res.ok) {
            const result = await res.json().catch(() => ({}));
            throw new Error(result.message || `Erro ao excluir Fornecedor.`);
          }
          
          showMessage("Excluído com sucesso!", "success");
          if (selectedId === id) closeForm();
          await fetchData();
        } catch (error: any) {
          showMessage(error.message, "error");
        }
      },
      () => {}
    );
  };

  // ========================================================
  // LÓGICAS DO FORMULÁRIO (Trazidas das páginas individuais)
  // ========================================================

  const handleFieldChange = async (fieldName: string, value: any) => {
    if (fieldName === 'zip_code' && value) {
      const cleanCEP = value.replace(/\D/g, '');
      
      if (cleanCEP.length === 8) {
        try {
          showMessage('Buscando CEP...', 'info');
          const response = await fetch(`/api/cep/${cleanCEP}`);
          
          if (!response.ok) {
            setIsManualAddress(true);
            showMessage('CEP não encontrado. Os campos de endereço foram liberados para preenchimento manual.', 'error');
            return { street: '', district: '', city: '', state: '' }; 
          }

          const data = await response.json();
          
          if (data.error || data.erro) {
            throw new Error(data.error || 'CEP não encontrado.');
          } else {
            setIsManualAddress(false);
            showMessage('Endereço preenchido automaticamente!', 'success');
            
            return {
              street: data.rua || '',
              complement: data.complemento || '',
              district: data.bairro || '',
              city: data.cidade || '',
              state: data.estado || '',
              country: data.pais || 'Brasil',
            };
          }
        } catch (error: any) {
          showMessage(error.message || 'Erro ao buscar CEP.', 'error');
          setIsManualAddress(true);
          return null;
        }
      }
    }
    return null;
  };

  const transformDataForSubmit = (data: any) => {
    return {
      legal_name: data.legal_name,
      trade_name: data.trade_name || null,
      cnpj: data.cnpj ? data.cnpj.replace(/\D/g, '') : null,
      state_registration: data.state_registration || null,
      municipal_registration: data.municipal_registration || null,
      addresses: [
        {
          zip_code: data.zip_code?.replace(/\D/g, ''),
          street: data.street,
          number: data.number,
          complement: data.complement || null,
          district: data.district,
          city: data.city,
          state: data.state,
          country: data.country || 'Brasil',
        }
      ],
      contacts: data.contacts?.map((c: any) => ({
          contact: c.contact || null,
          phone: c.phone?.replace(/\D/g, '') || null,
          email: c.email || null,
          cellphone: c.cellphone?.replace(/\D/g, '') || null,
      })) || []
    };
  };

  const transformDataForLoad = (apiData: any) => {
    if (!apiData) return {};
    const address = apiData.addresses?.[0]?.address || {};
    
    return {
      legal_name: apiData.legal_name || '',
      trade_name: apiData.trade_name || '',
      cnpj: apiData.cnpj || '',
      municipal_registration: apiData.municipal_registration || '',
      state_registration: apiData.state_registration || '',
      zip_code: address.zip_code || '',
      street: address.street || '',
      number: address.number || '',
      complement: address.complement || '',
      district: address.district || '',
      city: address.city || '',
      state: address.state || '',
      country: address.country || 'Brasil',
      contacts: apiData.contacts?.map((c: any) => ({
        contact: c.contact?.contact || c.contact || '', 
        phone: c.contact?.phone || c.phone || '',
        cellphone: c.contact?.cellphone || c.cellphone || '',
        email: c.contact?.email || c.email || '',
      })) || []
    };
  };

  const steps: FormStep[] = useMemo(() => {
    // isView e formMode === 'VIEW' foram removidos, então adaptamos as validações
    return [
      {
        title: 'Dados do Fornecedor',
        icon: <BuildingIcon size={20} />,
        fields: [
          { field: 'legal_name', label: 'Razão Social', type: 'text', required: true, placeholder: 'Razão Social', autoFocus: true, icon: <BuildingIcon size={20} />, className: 'col-span-full' },
          { field: 'trade_name', label: 'Nome Fantasia', type: 'text', required: false, placeholder: 'Nome Fantasia', icon: <BuildingIcon size={20} />, className: 'col-span-full' },
          { field: 'cnpj', label: 'CNPJ', type: 'text', required: false, placeholder: '00.000.000/0000-00', mask: 'cnpj', icon: <FileText size={20} />, className: 'col-span-full' },
          { field: 'state_registration', label: 'Inscrição Estadual', type: 'text', required: false, placeholder: 'Inscrição Estadual', icon: <Hash size={20} /> },
          { field: 'municipal_registration', label: 'Inscrição Municipal', type: 'text', required: false, placeholder: 'Inscrição Municipal', icon: <Hash size={20} /> },
        ],
      },
      {
        title: 'Endereço',
        icon: <MapPin size={20} />,
        fields: [
          { field: 'zip_code', label: 'CEP', type: 'text', required: true, placeholder: '00000-000', mask: 'cep', icon: <MapPinIcon size={20} />, className: 'col-span-full' },
          { field: 'street', label: 'Rua', type: 'text', required: true, placeholder: 'Rua das Flores', readOnly: !isManualAddress, disabled: !isManualAddress, icon: <MapPinIcon size={20} />, className: 'col-span-full' },
          { field: 'number', label: 'Número', type: 'text', required: true, placeholder: '123', icon: <Hash size={20} /> },
          { field: 'complement', label: 'Complemento', type: 'text', required: false, placeholder: 'Sala 1', icon: <MapPinIcon size={20} /> },
          { field: 'district', label: 'Bairro', type: 'text', required: true, placeholder: 'Centro', readOnly: !isManualAddress, disabled: !isManualAddress, icon: <MapPinIcon size={20} /> },
          { field: 'city', label: 'Cidade', type: 'text', required: true, placeholder: 'São Paulo', readOnly: !isManualAddress, disabled: !isManualAddress, icon: <MapPinIcon size={20} /> },
          { field: 'state', label: 'Estado', type: 'text', required: true, placeholder: 'SP', readOnly: !isManualAddress, disabled: !isManualAddress, icon: <Globe size={20} /> },
          { field: 'country', label: 'País', type: 'text', required: true, placeholder: 'Brasil', defaultValue: 'Brasil', readOnly: !isManualAddress, disabled: !isManualAddress, icon: <Globe size={20} /> }
        ],
      },
      {
        title: 'Contatos',
        icon: <Phone size={20} />,
        fields: [
          {
            field: 'contacts',
            label: 'Lista de Contatos',
            type: 'custom',
            defaultValue: [],
            className: 'col-span-full',
            render: (value: any, _: any, onChange: any) => (
              <ContactManager value={value} onChange={onChange} resourceType="financial-supplier" />
            )
          }
        ],
      },
    ];
  }, [isManualAddress]);

  return (
    <Section title="Gerenciar Fornecedores">
      <div className="bg-surface p-6 rounded-xl shadow-sm border border-ui-border w-full">
        
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* COLUNA 1: LISTA DE FORNECEDORES */}
            <div className="lg:col-span-1 flex flex-col border border-ui-border rounded-xl bg-surface-subtle overflow-hidden h-[calc(100vh-180px)] min-h-[600px]">
              <div className="bg-surface p-3 border-b border-ui-border">
                <div className="flex justify-between items-center mb-3 px-1">
                  <h3 className="font-bold text-content text-[15px]">Fornecedores</h3>
                  <button 
                    onClick={() => openForm('CREATE')}
                    className="p-1 hover:bg-brand/10 text-brand rounded-md transition-colors"
                    title="Novo Fornecedor"
                  >
                    <Plus size={18} />
                  </button>
                </div>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
                  <input 
                    type="text" 
                    placeholder="Buscar por nome ou CNPJ..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-[13px] bg-surface-subtle border border-ui-border rounded-lg outline-none focus:border-brand transition-colors"
                  />
                </div>
              </div>
              
              <div className="overflow-y-auto flex-1 p-2">
                {displayedSuppliers.length === 0 ? (
                  <p className="text-[13px] text-content-muted text-center mt-10">Nenhum fornecedor encontrado.</p>
                ) : (
                  displayedSuppliers.map(supplier => (
                    <div 
                      key={supplier.id}
                      onClick={() => openForm('EDIT', supplier.id)}
                      className={`group flex justify-between items-center px-3 py-2.5 cursor-pointer rounded-lg mb-1 transition-colors ${
                        selectedId === supplier.id 
                          ? 'bg-brand/10 text-brand border border-brand/20' 
                          : 'hover:bg-ui-border-soft text-content-secondary border border-transparent'
                      }`}
                    >
                      <div className="flex flex-col overflow-hidden">
                        <span className="truncate text-[14px] font-medium">
                          {supplier.trade_name || supplier.legal_name}
                        </span>
                        <span className="text-[11px] text-content-muted truncate mt-0.5">
                          {supplier.cnpj ? `CNPJ: ${supplier.cnpj}` : 'Sem CNPJ'}
                        </span>
                      </div>

                      {/* CORREÇÃO AQUI: flex-row em vez de flex-col + Remoção do View */}
                      <div className={`flex items-center gap-1 flex-shrink-0 ml-2 ${selectedId === supplier.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); openForm('EDIT', supplier.id); }}
                          className="p-1 hover:bg-brand/20 rounded text-brand"
                          title="Editar"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDelete(supplier.id, supplier.trade_name || supplier.legal_name); }}
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
                  <p className="text-[15px]">Selecione um fornecedor na lista ao lado para editar seus detalhes ou clique em <strong>+</strong> para cadastrar um novo.</p>
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
                      resource="financial-supplier"
                      title="Fornecedor"
                      basePath="" 
                      mode={formMode === 'CREATE' ? 'create' : 'edit'}
                      id={selectedId || undefined}
                      steps={steps}
                      onFieldChange={handleFieldChange}
                      transformData={transformDataForLoad}
                      transformResponse={transformDataForSubmit}
                      onSubmitSuccess={() => {
                        showMessage(`Fornecedor ${formMode === 'CREATE' ? 'criado' : 'atualizado'} com sucesso!`, 'success');
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