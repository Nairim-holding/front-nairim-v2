/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useMemo } from "react";
import Section from "@/components/Section";
import { Plus, Trash2, Edit2, X, Search, FileText, Tags, CreditCard } from "lucide-react";
import { useMessageContext } from "@/contexts/MessageContext";
import { usePopupContext } from "@/contexts/PopupContext";
import DynamicFormManager from "@/components/DynamicFormManager"; 
import { FormStep } from "@/types/types";

// VIEW removido
type FormMode = 'IDLE' | 'CREATE' | 'EDIT';

export default function LancamentosPage() {
  const { showMessage } = useMessageContext();
  const { showPopup } = usePopupContext();

  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  
  const [transactions, setTransactions] = useState<any[]>([]);
  
  // Controles de Tela
  const [search, setSearch] = useState('');
  const [formMode, setFormMode] = useState<FormMode>('IDLE');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Opções para os Selects do Form
  const [options, setOptions] = useState({
    categories: [] as {label: string, value: string}[],
    institutions: [] as {label: string, value: string}[],
    cards: [] as {label: string, value: string}[],
    centers: [] as {label: string, value: string}[],
    subcategories: [] as {label: string, value: string, categoryId: string}[]
  });

  const baseURL = process.env.NEXT_PUBLIC_URL_API;

  const fetchTransactions = async () => {
    try {
      const res = await fetch(`${baseURL}/financial-transaction?limit=100`);
      const data = await res.json();
      setTransactions(data?.data || data || []);
    } catch (_error) {
      showMessage("Erro ao carregar os lançamentos.", "error");
    } finally {
      setIsLoadingList(false);
    }
  };

  const fetchOptions = async () => {
    try {
      const [catRes, subRes, instRes, cardRes, centRes] = await Promise.all([
        fetch(`${baseURL}/financial-category?limit=1000&filter[is_active]=true`),
        fetch(`${baseURL}/financial-subcategory?limit=1000&filter[is_active]=true`),
        fetch(`${baseURL}/financial-institution?limit=1000`), 
        fetch(`${baseURL}/financial-card?limit=1000&filter[is_active]=true`),
        fetch(`${baseURL}/financial-center?limit=1000&filter[is_active]=true`),
      ]);

      const [cats, subs, insts, cards, cents] = await Promise.all([
        catRes.json(), subRes.json(), instRes.json(), cardRes.json(), centRes.json()
      ]);

      const mapData = (res: any) => (res?.data || res || []).map((i: any) => ({ label: i.name, value: i.id }));
      const mapTypeData = (res: any) => (res?.data || res || []).map((i: any) => ({ 
        label: `${i.name} (${i.type === 'INCOME' ? 'Receita' : 'Despesa'})`, 
        value: i.id 
      }));

      setOptions({
        categories: mapTypeData(cats),
        institutions: mapData(insts),
        cards: mapData(cards),
        centers: mapTypeData(cents),
        subcategories: (subs?.data || subs || []).map((i: any) => ({
          label: i.name,
          value: i.id,
          categoryId: i.category_id
        }))
      });
    } catch (error) {
      console.error("Erro ao carregar opções:", error);
    } finally {
      setIsLoadingOptions(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
    fetchOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const normalizeText = (text: string) => 
    text ? text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : '';

  const displayedTransactions = transactions
    .filter(t => !t.deleted_at)
    .filter(t => {
      const term = normalizeText(search);
      return normalizeText(t.description).includes(term) || 
             normalizeText(t.category?.name || '').includes(term) ||
             normalizeText(t.financial_institution?.name || '').includes(term);
    })
    .sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());

  const openForm = (mode: FormMode, id: string | null = null) => {
    setSelectedId(id);
    setFormMode(mode);
  };

  const closeForm = () => {
    setFormMode('IDLE');
    setSelectedId(null);
    fetchTransactions(); 
  };

  const handleDelete = (id: string, description: string) => {
    showPopup(
      `Excluir Lançamento`,
      `Tem certeza que deseja excluir o lançamento "${description}"?`,
      async () => {
        try {
          const res = await fetch(`${baseURL}/financial-transaction/${id}`, { method: 'DELETE' });
          if (!res.ok) {
            const result = await res.json().catch(() => ({}));
            throw new Error(result.message || `Erro ao excluir Lançamento.`);
          }
          
          showMessage("Excluído com sucesso!", "success");
          if (selectedId === id) closeForm();
          await fetchTransactions();
        } catch (error: any) {
          showMessage(error.message, "error");
        }
      },
      () => {}
    );
  };

  const formatCurrency = (val: any) => {
    if (!val) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val));
  };

  const formatDate = (val: any) => {
    if (!val) return '';
    return new Date(val).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  };

  // ========================================================
  // LÓGICAS DO FORMULÁRIO GIGANTE (Carregar e Salvar Dados)
  // ========================================================
  
  const transformDataForLoad = (apiResponse: any) => {
    const data = apiResponse.data || apiResponse;
    if (!data) return {};

    let formattedAmount = '';
    if (data.amount) {
      formattedAmount = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(data.amount));
    }

    return {
      description: data.description || '',
      amount: formattedAmount,
      status: data.status || 'PENDING',
      event_date: data.event_date ? data.event_date.split('T')[0] : '',
      effective_date: data.effective_date ? data.effective_date.split('T')[0] : '',
      financial_institution_id: data.financial_institution_id || '',
      category_id: data.category_id || '',
      // Não precisamos setar subcategory_id aqui pois ela não é um campo editável do formulário
      card_id: data.card_id || '',
      center_id: data.center_id || ''
    };
  };

  const transformPayloadForSave = (data: any) => {
    let parsedAmount = 0;
    if (data.amount) {
      const cleanValue = String(data.amount).replace(/[^\d,-]/g, '').replace(',', '.');
      parsedAmount = parseFloat(cleanValue);
      if (isNaN(parsedAmount)) parsedAmount = 0;
    }

    const { subcategories_info, ...apiData } = data; // remove o campo custom de renderização

    return {
      ...apiData,
      amount: parsedAmount,
      // Seguindo o seu padrão da tela antiga: subcategoria vai como nula, e a info é mostrada visualmente
      subcategory_id: null,
      card_id: data.card_id ? data.card_id : null,
      center_id: data.center_id ? data.center_id : null,
      // Se for CREATE e não tiver event_date, garante o padrão
      event_date: data.event_date || new Date().toISOString().split('T')[0]
    };
  };

  const steps: FormStep[] = useMemo(() => {
    return [
      {
        title: 'Detalhes do Lançamento',
        icon: <FileText size={20} />,
        fields: [
          { field: 'description', label: 'Descrição', type: 'text', required: true, autoFocus: true, className: 'col-span-full', placeholder: 'Ex: Pagamento de Aluguel' },
          { field: 'amount', label: 'Valor', type: 'text', mask: 'money', required: true, placeholder: 'R$ 0,00' },
          { field: 'status', label: 'Status', type: 'select', required: true, options: [{label: 'Pendente', value: 'PENDING'}, {label: 'Concluído', value: 'COMPLETED'}] },
          { 
            field: 'event_date', 
            label: 'Data do Evento', 
            type: 'date', 
            required: true,
            // Adicionado bloqueio e default caso seja novo (baseado na sua tela antiga)
            defaultValue: formMode === 'CREATE' ? new Date().toISOString().split('T')[0] : undefined,
            readOnly: true, 
            disabled: true 
          },
          { field: 'effective_date', label: 'Data de Efetivação', type: 'date', required: true },
        ]
      },
      {
        title: 'Classificação',
        icon: <Tags size={20} />,
        fields: [
          { field: 'category_id', label: 'Categoria', type: 'select', required: true, options: options.categories }, 
          // Campo customizado para mostrar as subcategorias da categoria selecionada (apenas visual, sem Select)
          {
            field: 'subcategories_info',
            label: '',
            type: 'custom',
            className: 'col-span-full',
            hidden: (fv) => !fv?.category_id, 
            render: (_: any, fv: any) => {
              if (!fv?.category_id) return null;
              
              const filtered = options.subcategories.filter(sub => sub.categoryId === fv.category_id);
              const text = filtered.length > 0 
                ? filtered.map(sub => sub.label).join(' • ') 
                : 'Nenhuma subcategoria ativa atrelada a esta categoria.';

              return (
                <div className="p-3 bg-brand/5 border border-brand/20 rounded-lg flex items-center gap-3 mt-1 mb-2">
                  <div>
                    <p className="text-[11px] font-semibold text-content-muted uppercase tracking-wider mb-0.5">Subcategorias da Categoria Selecionada</p>
                    <p className="text-sm font-medium text-brand">{text}</p>
                  </div>
                </div>
              );
            }
          },
          { field: 'center_id', label: 'Centro', type: 'select', required: false, options: options.centers },
        ]
      },
      {
        title: 'Pagamento',
        icon: <CreditCard size={20} />,
        fields: [
          { field: 'financial_institution_id', label: 'Instituição Financeira', type: 'select', required: true, options: options.institutions },
          { field: 'card_id', label: 'Cartão', type: 'select', required: false, options: options.cards },
        ]
      }
    ];
  }, [options, formMode]);

  return (
    <Section title="Gerenciar Lançamentos">
      <div className="bg-surface p-6 rounded-xl shadow-sm border border-ui-border w-full">
        
        {isLoadingList || isLoadingOptions ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* COLUNA 1: LISTA DE LANÇAMENTOS */}
            <div className="lg:col-span-1 flex flex-col border border-ui-border rounded-xl bg-surface-subtle overflow-hidden h-[calc(100vh-180px)] min-h-[600px]">
              <div className="bg-surface p-3 border-b border-ui-border">
                <div className="flex justify-between items-center mb-3 px-1">
                  <h3 className="font-bold text-content text-[15px]">Lançamentos</h3>
                  <button 
                    onClick={() => openForm('CREATE')}
                    className="p-1 hover:bg-brand/10 text-brand rounded-md transition-colors"
                    title="Novo Lançamento"
                  >
                    <Plus size={18} />
                  </button>
                </div>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
                  <input 
                    type="text" 
                    placeholder="Buscar por descrição ou categoria..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-[13px] bg-surface-subtle border border-ui-border rounded-lg outline-none focus:border-brand transition-colors"
                  />
                </div>
              </div>
              
              <div className="overflow-y-auto flex-1 p-2">
                {displayedTransactions.length === 0 ? (
                  <p className="text-[13px] text-content-muted text-center mt-10">Nenhum lançamento encontrado.</p>
                ) : (
                  displayedTransactions.map(transaction => {
                    const isIncome = transaction.category?.type === 'INCOME';
                    const isCompleted = transaction.status === 'COMPLETED';

                    return (
                      <div 
                        key={transaction.id}
                        // AQUI: Abre direto no EDIT
                        onClick={() => openForm('EDIT', transaction.id)}
                        className={`group flex justify-between items-center px-3 py-2.5 cursor-pointer rounded-lg mb-1 transition-colors ${
                          selectedId === transaction.id 
                            ? 'bg-brand/10 text-brand border border-brand/20' 
                            : 'hover:bg-ui-border-soft text-content-secondary border border-transparent'
                        }`}
                      >
                        <div className="flex flex-col overflow-hidden w-full">
                          <span className="truncate text-[14px] font-medium">
                            {transaction.description}
                          </span>
                          <div className="flex items-center justify-between mt-1">
                            <span className={`text-[12px] font-semibold truncate ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                              {isIncome ? '+ ' : '- '} {formatCurrency(transaction.amount)}
                            </span>
                            <span className="text-[11px] text-content-muted mr-2">
                              {formatDate(transaction.event_date)}
                            </span>
                          </div>
                          <div className="mt-1.5">
                            <span className={`px-2 py-[2px] rounded-full text-[10px] font-medium ${isCompleted ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                              {isCompleted ? 'Concluído' : 'Pendente'}
                            </span>
                          </div>
                        </div>

                        {/* AQUI: flex-row items-center, VIEW removido */}
                        <div className={`flex items-center gap-1 flex-shrink-0 ml-2 ${selectedId === transaction.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                          <button 
                            onClick={(e) => { e.stopPropagation(); openForm('EDIT', transaction.id); }}
                            className="p-1 hover:bg-brand/20 rounded text-brand"
                            title="Editar"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDelete(transaction.id, transaction.description); }}
                            className="p-1 hover:bg-red-100 rounded text-state-error"
                            title="Excluir"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* COLUNAS 2 E 3: FORMULÁRIO */}
            <div className="lg:col-span-2 flex flex-col h-[calc(100vh-180px)] min-h-[600px] overflow-y-auto relative rounded-xl border border-ui-border bg-surface">
              {formMode === 'IDLE' ? (
                <div className="flex flex-col items-center justify-center h-full border border-dashed border-ui-border rounded-xl bg-surface-subtle text-content-muted p-6 text-center m-4">
                  <p className="text-[15px]">Selecione um lançamento na lista ao lado para editar seus detalhes ou clique em <strong>+</strong> para criar um novo.</p>
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
                      resource="financial-transaction"
                      title="Lançamento"
                      basePath="" 
                      mode={formMode === 'CREATE' ? 'create' : 'edit'}
                      id={selectedId || undefined}
                      steps={steps}
                      transformData={transformDataForLoad}
                      transformResponse={transformPayloadForSave}
                      onSubmitSuccess={() => {
                        showMessage(`Lançamento ${formMode === 'CREATE' ? 'criado' : 'atualizado'} com sucesso!`, 'success');
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