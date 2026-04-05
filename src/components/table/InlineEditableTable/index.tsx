/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Filter, Trash2, Edit2, Save, X, Plus } from "lucide-react";
import { useMessageContext } from "@/contexts/MessageContext";
import { usePopupContext } from "@/contexts/PopupContext";
import SkeletonTable from "../TableSkeleton";
import DynamicFilterModal from "../../filters/DynamicFilterModal";
import SearchInput from "../../filters/SearchInput";
import SelectLimit from "../../filters/PageSizeSelect";
import Pagination from "../../filters/Pagination";
import TableInformations from "../TableHeader";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { useOptimizedTableData } from "@/hooks/useOptimizedTableData";
import { useDynamicFilters } from "@/hooks/useDynamicFilters";
import { ColumnDef, Option } from "@/types/types";

interface InlineEditableTableProps {
  resource: string;
  title: string;
  columns: ColumnDef[];
  autoFocusSearch?: boolean;
  defaultSort?: Record<string, any>;
  defaultLimit?: number;
  enableCreate?: boolean;
  enableDelete?: boolean;
  formOptions?: { categories: Option[]; incomeCategories: Option[]; expenseCategories: Option[]; institutions: Option[]; cards: Option[]; centers: Option[]; subcategories: { [categoryId: string]: Option[] }; };
  onRowSave?: (id: string, data: any) => Promise<void>;
  onRowCreate?: (data: any) => Promise<void>;
  onRowDelete?: (id: string) => Promise<void>;
  showTotals?: boolean;
}

interface EditingRow {
  id: string; data: any; isEditing: boolean; isNew: boolean; isSaving: boolean; errors: Record<string, string>;
}

export default function InlineEditableTable({
  resource, title, columns, autoFocusSearch = true, defaultSort = {}, defaultLimit = 30, enableCreate = true, enableDelete = true,
  formOptions = { categories: [], incomeCategories: [], expenseCategories: [], institutions: [], cards: [], centers: [], subcategories: {} },
  showTotals = true, onRowSave, onRowCreate, onRowDelete,
}: InlineEditableTableProps) {
  const [filterVisible, setFilterVisible] = useState(false);
  const [selectedCheckboxes, setSelectedCheckboxes] = useState<string[]>([]);
  const [appliedFilters, setAppliedFilters] = useState<Record<string, any>>({});
  const [editingRows, setEditingRows] = useState<EditingRow[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  
  const { showMessage } = useMessageContext();
  const { showPopup } = usePopupContext();
  
  const { filters: dynamicFilters, searchFields, isLoading: isLoadingFilters } = useDynamicFilters(`/${resource}/filters`, appliedFilters);
  const { state, data, isLoading: isLoadingData, updateState, refreshData } = useOptimizedTableData(resource, {
    page: 1, limit: defaultLimit, search: "", sort: defaultSort, filters: {}
  });

  const dataColumns = useMemo(() => columns.filter(col => col.field !== "actions" && col.type !== "custom"), [columns]);

  useEffect(() => {
    const initialWidths: Record<string, number> = {};
    dataColumns.forEach((col: ColumnDef) => {
      if (!columnWidths[col.field]) {
        const field = col.field.toLowerCase();
        initialWidths[col.field] = field.includes('description') ? 300 : (field.includes('amount') || field.includes('value') || field.includes('date')) ? 120 : 150;
      }
    });
    setColumnWidths(initialWidths);
  }, [dataColumns]);

  const isResizingRef = useRef<{field: string, startX: number, startWidth: number} | null>(null);
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current) return;
    const { field, startX, startWidth } = isResizingRef.current;
    setColumnWidths(prev => ({ ...prev, [field]: Math.max(60, startWidth + (e.pageX - startX)) }));
  }, []);
  const handleMouseUp = useCallback(() => {
    isResizingRef.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);
  const handleMouseDownResize = useCallback((e: React.MouseEvent, field: string) => {
    e.preventDefault(); e.stopPropagation();
    isResizingRef.current = { field, startX: e.pageX, startWidth: columnWidths[field] || 150 };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [columnWidths, handleMouseMove, handleMouseUp]);

  const { items, meta } = useMemo(() => {
    if (!data) return { items: [], meta: null };
    const itemsData = Array.isArray(data.data) ? data.data : Array.isArray(data.items) ? data.items : Array.isArray(data) ? data : [];
    return {
      items: itemsData,
      meta: data.meta || { page: data.currentPage || 1, limit: state.limit, total: data.total || itemsData.length, totalPages: data.totalPages || 1 }
    };
  }, [data, state.limit]);

  const tableData = useMemo(() => {
    if (!meta || !meta.total) return { start: 0, end: 0 };
    return { start: (meta.page - 1) * meta.limit + 1, end: Math.min(meta.page * meta.limit, meta.total) };
  }, [meta]);

  const filteredItems = useMemo(() => {
    if (activeTab === 'ALL') return items;
    return items.filter((item: any) => {
      const isIncome = item.category?.type === 'INCOME';
      return activeTab === 'INCOME' ? isIncome : !isIncome;
    });
  }, [items, activeTab]);

  const totals = useMemo(() => {
    if (!showTotals || !filteredItems?.length) return { totalIncome: 0, totalExpense: 0, balance: 0 };
    return filteredItems.reduce((acc: any, item: any) => {
      const amount = parseFloat(String(item.amount).replace(/[R$\s]/g, '').replace(/[^\d,-]/g, '').replace(',', '.') || '0');
      item.category?.type === 'INCOME' ? (acc.totalIncome += amount) : (acc.totalExpense += amount);
      acc.balance = acc.totalIncome - acc.totalExpense;
      return acc;
    }, { totalIncome: 0, totalExpense: 0, balance: 0 });
  }, [filteredItems, showTotals]);

  const displayItems = useMemo(() => [
    ...editingRows.filter(row => row.isNew),
    ...filteredItems.map((item: any) => ({ ...item, isEditing: editingRows.some(row => row.id === item.id && row.isEditing) }))
  ], [filteredItems, editingRows]);

  const getNestedValue = useCallback((obj: any, path: string) => {
    return path?.split('.').reduce((acc, key) => {
      const match = key.match(/(\w+)\[(\d+)\]/);
      return match ? acc?.[match[1]]?.[parseInt(match[2])] : acc?.[key];
    }, obj);
  }, []);

  const formatCellValue = useCallback((value: any, column: ColumnDef) => {
    if (value == null || value === '') return '-';
    if (column.formatter === 'currency' || column.type === 'currency') return formatCurrency(value);
    if (column.formatter === 'date' || column.type === 'date') return formatDate(value);
    if (column.formatter === 'boolean' || column.type === 'boolean') return value ? 'Sim' : 'Não';
    if (column.type === 'number') return Number(value).toLocaleString('pt-BR');
    return String(value);
  }, []);

  const getCellValue = useCallback((item: any, column: ColumnDef) => {
    const field = column.field;
    if (field === "status" && ['PENDING', 'COMPLETED'].includes(item[field])) {
      const isCompleted = item[field] === 'COMPLETED';
      return <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${isCompleted ? 'text-green-700 bg-green-50 border-green-200' : 'text-yellow-700 bg-yellow-50 border-yellow-200'}`}>{isCompleted ? 'Concluído' : 'Pendente'}</span>;
    }
    if (field === "amount") {
      const isIncome = item.category?.type === 'INCOME';
      return <span className={`font-semibold ${isIncome ? 'text-green-600' : 'text-red-600'}`}>{isIncome ? '+ ' : '- '}{formatCellValue(item[field], column)}</span>;
    }
    
    const specialFields: Record<string, any> = {
      category_id: item.category?.name, card_id: item.card?.name, subcategory_id: item.subcategory?.name,
      institution: formOptions.institutions.find(i => i.value === item.financial_institution_id)?.label, center_id: item.center?.name
    };
    if (field in specialFields) return formatCellValue(specialFields[field] || '', column);

    const val = item[field] || getNestedValue(item, field);
    return typeof val === 'object' && !Array.isArray(val) ? formatCellValue(val?.name || val?.description, column) : formatCellValue(val, column);
  }, [formatCellValue, getNestedValue, formOptions]);

  const headers = useMemo(() => dataColumns.map(col => ({ label: col.label, field: col.field, sortParam: col.sortParam || col.field })), [dataColumns]);

  const updateEditingRow = useCallback((id: string, field: string, value: any) => {
    setEditingRows(prev => prev.map(row => row.id === id ? { ...row, data: { ...row.data, [field]: value } } : row));
  }, []);

  const validateEditingRow = useCallback((row: EditingRow) => {
    const d = row.data, e: Record<string, string> = {};
    if (!d.amount || parseFloat(String(d.amount).replace(/[^\d,-]/g, '').replace(',', '.')) <= 0) e.amount = 'Valor deve ser maior que zero';
    if (!d.category_id) e.category_id = 'Categoria é obrigatória';
    if (d.category_id && formOptions.subcategories[d.category_id]?.length > 0 && !d.subcategory_id) e.subcategory_id = 'Subcategoria é obrigatória';
    if (!d.financial_institution_id) e.financial_institution_id = 'Instituição é obrigatória';
    if (!d.event_date) e.event_date = 'Data do evento é obrigatória';
    if (!d.effective_date) e.effective_date = 'Data de efetivação é obrigatória';
    return e;
  }, [formOptions]);

  const startEditingRow = useCallback((id: string, isNew = false) => {
    const item = isNew ? {} : items.find((i: any) => i.id === id);
    if (!item && !isNew) return;

    const safeDateInput = (val: any) => val ? String(val).split('T')[0] : '';
    const safeId = (val: any) => val ? String(val) : '';
    
    let foundSubcategoryId = safeId(item.subcategory_id || item.subcategory?.id);
    if (!foundSubcategoryId && item.category?.subcategories?.length > 0) {
      foundSubcategoryId = safeId(item.category.subcategories[0].id);
    }
    
    setEditingRows(prev => [...prev.filter(r => !r.isNew), {
      id: isNew ? `new-${Date.now()}` : id,
      data: isNew 
        ? { description: '', amount: '', status: 'PENDING', event_date: new Date().toISOString().split('T')[0], effective_date: new Date().toISOString().split('T')[0], category_id: '', financial_institution_id: '', card_id: '', center_id: '', subcategory_id: '' } 
        : { 
            ...item, 
            event_date: safeDateInput(item.event_date), 
            effective_date: safeDateInput(item.effective_date),
            category_id: safeId(item.category_id || item.category?.id),
            subcategory_id: foundSubcategoryId,
            financial_institution_id: safeId(item.financial_institution_id || item.financial_institution?.id || item.institution?.id),
            card_id: safeId(item.card_id || item.card?.id),
            center_id: safeId(item.center_id || item.center?.id),
          },
      isEditing: true, isNew, isSaving: false, errors: {}
    }]);
  }, [items]);

  const saveEditingRow = useCallback(async (id: string) => {
    const row = editingRows.find(r => r.id === id);
    if (!row) return;
    const errors = validateEditingRow(row);
    if (Object.keys(errors).length > 0) return setEditingRows(prev => prev.map(r => r.id === id ? { ...r, errors } : r));

    setEditingRows(prev => prev.map(r => r.id === id ? { ...r, isSaving: true } : r));
    try {
      const payload = { 
        ...row.data, 
        amount: parseFloat(String(row.data.amount).replace(/[^\d,-]/g, '').replace(',', '.')), 
        card_id: row.data.card_id || null, 
        center_id: row.data.center_id || null,
        subcategory_id: row.data.subcategory_id || null
      };
      
      if (row.isNew && onRowCreate) await onRowCreate(payload);
      else if (!row.isNew && onRowSave) await onRowSave(id, payload);
      
      showMessage(`Lançamento ${row.isNew ? 'criado' : 'atualizado'} com sucesso!`, 'success');
      setEditingRows(prev => prev.filter(r => r.id !== id));
      refreshData();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Erro ao salvar', 'error');
      setEditingRows(prev => prev.map(r => r.id === id ? { ...r, isSaving: false } : r));
    }
  }, [editingRows, validateEditingRow, onRowCreate, onRowSave, refreshData, showMessage]);

  // --- NOVA FUNÇÃO PARA PROCESSAR A DELEÇÃO EM MASSA ---
  const handleDeleteSelected = useCallback(() => {
    if (!selectedCheckboxes.length) return;

    showPopup(
      'Remover Registros',
      selectedCheckboxes.length > 1 
        ? `Você selecionou ${selectedCheckboxes.length} registros. Tem certeza que deseja removê-los?` 
        : `Tem certeza que deseja remover o registro selecionado?`,
      async () => {
        let successCount = 0;
        let errorCount = 0;
        let lastErrorMessage = "";

        for (const id of selectedCheckboxes) {
          try {
            if (onRowDelete) {
              await onRowDelete(id);
              successCount++;
            }
          } catch (error: any) {
            errorCount++;
            lastErrorMessage = error.message || "Erro desconhecido";
          }
        }

        if (errorCount === 0) {
          showMessage(selectedCheckboxes.length > 1 ? `${successCount} registros removidos com sucesso!` : "Registro removido com sucesso!", "success");
        } else {
          showMessage(selectedCheckboxes.length === 1 ? lastErrorMessage : `${successCount} removidos, ${errorCount} erros. ${lastErrorMessage}`, "error");
        }
        
        setSelectedCheckboxes([]);
        refreshData();
      },
      () => {}
    );
  }, [selectedCheckboxes, onRowDelete, showPopup, showMessage, refreshData]);

  const renderEditableCell = useCallback((item: any, column: ColumnDef, row?: EditingRow) => {
    if (!row?.isEditing) return getCellValue(item, column);
    
    const val = row.data[column.field];
    const err = row.errors[column.field];
    const dis = row.isSaving;
    const upd = (v: any) => updateEditingRow(row.id, column.field, v);
    
    const inputClasses = `w-full px-2 py-1 text-[13px] border rounded outline-none focus:border-brand ${err ? 'border-red-500' : 'border-ui-border'} ${dis ? 'bg-gray-100' : 'bg-surface'}`;
    
    const renderWrapper = (children: React.ReactNode) => (
      <div className="w-full relative group">
        {children}
        {err && <p className="text-red-500 text-[11px] mt-1">{err}</p>}
      </div>
    );

    switch (column.field) {
      case 'description':
        return renderWrapper(
          <textarea value={val || ''} onChange={e => upd(e.target.value)} disabled={dis} rows={3} className={inputClasses} placeholder="Ex: Pagamento..." style={{ minHeight: '60px', minWidth: '200px' }} />
        );
      case 'amount':
        const amountDisplay = typeof val === 'number' ? formatCurrency(val) : (val || '');
        return renderWrapper(
          <input 
            type="text" 
            value={amountDisplay} 
            onChange={e => {
              const rawDigits = e.target.value.replace(/\D/g, '');
              if (!rawDigits) return upd('');
              const floatValue = parseFloat(rawDigits) / 100;
              upd(formatCurrency(floatValue));
            }} 
            disabled={dis} 
            className={inputClasses} 
            placeholder="R$ 0,00" 
          />
        );
      case 'status':
        return renderWrapper(
          <select value={val || 'PENDING'} onChange={e => upd(e.target.value)} disabled={dis} className={inputClasses}>
            <option value="PENDING">Pendente</option>
            <option value="COMPLETED">Concluído</option>
          </select>
        );
      case 'event_date': case 'effective_date': {
        const safeDate = val ? String(val).split('T')[0] : '';
        return renderWrapper(
          <input type="date" value={safeDate} onChange={e => upd(e.target.value)} disabled={dis || column.field === 'event_date'} className={inputClasses} />
        );
      }
      case 'category_id':
        return renderWrapper(
          <select 
            value={val || ''} 
            onChange={e => { 
              updateEditingRow(row.id, 'category_id', e.target.value); 
              updateEditingRow(row.id, 'subcategory_id', ''); 
              updateEditingRow(row.id, 'center_id', ''); 
            }} 
            disabled={dis} 
            className={inputClasses}
          >
            <option value="">Selecione...</option>
            {(activeTab === 'ALL' || activeTab === 'INCOME') && (
              <optgroup label="Receitas">
                {formOptions.incomeCategories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </optgroup>
            )}
            {(activeTab === 'ALL' || activeTab === 'EXPENSE') && (
              <optgroup label="Despesas">
                {formOptions.expenseCategories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </optgroup>
            )}
          </select>
        );
      case 'subcategory_id':
        const subcategories = formOptions.subcategories[row.data.category_id] || [];
        return subcategories.length ? renderWrapper(
          <select value={val || ''} onChange={e => upd(e.target.value)} disabled={dis} className={inputClasses}>
            <option value="">Selecione...</option>
            {subcategories.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        ) : null;
      case 'institution':
        return renderWrapper(
          <select 
            value={row.data.financial_institution_id || ''} 
            onChange={e => updateEditingRow(row.id, 'financial_institution_id', e.target.value)} 
            disabled={dis} 
            className={inputClasses}
          >
            <option value="">Selecione...</option>
            {formOptions.institutions.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
          </select>
        );
      case 'card_id':
        return renderWrapper(
          <select value={val || ''} onChange={e => upd(e.target.value)} disabled={dis} className={inputClasses}>
            <option value="">Nenhum</option>
            {formOptions.cards.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        );
      case 'center_id': {
        const catId = row.data.category_id;
        let txType: 'INCOME' | 'EXPENSE' | 'ALL' = activeTab;

        if (catId) {
          const isIncomeCat = formOptions.incomeCategories.some(c => String(c.value) === String(catId));
          txType = isIncomeCat ? 'INCOME' : 'EXPENSE';
        }

        const incomeCenters = formOptions.centers.filter((c: any) => c.type === 'INCOME');
        const expenseCenters = formOptions.centers.filter((c: any) => c.type === 'EXPENSE');

        return renderWrapper(
          <select value={val || ''} onChange={e => upd(e.target.value)} disabled={dis} className={inputClasses}>
            <option value="">Selecione...</option>
            {txType === 'ALL' ? (
              <>
                {incomeCenters.length > 0 && (
                  <optgroup label="Receitas">
                    {incomeCenters.map((c: any) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </optgroup>
                )}
                {expenseCenters.length > 0 && (
                  <optgroup label="Despesas">
                    {expenseCenters.map((c: any) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </optgroup>
                )}
                {formOptions.centers.filter((c: any) => !c.type).map((c: any) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </>
            ) : (
              formOptions.centers
                .filter((c: any) => c.type === txType || !c.type)
                .map((c: any) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))
            )}
          </select>
        );
      }
      default:
        return renderWrapper(<input type="text" value={val || ''} onChange={e => upd(e.target.value)} disabled={dis} className={inputClasses} />);
    }
  }, [getCellValue, updateEditingRow, formOptions, activeTab]);

  if (isLoadingFilters || isLoadingData) return <SkeletonTable />;
  if (!Array.isArray(displayItems)) return <div className="flex justify-center items-center my-3"><div className="bg-surface-subtle py-4 px-6 rounded-sm text-content-secondary">Erro ao carregar dados</div></div>;

  return (
    <>
      <div className="flex justify-center gap-1 sm:justify-between items-center flex-wrap mb-1 mt-2">
        <div className="flex items-center justify-center sm:justify-start gap-3 max-w-[750px] w-full flex-wrap sm:flex-nowrap relative">
          <div className="flex items-center gap-2">
            {enableCreate && <button onClick={() => startEditingRow('new', true)} className="bg-surface-subtle p-2 rounded hover:bg-ui-border transition-colors"><Plus size={20} color="var(--color-text-muted)" /></button>}
            <button onClick={() => setFilterVisible(!filterVisible)} className="p-2 hover:bg-surface-subtle rounded transition-colors relative"><Filter size={20} color={Object.keys(appliedFilters).length ? "var(--color-brand-primary)" : "var(--color-text-muted)"} />{Object.keys(appliedFilters).length > 0 && <span className="absolute -top-1 -right-1 bg-brand text-content-inverse text-xs rounded-full w-5 h-5 flex items-center justify-center">{Object.keys(appliedFilters).length}</span>}</button>
            {enableDelete && <button onClick={handleDeleteSelected} className="p-2 hover:bg-surface-subtle rounded transition-colors disabled:opacity-50" disabled={!selectedCheckboxes.length}><Trash2 size={20} color="var(--color-text-muted)" /></button>}
          </div>

          <div className="flex bg-surface-subtle p-1 rounded-lg border border-ui-border-soft ml-2">
            <button onClick={() => setActiveTab('ALL')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'ALL' ? 'bg-surface shadow-sm text-brand' : 'text-content-secondary hover:text-content'}`}>Todos</button>
            <button onClick={() => setActiveTab('INCOME')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'INCOME' ? 'bg-green-50 border border-green-200 text-green-700 shadow-sm' : 'text-content-secondary hover:text-content'}`}>Receitas</button>
            <button onClick={() => setActiveTab('EXPENSE')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'EXPENSE' ? 'bg-red-50 border border-red-200 text-red-700 shadow-sm' : 'text-content-secondary hover:text-content'}`}>Despesas</button>
          </div>

          {filterVisible && <DynamicFilterModal visible={filterVisible} setVisible={setFilterVisible} onApply={f => { setAppliedFilters(f); updateState({ filters: f, page: 1 }); }} onClear={() => { setAppliedFilters({}); updateState({ filters: {}, page: 1 }); }} title={title} filters={dynamicFilters} initialValues={appliedFilters} />}
          <SearchInput initialValue={state.search} onSearch={s => updateState({ search: s, page: 1 })} placeholder={`Pesquisar ${title.toLowerCase()}...`} delay={600} autoFocus={autoFocusSearch} />
        </div>
        <SelectLimit limit={state.limit} onLimitChange={l => updateState({ limit: l, page: 1 })} />
        {meta?.totalPages > 1 && <Pagination currentPage={meta.page} totalPage={meta.totalPages} onPageChange={p => updateState({ page: p })} />}
      </div>

      <div className="flex flex-wrap justify-between items-center mb-2 px-1">
        <p className="text-[14px] text-content-secondary">
          {meta && meta.total > 0 ? (
            activeTab === 'ALL' 
              ? `Exibindo ${tableData.start} a ${tableData.end} de ${meta.total} registros`
              : `Exibindo ${filteredItems.length} registros de ${activeTab === 'INCOME' ? 'Receitas' : 'Despesas'} nesta página`
          ) : 'Nenhum registro encontrado'}
        </p>
        
        {(showTotals || totals.totalIncome > 0 || totals.totalExpense > 0) && items.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center text-[13px]">
             {(activeTab === 'ALL' || activeTab === 'INCOME') && (
               <span className="text-green-600 font-medium">Receitas: {formatCurrency(totals.totalIncome)}</span>
             )}
             {activeTab === 'ALL' && <span className="text-content-muted">|</span>}
             {(activeTab === 'ALL' || activeTab === 'EXPENSE') && (
               <span className="text-red-600 font-medium">Despesas: {formatCurrency(totals.totalExpense)}</span>
             )}
             {activeTab === 'ALL' && (
               <>
                 <span className="text-content-muted">|</span>
                 <span className={`font-semibold ${totals.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>Saldo: {formatCurrency(totals.balance)}</span>
               </>
             )}
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg shadow-sm">
        <TableInformations 
          headers={headers} 
          sort={state.sort} 
          onSort={s => updateState({ sort: { [s]: state.sort[s] === "desc" ? "asc" : "desc" }, page: 1 })} 
          onSelectAll={e => setSelectedCheckboxes(e.target.checked ? displayItems.map((i: any) => i.id) : [])} 
          allSelected={selectedCheckboxes.length === displayItems.length && displayItems.length > 0} 
          hasActions={true} 
          columnWidths={columnWidths}
          onMouseDownResize={handleMouseDownResize}
        >
          {displayItems.map((item: any) => {
            const editingRow = editingRows.find(row => row.id === item.id);
            const isEditing = !!editingRow?.isEditing;
            
            return (
              <tr key={item.id} className={`bg-surface hover:bg-surface-subtle border-b border-ui-border-soft text-content-secondary min-h-[26px] h-fit ${isEditing ? 'bg-blue-50 border-blue-200' : ''}`}>
                {dataColumns.map((col, idx) => (
                  <td key={col.field} className={`align-middle border-r border-ui-border-soft p-0 ${idx === 0 ? 'sticky left-0 bg-surface z-20' : ''} ${isEditing ? 'bg-blue-50' : ''}`} style={{ width: columnWidths[col.field] || 150, minWidth: columnWidths[col.field] || 150 }}>
                    <div className={`flex w-full h-full min-h-[26px] items-center px-2 py-1 ${idx === 0 ? 'justify-start' : 'justify-center'}`}>
                      {idx === 0 && enableDelete && !isEditing && <input type="checkbox" className="mr-2 inp-checkbox-select rounded border-ui-border cursor-pointer w-4 h-4" checked={selectedCheckboxes.includes(item.id)} onChange={() => setSelectedCheckboxes(p => p.includes(item.id) ? p.filter(id => id !== item.id) : [...p, item.id])} />}
                      <div className={`w-full min-w-0 text-[13px] ${idx === 0 || col.align === 'left' ? 'text-left' : col.align === 'right' ? 'text-right' : 'text-center'}`}>{renderEditableCell(item, col, editingRow)}</div>
                    </div>
                  </td>
                ))}
                <td className="px-2 sticky right-0 bg-surface z-20 border-l border-ui-border-soft align-middle w-[120px] min-w-[120px]">
                  <div className="flex items-center justify-center gap-1 h-full min-h-[26px]">
                    {isEditing ? (
                      <>
                        <button onClick={() => saveEditingRow(editingRow!.id)} disabled={editingRow!.isSaving} className="p-1 hover:bg-green-100 rounded text-green-600 disabled:opacity-50">{editingRow!.isSaving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600" /> : <Save size={16} />}</button>
                        <button onClick={() => setEditingRows(p => p.filter(r => r.id !== editingRow!.id))} disabled={editingRow!.isSaving} className="p-1 hover:bg-red-100 rounded text-red-600 disabled:opacity-50"><X size={16} /></button>
                      </>
                    ) : (
                      <button onClick={() => startEditingRow(item.id)} className="p-1 hover:bg-surface-subtle rounded text-brand"><Edit2 size={16} /></button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </TableInformations>
      </div>
    </>
  );
}