/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useMemo } from "react";
import Section from "@/components/layout/PageSection";
import { Plus, Trash2, Edit2, X, Search } from "lucide-react";
import { useMessageContext } from "@/contexts/MessageContext";
import { usePopupContext } from "@/contexts/PopupContext";
import DynamicFormManager from "@/components/form/DynamicForm";
import ContactManager from "@/components/domain/contacts/ContactManager";
import ModalSelectTypeOwner from "@/components/modals/OwnerTypeModal";
import { FormStep } from "@/types/types";
import { OwnerType } from "@/types/owner";
import {
  MapPin, Phone, FileText, Hash,
  Building as BuildingIcon, Globe, MapPin as MapPinIcon, User
} from 'lucide-react';

type FormMode = 'IDLE' | 'CREATE' | 'EDIT';

export default function FornecedoresPage() {
  const { showMessage } = useMessageContext();
  const { showPopup } = usePopupContext();

  const [isLoading, setIsLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  
  const [search, setSearch] = useState('');
  const [formMode, setFormMode] = useState<FormMode>('IDLE');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [personType, setPersonType] = useState<OwnerType>('juridica');

  const [isManualAddress, setIsManualAddress] = useState(false);
  
  // Estado para armazenar o código interno gerado automaticamente
  const [generatedInternalCode, setGeneratedInternalCode] = useState<string>('');

  const baseURL = process.env.NEXT_PUBLIC_URL_API;

  const fetchData = async () => {
    try {
      const res = await fetch(`${baseURL}/financial-supplier?limit=1000`);
      const data = await res.json();
      setSuppliers(data?.data || data || []);
    } catch {
      showMessage("Erro ao carregar os contatos.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Buscar último fornecedor para gerar código interno automaticamente (último código global + 1)
  useEffect(() => {
    const fetchLastSupplier = async () => {
      try {
        // Buscar todos os fornecedores ordenados por código interno descendente
        const response = await fetch(`${baseURL}/financial-supplier?sort=internal_code&order=desc&limit=1`);
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.data && data.data.length > 0) {
            const lastCode = data.data[0].internal_code;
            const codeNumber = parseInt(lastCode, 10);
            
            if (!isNaN(codeNumber)) {
              setGeneratedInternalCode(String(codeNumber + 1));
            } else {
              setGeneratedInternalCode(lastCode);
            }
          } else {
            setGeneratedInternalCode('1');
          }
        }
      } catch {
        // Silenciar erro - código interno pode ser preenchido manualmente
        setGeneratedInternalCode('');
      }
    };

    if (formMode === 'CREATE') {
      fetchLastSupplier();
    }
  }, [formMode, baseURL]);

  const normalizeText = (text: string) => 
    text ? text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : '';

  const displayedSuppliers = suppliers
    .filter(s => !s.deleted_at)
    .filter(s => {
      const term = normalizeText(search);
      return normalizeText(s.legal_name).includes(term) || 
             normalizeText(s.trade_name || '').includes(term) || 
             normalizeText(s.cnpj || '').includes(term) ||
             normalizeText(s.cpf || '').includes(term);
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const getPersonType = (supplier: any): OwnerType => {
    // Prioriza PJ se tiver qualquer campo típico de PJ (CNPJ, Nome Fantasia, Inscrições)
    if (supplier.cnpj || supplier.trade_name || supplier.state_registration || supplier.municipal_registration) return 'juridica';
    // Só é PF se tiver CPF ou campos típicos de PF
    if (supplier.cpf || supplier.occupation || supplier.marital_status) return 'fisica';
    // Default é PJ para novos cadastros sem documento
    return 'juridica';
  };

  // Toggle PJ/PF sempre habilitado tanto em CREATE quanto em EDIT — a troca
  // remonta os steps com os campos do tipo escolhido (CPF/Nome para PF, CNPJ/Razão Social para PJ).
  // Campos incompatíveis são descartados pelo transformDataForSubmit (ele zera os
  // que não pertencem ao tipo atual antes de enviar ao backend).

  const openForm = (mode: FormMode, id: string | null = null, type: OwnerType = 'juridica') => {
    setSelectedId(id);
    setFormMode(mode);
    setPersonType(type);
    setIsManualAddress(false);
  };

  const closeForm = () => {
    setFormMode('IDLE');
    setSelectedId(null);
    fetchData(); 
  };

  const handleDelete = (id: string, name: string) => {
    showPopup(
      `Excluir Contato`,
      `Tem certeza que deseja excluir "${name}"?`,
      async () => {
        try {
          const res = await fetch(`${baseURL}/financial-supplier/${id}`, { method: 'DELETE' });
          if (!res.ok) {
            const result = await res.json().catch(() => ({}));
            throw new Error(result.message || `Erro ao excluir Contato.`);
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
            return null; // Não sobrescreve os campos, apenas libera para edição 
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
      trade_name: personType === 'juridica' ? (data.trade_name || null) : null,
      cnpj: personType === 'juridica' && data.cnpj ? data.cnpj.replace(/\D/g, '') : null,
      
      cpf: personType === 'fisica' && data.cpf ? data.cpf.replace(/\D/g, '') : null,
      internal_code: data.internal_code || null,
      occupation: personType === 'fisica' ? (data.occupation || null) : null,
      marital_status: personType === 'fisica' ? (data.marital_status || null) : null,
      
      state_registration: personType === 'juridica' ? (data.state_registration || null) : null,
      municipal_registration: personType === 'juridica' ? (data.municipal_registration || null) : null,
      
      addresses: data.zip_code || data.street ? [
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
      ] : [],
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
      
      cpf: apiData.cpf || '',
      internal_code: apiData.internal_code || '',
      occupation: apiData.occupation || '',
      marital_status: apiData.marital_status || '',
      
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
    const isPF = personType === 'fisica';

    const maritalStatusOptions = [
      { value: 'Solteiro(a)', label: 'Solteiro(a)' },
      { value: 'Casado(a)', label: 'Casado(a)' },
      { value: 'Divorciado(a)', label: 'Divorciado(a)' },
      { value: 'Viúvo(a)', label: 'Viúvo(a)' },
      { value: 'União Estável', label: 'União Estável' }
    ];

    const identificationFields: any[] = isPF 
      ? [
          { field: 'legal_name', label: 'Nome Completo', type: 'text', required: true, placeholder: 'Nome Completo', autoFocus: true, icon: <User size={20} />, className: 'col-span-full' },
          { field: 'trade_name', label: 'Nome Fantasia', type: 'text', required: false, placeholder: 'Nome Fantasia', icon: <BuildingIcon size={20} />, className: 'col-span-full' },
          { field: 'internal_code', label: 'Código Interno', type: 'text', required: false, placeholder: 'Código interno', icon: <Hash size={20} />, defaultValue: generatedInternalCode },
          { field: 'occupation', label: 'Profissão', type: 'text', required: false, placeholder: 'Profissão', icon: <User size={20} /> },
          { field: 'marital_status', label: 'Estado Civil', type: 'select', required: false, placeholder: 'Selecione...', options: maritalStatusOptions, icon: <User size={20} /> },
          { field: 'cpf', label: 'CPF', type: 'text', required: false, placeholder: '000.000.000-00', mask: 'cpf', icon: <FileText size={20} /> },
        ]
      : [
          { field: 'legal_name', label: 'Razão Social', type: 'text', required: true, placeholder: 'Razão Social', autoFocus: true, icon: <BuildingIcon size={20} />, className: 'col-span-full' },
          { field: 'trade_name', label: 'Nome Fantasia', type: 'text', required: false, placeholder: 'Nome Fantasia', icon: <BuildingIcon size={20} />, className: 'col-span-full' },
          { field: 'cnpj', label: 'CNPJ', type: 'text', required: false, placeholder: '00.000.000/0000-00', mask: 'cnpj', icon: <FileText size={20} />, className: 'col-span-full' },
          { field: 'internal_code', label: 'Código Interno', type: 'text', required: false, placeholder: 'Código interno', icon: <Hash size={20} />, defaultValue: generatedInternalCode },
          { field: 'state_registration', label: 'Inscrição Estadual', type: 'text', required: false, placeholder: 'Inscrição Estadual', icon: <Hash size={20} /> },
          { field: 'municipal_registration', label: 'Inscrição Municipal', type: 'text', required: false, placeholder: 'Inscrição Municipal', icon: <Hash size={20} /> },
        ];

    return [
      {
        title: 'Dados do Contato',
        icon: isPF ? <User size={20} /> : <BuildingIcon size={20} />,
        fields: identificationFields,
      },
      {
        title: 'Endereço',
        icon: <MapPin size={20} />,
        fields: [
          { field: 'zip_code', label: 'CEP', type: 'text', required: false, placeholder: '00000-000', mask: 'cep', icon: <MapPinIcon size={20} />, className: 'col-span-full' },
          { field: 'street', label: 'Rua', type: 'text', required: false, placeholder: 'Rua das Flores', readOnly: !isManualAddress, disabled: !isManualAddress, icon: <MapPinIcon size={20} />, className: 'col-span-full' },
          { field: 'number', label: 'Número', type: 'text', required: false, placeholder: '123', icon: <Hash size={20} /> },
          { field: 'complement', label: 'Complemento', type: 'text', required: false, placeholder: 'Sala 1', icon: <MapPinIcon size={20} /> },
          { field: 'district', label: 'Bairro', type: 'text', required: false, placeholder: 'Centro', readOnly: !isManualAddress, disabled: !isManualAddress, icon: <MapPinIcon size={20} /> },
          { field: 'city', label: 'Cidade', type: 'text', required: false, placeholder: 'São Paulo', readOnly: !isManualAddress, disabled: !isManualAddress, icon: <MapPinIcon size={20} /> },
          { field: 'state', label: 'Estado', type: 'text', required: false, placeholder: 'SP', readOnly: !isManualAddress, disabled: !isManualAddress, icon: <Globe size={20} /> },
          { field: 'country', label: 'País', type: 'text', required: false, placeholder: 'Brasil', defaultValue: 'Brasil', readOnly: !isManualAddress, disabled: !isManualAddress, icon: <Globe size={20} /> }
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
  }, [isManualAddress, personType, generatedInternalCode]);

  return (
    <Section title="Gerenciar Contatos">
      <div className="bg-surface p-6 rounded-xl shadow-sm border border-ui-border w-full">
        
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <div className="lg:col-span-1 flex flex-col border border-ui-border rounded-xl bg-surface-subtle overflow-hidden h-[calc(100vh-180px)] min-h-[600px]">
              <div className="bg-surface p-3 border-b border-ui-border">
                <div className="flex justify-between items-center mb-3 px-1">
                  <h3 className="font-bold text-content text-[15px]">Contatos</h3>
                  <div className="relative">
                    <button 
                      onClick={() => setShowTypeModal(true)}
                      className="p-1 hover:bg-brand/10 text-brand rounded-md transition-colors"
                      title="Novo Contato"
                    >
                      <Plus size={18} />
                    </button>
                    {showTypeModal && (
                      <ModalSelectTypeOwner
                        onSelect={(type) => {
                          setShowTypeModal(false);
                          openForm('CREATE', null, type);
                        }}
                        onClose={() => setShowTypeModal(false)}
                        className="right-0 top-full"
                      />
                    )}
                  </div>
                </div>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
                  <input 
                    type="text" 
                    placeholder="Buscar por nome, CPF ou CNPJ..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-[13px] bg-surface-subtle border border-ui-border rounded-lg outline-none focus:border-brand transition-colors"
                  />
                </div>
              </div>
              
              <div className="overflow-y-auto flex-1 p-2">
                {displayedSuppliers.length === 0 ? (
                  <p className="text-[13px] text-content-muted text-center mt-10">Nenhum contato encontrado.</p>
                ) : (
                  displayedSuppliers.map(supplier => (
                    <div 
                      key={supplier.id}
                      onClick={() => openForm('EDIT', supplier.id, getPersonType(supplier))}
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
                          {supplier.internal_code ? `Cód: ${supplier.internal_code} | ` : ''}
                          {supplier.cnpj 
                            ? `CNPJ: ${supplier.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}` 
                            : supplier.cpf 
                              ? `CPF: ${supplier.cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}` 
                              : 'Sem Documento'}
                        </span>
                      </div>

                      <div className={`flex items-center gap-1 flex-shrink-0 ml-2 ${selectedId === supplier.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); openForm('EDIT', supplier.id, getPersonType(supplier)); }}
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

            <div className="lg:col-span-2 flex flex-col h-[calc(100vh-180px)] min-h-[600px] overflow-y-auto relative rounded-xl border border-ui-border bg-surface">
              {formMode === 'IDLE' ? (
                <div className="flex flex-col items-center justify-center h-full border border-dashed border-ui-border rounded-xl bg-surface-subtle text-content-muted p-6 text-center m-4">
                  <p className="text-[15px]">Selecione um contato na lista ao lado para editar seus detalhes ou clique em <strong>+</strong> para cadastrar um novo.</p>
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
                    <div className="px-4 pt-2 pb-1 flex items-center gap-2 text-[12px] text-content-secondary">
                      <span className="font-medium">Tipo de contato:</span>
                      <div className="inline-flex border border-ui-border rounded-md overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setPersonType('juridica')}
                          className={`px-3 py-1 text-[12px] transition-colors ${personType === 'juridica' ? 'bg-brand text-white' : 'bg-surface hover:bg-surface-subtle text-content'}`}
                        >
                          Pessoa Jurídica
                        </button>
                        <button
                          type="button"
                          onClick={() => setPersonType('fisica')}
                          className={`px-3 py-1 text-[12px] transition-colors border-l border-ui-border ${personType === 'fisica' ? 'bg-brand text-white' : 'bg-surface hover:bg-surface-subtle text-content'}`}
                        >
                          Pessoa Física
                        </button>
                      </div>
                    </div>
                    <DynamicFormManager
                      key={`${formMode}-${selectedId}-${personType}`}
                      resource="financial-supplier"
                      title="Contato"
                      basePath=""
                      mode={formMode === 'CREATE' ? 'create' : 'edit'}
                      id={selectedId || undefined}
                      // Persistência local apenas no cadastro novo. A chave inclui o tipo
                      // para que PJ e PF tenham rascunhos independentes.
                      draftKey={formMode === 'CREATE' ? `form:financial-supplier:create:${personType}` : undefined}
                      steps={steps}
                      onFieldChange={handleFieldChange}
                      transformData={transformDataForLoad}
                      transformResponse={transformDataForSubmit}
                      onSubmitSuccess={() => {
                        showMessage(`Contato ${formMode === 'CREATE' ? 'criado' : 'atualizado'} com sucesso!`, 'success');
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