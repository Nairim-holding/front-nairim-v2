'use client';

import { useState } from 'react';
import { useMessageContext } from '@/contexts/MessageContext';
import Select from '@/components/ui/Select';
import { Plus, Trash2, User, MapPin, Phone, Mail, X, Edit2, Heart, Globe, FileText, Briefcase } from 'lucide-react';

interface Address {
  zip_code?: string;
  street?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
  country?: string;
}

interface Contact {
  contact?: string;
  phone?: string;
  cellphone?: string;
  email?: string;
}

interface Guarantor {
  id?: string;
  name?: string;
  nationality?: string;
  occupation?: string;
  marital_status?: string;
  cpf?: string;
  rg?: string;
  address?: Address;
  contacts?: Contact[];
}

interface GuarantorManagerProps {
  value?: Guarantor[];
  onChange?: (guarantors: Guarantor[]) => void;
  readOnly?: boolean;
}

const MARITAL_STATUS_OPTIONS = [
  { value: 'Solteiro(a)', label: 'Solteiro(a)' },
  { value: 'Casado(a)', label: 'Casado(a)' },
  { value: 'Separado(a) judicialmente', label: 'Separado(a) judicialmente' },
  { value: 'Divorciado(a)', label: 'Divorciado(a)' },
  { value: 'Viúvo(a)', label: 'Viúvo(a)' }
];

// Mask functions for display purposes only
const maskCPF = (value: string) => {
  if (!value) return "";
  value = value.replace(/\D/g, "");
  value = value.replace(/(\d{3})(\d)/, "$1.$2");
  value = value.replace(/(\d{3})(\d)/, "$1.$2");
  value = value.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  return value.slice(0, 14);
};

const maskRG = (value: string) => {
  if (!value) return "";
  value = value.replace(/\D/g, "");
  value = value.replace(/(\d{2})(\d)/, "$1.$2");
  value = value.replace(/(\d{3})(\d)/, "$1.$2");
  value = value.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  return value.slice(0, 12);
};

const maskCEP = (value: string) => {
  if (!value) return "";
  value = value.replace(/\D/g, "");
  value = value.replace(/(\d{5})(\d)/, "$1-$2");
  return value.slice(0, 9);
};

const maskPhone = (value: string) => {
  if (!value) return "";
  value = value.replace(/\D/g, "");
  value = value.replace(/^(\d{2})(\d)/g, "($1) $2");
  value = value.replace(/(\d)(\d{4})$/, "$1-$2");
  return value.slice(0, 15);
};


export default function GuarantorManager({ value = [], onChange, readOnly = false }: GuarantorManagerProps) {
  const { showMessage } = useMessageContext();
  const [guarantors, setGuarantors] = useState<Guarantor[]>(value);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isManualAddress, setIsManualAddress] = useState(false);

  const [tempGuarantor, setTempGuarantor] = useState<Guarantor>({
    name: '',
    nationality: 'Brasileira',
    occupation: '',
    marital_status: '',
    cpf: '',
    rg: '',
    address: {
      zip_code: '',
      street: '',
      number: '',
      complement: '',
      district: '',
      city: '',
      state: '',
      country: 'Brasil',
    },
    contacts: [],
  });

  const openModal = (mode: 'add' | 'edit', index?: number) => {
    if (readOnly) return;
    
    setIsManualAddress(false);
    
    if (mode === 'edit' && index !== undefined) {
      setEditingIndex(index);
      setTempGuarantor({ ...guarantors[index] });
    } else {
      setEditingIndex(null);
      setTempGuarantor({
        name: '',
        nationality: 'Brasileira',
        occupation: '',
        marital_status: '',
        cpf: '',
        rg: '',
        address: {
          zip_code: '',
          street: '',
          number: '',
          complement: '',
          district: '',
          city: '',
          state: '',
          country: 'Brasil',
        },
        contacts: [],
      });
    }
    setIsModalOpen(true);
  };

  const handleFieldChange = async (fieldName: string, value: string) => {
    if (fieldName === 'address.zip_code' && value) {
      const cleanCEP = value.replace(/\D/g, '');
      
      if (cleanCEP.length === 8) {
        try {
          showMessage('Buscando CEP...', 'info');
          const response = await fetch(`/api/cep/${cleanCEP}`);
          
          if (!response.ok) {
            if (response.status === 404) {
              setIsManualAddress(true);
              showMessage('CEP não encontrado. Os campos de endereço foram liberados para preenchimento manual.', 'error');
              return null;
            }
            
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || errorData.message || 'Não foi possível buscar o CEP no momento.');
          }

          const data = await response.json();
          
          if (data.error || data.erro) {
            throw new Error(data.error || 'CEP não encontrado.');
          } else {
            setIsManualAddress(false);
            showMessage('Endereço preenchido automaticamente!', 'success');
            
            return {
              address: {
                ...tempGuarantor.address,
                street: data.rua || '',
                complement: data.complemento || '',
                district: data.bairro || '',
                city: data.cidade || '',
                state: data.estado || '',
                country: data.pais || 'Brasil',
              }
            };
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Erro ao buscar CEP.';
          showMessage(errorMessage, 'error');
          setIsManualAddress(true);
          return null;
        }
      }
    }
    return null;
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingIndex(null);
  };

  const handleSaveGuarantor = () => {
    if (!tempGuarantor.name) return;

    const newGuarantors = [...guarantors];

    if (editingIndex !== null) {
      newGuarantors[editingIndex] = tempGuarantor;
    } else {
      newGuarantors.push(tempGuarantor);
    }

    setGuarantors(newGuarantors);
    if (onChange) onChange(newGuarantors);
    closeModal();
  };

  const handleRemoveGuarantor = (index: number) => {
    if (readOnly) return;
    const newGuarantors = guarantors.filter((_: Guarantor, i: number) => i !== index);
    setGuarantors(newGuarantors);
    if (onChange) onChange(newGuarantors);
  };

  const addContact = () => {
    const newContacts = [...(tempGuarantor.contacts || []), { contact: '', phone: '', cellphone: '', email: '' }];
    setTempGuarantor({ ...tempGuarantor, contacts: newContacts });
  };

  const updateContact = (contactIndex: number, field: string, value: string) => {
    const newContacts = [...(tempGuarantor.contacts || [])];
    newContacts[contactIndex] = { ...newContacts[contactIndex], [field]: value };
    setTempGuarantor({ ...tempGuarantor, contacts: newContacts });
  };

  const removeContact = (contactIndex: number) => {
    const newContacts = tempGuarantor.contacts?.filter((_, i) => i !== contactIndex) || [];
    setTempGuarantor({ ...tempGuarantor, contacts: newContacts });
  };

  return (
    <div className="w-full space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {guarantors.map((g: Guarantor, idx: number) => (
          <div 
            key={idx} 
            className={`relative rounded-xl p-4 shadow-sm transition-all border ${
              readOnly 
                ? 'bg-surface-muted border-ui-border' 
                : 'bg-surface border-ui-border-soft hover:shadow-md'
            }`}
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2">
                <div className="bg-brand/10 p-2 rounded-full">
                  <User size={18} className="text-brand" />
                </div>
                <div>
                  <p className="font-semibold text-content">{g.name || 'Sem nome'}</p>
                  <p className="text-xs text-content-muted">{g.occupation || 'Profissão não informada'}</p>
                </div>
              </div>
              
              {!readOnly && (
                <div className="flex items-center gap-1">
                  <button 
                    type="button"
                    onClick={() => openModal('edit', idx)}
                    className="text-content-placeholder hover:text-brand-hover transition-colors p-1.5 rounded-full hover:bg-brand/10"
                    title="Editar"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleRemoveGuarantor(idx)}
                    className="text-content-placeholder hover:text-state-error transition-colors p-1.5 rounded-full hover:bg-state-error/10"
                    title="Remover"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-content-muted">
              {g.cpf && (
                <div className="flex items-center gap-1">
                  <FileText size={12} />
                  <span>CPF: {maskCPF(g.cpf)}</span>
                </div>
              )}
              {g.rg && (
                <div className="flex items-center gap-1">
                  <FileText size={12} />
                  <span>RG: {g.rg}</span>
                </div>
              )}
              {g.marital_status && (
                <div className="flex items-center gap-1">
                  <Heart size={12} />
                  <span>{g.marital_status}</span>
                </div>
              )}
              {g.nationality && (
                <div className="flex items-center gap-1">
                  <Globe size={12} />
                  <span>{g.nationality}</span>
                </div>
              )}
            </div>

            {g.address?.street && (
              <div className="mt-2 text-xs text-content-muted flex items-start gap-1">
                <MapPin size={12} className="shrink-0 mt-0.5" />
                <span>
                  {g.address.street}, {g.address.number}
                  {g.address.complement && ` - ${g.address.complement}`}
                  {g.address.district && ` - ${g.address.district}`}
                  {g.address.city && ` - ${g.address.city}/${g.address.state}`}
                  {g.address.zip_code && ` - CEP: ${maskCEP(g.address.zip_code)}`}
                </span>
              </div>
            )}

            {g.contacts && g.contacts.length > 0 && (
              <div className="mt-2 space-y-1">
                {g.contacts.map((contact: Contact, cIdx: number) => (
                  <div key={cIdx} className="text-xs text-content-muted flex items-center gap-1">
                    {contact.cellphone || contact.phone ? (
                      <>
                        <Phone size={12} />
                        <span>{contact.cellphone ? maskPhone(contact.cellphone) : maskPhone(contact.phone || '')}</span>
                      </>
                    ) : null}
                    {contact.email && (
                      <>
                        <Mail size={12} />
                        <span>{contact.email}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {!readOnly && (
          <button
            type="button"
            onClick={() => openModal('add')}
            className="flex items-center justify-center gap-3 border-2 border-dashed border-ui-border rounded-xl p-4 text-content-muted hover:border-brand hover:text-brand-hover hover:bg-brand/10 transition-all"
          >
            <div className="bg-surface-subtle p-2 rounded-full">
              <Plus size={20} />
            </div>
            <span className="font-medium">Adicionar Fiador</span>
          </button>
        )}
      </div>

      {isModalOpen && !readOnly && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-ui-border-soft bg-surface-subtle/50">
              <h3 className="text-lg font-semibold text-content flex items-center gap-2">
                {editingIndex !== null ? (
                  <>
                    <Edit2 size={20} className="text-brand" />
                    Editar Fiador
                  </>
                ) : (
                  <>
                    <Plus size={20} className="text-brand" />
                    Adicionar Fiador
                  </>
                )}
              </h3>
              <button 
                type="button" 
                onClick={closeModal} 
                className="p-2 text-content-placeholder hover:text-content-muted hover:bg-surface-subtle rounded-full"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Dados Pessoais */}
              <div>
                <h4 className="text-sm font-semibold text-content-secondary mb-3 flex items-center gap-2">
                  <User size={16} />
                  Dados Pessoais
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-content-secondary mb-1 flex items-center gap-2">
                      <User size={16} />
                      Nome Completo *
                    </label>
                    <input
                      type="text"
                      value={tempGuarantor.name || ''}
                      onChange={(e) => setTempGuarantor({...tempGuarantor, name: e.target.value})}
                      className="w-full p-2.5 border border-ui-border rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent outline-none"
                      placeholder="Nome completo do fiador"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-content-secondary mb-1 flex items-center gap-2">
                      <Globe size={16} />
                      Nacionalidade
                    </label>
                    <input
                      type="text"
                      value={tempGuarantor.nationality || ''}
                      onChange={(e) => setTempGuarantor({...tempGuarantor, nationality: e.target.value})}
                      className="w-full p-2.5 border border-ui-border rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent outline-none"
                      placeholder="Brasileira"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-content-secondary mb-1 flex items-center gap-2">
                      <Briefcase size={16} />
                      Profissão
                    </label>
                    <input
                      type="text"
                      value={tempGuarantor.occupation || ''}
                      onChange={(e) => setTempGuarantor({...tempGuarantor, occupation: e.target.value})}
                      className="w-full p-2.5 border border-ui-border rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent outline-none"
                      placeholder="Profissão"
                    />
                  </div>
                  <div>
                    <Select
                      label="Estado Civil"
                      options={MARITAL_STATUS_OPTIONS}
                      value={tempGuarantor.marital_status || ''}
                      onChange={(value) => setTempGuarantor({...tempGuarantor, marital_status: value as string})}
                      svg={<Heart size={20} />}
                      placeholder="Selecione"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-content-secondary mb-1 flex items-center gap-2">
                      <FileText size={16} />
                      CPF
                    </label>
                    <input
                      type="text"
                      value={maskCPF(tempGuarantor.cpf || '')}
                      onChange={(e) => setTempGuarantor({...tempGuarantor, cpf: e.target.value.replace(/\D/g, '')})}
                      className="w-full p-2.5 border border-ui-border rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent outline-none"
                      placeholder="000.000.000-00"
                      maxLength={14}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-content-secondary mb-1 flex items-center gap-2">
                      <FileText size={16} />
                      RG
                    </label>
                    <input
                      type="text"
                      value={maskRG(tempGuarantor.rg || '')}
                      onChange={(e) => setTempGuarantor({...tempGuarantor, rg: e.target.value.replace(/\D/g, '')})}
                      className="w-full p-2.5 border border-ui-border rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent outline-none"
                      placeholder="00.000.000-0"
                      maxLength={12}
                    />
                  </div>
                </div>
              </div>

              {/* Endereço */}
              <div>
                <h4 className="text-sm font-semibold text-content-secondary mb-3 flex items-center gap-2">
                  <MapPin size={16} />
                  Endereço
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-content-secondary mb-1">CEP</label>
                    <input
                      type="text"
                      value={maskCEP(tempGuarantor.address?.zip_code || '')}
                      onChange={async (e) => {
                        const newValue = e.target.value;
                        setTempGuarantor({...tempGuarantor, address: {...tempGuarantor.address, zip_code: newValue.replace(/\D/g, '')}});
                        const cepResult = await handleFieldChange('address.zip_code', newValue);
                        if (cepResult) {
                          setTempGuarantor(prev => ({ ...prev, ...cepResult }));
                        }
                      }}
                      className="w-full p-2.5 border border-ui-border rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent outline-none"
                      placeholder="00000-000"
                      maxLength={9}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-content-secondary mb-1">Rua</label>
                    <input
                      type="text"
                      value={tempGuarantor.address?.street || ''}
                      onChange={(e) => setTempGuarantor({...tempGuarantor, address: {...tempGuarantor.address, street: e.target.value}})}
                      className="w-full p-2.5 border border-ui-border rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent outline-none"
                      placeholder="Rua das Flores"
                      disabled={!isManualAddress}
                      readOnly={!isManualAddress}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-content-secondary mb-1">Número</label>
                    <input
                      type="text"
                      value={tempGuarantor.address?.number || ''}
                      onChange={(e) => setTempGuarantor({...tempGuarantor, address: {...tempGuarantor.address, number: e.target.value}})}
                      className="w-full p-2.5 border border-ui-border rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent outline-none"
                      placeholder="123"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-content-secondary mb-1">Complemento</label>
                    <input
                      type="text"
                      value={tempGuarantor.address?.complement || ''}
                      onChange={(e) => setTempGuarantor({...tempGuarantor, address: {...tempGuarantor.address, complement: e.target.value}})}
                      className="w-full p-2.5 border border-ui-border rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent outline-none"
                      placeholder="Apto 123"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-content-secondary mb-1">Bairro</label>
                    <input
                      type="text"
                      value={tempGuarantor.address?.district || ''}
                      onChange={(e) => setTempGuarantor({...tempGuarantor, address: {...tempGuarantor.address, district: e.target.value}})}
                      className="w-full p-2.5 border border-ui-border rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent outline-none"
                      placeholder="Centro"
                      disabled={!isManualAddress}
                      readOnly={!isManualAddress}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-content-secondary mb-1">Cidade</label>
                    <input
                      type="text"
                      value={tempGuarantor.address?.city || ''}
                      onChange={(e) => setTempGuarantor({...tempGuarantor, address: {...tempGuarantor.address, city: e.target.value}})}
                      className="w-full p-2.5 border border-ui-border rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent outline-none"
                      placeholder="São Paulo"
                      disabled={!isManualAddress}
                      readOnly={!isManualAddress}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-content-secondary mb-1">Estado</label>
                    <input
                      type="text"
                      value={tempGuarantor.address?.state || ''}
                      onChange={(e) => setTempGuarantor({...tempGuarantor, address: {...tempGuarantor.address, state: e.target.value}})}
                      className="w-full p-2.5 border border-ui-border rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent outline-none"
                      placeholder="SP"
                      disabled={!isManualAddress}
                      readOnly={!isManualAddress}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-content-secondary mb-1">País</label>
                    <input
                      type="text"
                      value={tempGuarantor.address?.country || 'Brasil'}
                      onChange={(e) => setTempGuarantor({...tempGuarantor, address: {...tempGuarantor.address, country: e.target.value}})}
                      className="w-full p-2.5 border border-ui-border rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent outline-none"
                      placeholder="Brasil"
                      disabled={!isManualAddress}
                      readOnly={!isManualAddress}
                    />
                  </div>
                </div>
              </div>

              {/* Contatos */}
              <div>
                <h4 className="text-sm font-semibold text-content-secondary mb-3 flex items-center gap-2">
                  <Phone size={16} />
                  Contatos
                </h4>
                <div className="space-y-3">
                  {tempGuarantor.contacts?.map((contact: Contact, cIdx: number) => (
                    <div key={cIdx} className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 bg-surface-subtle rounded-lg">
                      <div>
                        <label className="block text-xs font-medium text-content-secondary mb-1">Nome</label>
                        <input
                          type="text"
                          value={contact.contact || ''}
                          onChange={(e) => updateContact(cIdx, 'contact', e.target.value)}
                          className="w-full p-2 border border-ui-border rounded-lg text-sm focus:ring-2 focus:ring-brand focus:border-transparent outline-none"
                          placeholder="Nome"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-content-secondary mb-1">Celular</label>
                        <input
                          type="text"
                          value={maskPhone(contact.cellphone || '')}
                          onChange={(e) => updateContact(cIdx, 'cellphone', e.target.value)}
                          className="w-full p-2 border border-ui-border rounded-lg text-sm focus:ring-2 focus:ring-brand focus:border-transparent outline-none"
                          placeholder="(00) 00000-0000"
                          maxLength={15}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-content-secondary mb-1">Telefone</label>
                        <input
                          type="text"
                          value={maskPhone(contact.phone || '')}
                          onChange={(e) => updateContact(cIdx, 'phone', e.target.value)}
                          className="w-full p-2 border border-ui-border rounded-lg text-sm focus:ring-2 focus:ring-brand focus:border-transparent outline-none"
                          placeholder="(00) 0000-0000"
                          maxLength={14}
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-content-secondary mb-1">Email</label>
                          <input
                            type="email"
                            value={contact.email || ''}
                            onChange={(e) => updateContact(cIdx, 'email', e.target.value)}
                            className="w-full p-2 border border-ui-border rounded-lg text-sm focus:ring-2 focus:ring-brand focus:border-transparent outline-none"
                            placeholder="email@exemplo.com"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeContact(cIdx)}
                          className="p-2 text-state-error hover:bg-state-error/10 rounded-lg"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addContact}
                    className="flex items-center gap-2 text-sm text-brand hover:text-brand-hover font-medium"
                  >
                    <Plus size={16} />
                    Adicionar Contato
                  </button>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-surface-subtle border-t border-ui-border-soft flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                className="px-5 py-2.5 text-content-secondary bg-surface border border-ui-border rounded-lg hover:bg-surface-subtle font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveGuarantor}
                disabled={!tempGuarantor.name}
                className="px-6 py-2.5 bg-brand text-white rounded-lg hover:bg-brand-hover font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm transition-all active:scale-95"
              >
                {editingIndex !== null ? 'Salvar Alterações' : 'Adicionar Fiador'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
