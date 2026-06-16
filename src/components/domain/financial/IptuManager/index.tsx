/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, X, Check, Landmark, DollarSign, ListOrdered, Info, Copy } from 'lucide-react';
import { maskMoney } from '@/utils/masks';
import { parseMoney } from '@/app/dashboard/(cadastro)/imoveis/_lib/propertyTransform';
import DynamicTableManager from '@/components/table/DataTable';
import { ColumnDef } from '@/types/types';
import { usePopupContext } from '@/contexts/PopupContext';

// Converte "YYYY-MM-DD" → "DD/MM/YYYY" sem criar objeto Date (evita bug de timezone UTC)
function isoToDisplay(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

interface IptuInstallment {
  due_date: string;
  value: string | number;
}

interface IptuEntry {
  id?: string;
  year: string | number;
  payment_condition: string;
  property_tax?: number | null;
  property_tax_cash?: string | number | null;
  property_tax_cash_due_date?: string | null;
  property_tax_first_installment?: string | number | null;
  property_tax_first_installment_due_date?: string | null;
  property_tax_second_installment?: string | number | null;
  property_tax_second_installment_due_date?: string | null;
  iptu_installments_count?: string | number | null;
  iptu_installments?: IptuInstallment[];
}

interface IptuManagerProps {
  value?: IptuEntry[];
  onChange?: (iptus: IptuEntry[]) => void;
  readOnly?: boolean;
  activeLease?: any;
  baseIptu?: number;
}

export default function IptuManager({ value = [], onChange, readOnly = false, activeLease, baseIptu = 0 }: IptuManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [iptus, setIptus] = useState<IptuEntry[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const installmentsCountRef = useRef<HTMLInputElement>(null);
  const { showPopup } = usePopupContext();
  const [sortConfig, setSortConfig] = useState<Record<string, 'asc' | 'desc'>>({});

  const [tempIptu, setTempIptu] = useState<IptuEntry>({
    year: new Date().getFullYear().toString(),
    payment_condition: 'IN_FULL_15_DISCOUNT',
    property_tax_cash: '',
    property_tax_cash_due_date: '',
    property_tax_first_installment: '',
    property_tax_first_installment_due_date: '',
    property_tax_second_installment: '',
    property_tax_second_installment_due_date: '',
    iptu_installments_count: '',
    iptu_installments: []
  });

  useEffect(() => {
    const valueArray = Array.isArray(value) ? value : [];
    console.log('IPTU Manager - Dados recebidos do back-end:', valueArray);
    
    // Normalizar datas para formato ISO (YYYY-MM-DD) ao receber do back-end
    const normalizedArray = valueArray.map((item: any) => {
      const normalized = { ...item };
      
      // Função auxiliar para normalizar data
      const normalizeDate = (dateStr: string | null | undefined): string | null => {
        if (!dateStr) return null;
        
        // Se já está em formato ISO simples (YYYY-MM-DD), retorna como está
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          return dateStr;
        }
        
        // Se tem timestamp (YYYY-MM-DDTHH:mm:ss.sssZ), extrai apenas a data
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
        
        return dateStr;
      };
      
      // Normalizar datas para formato ISO
      normalized.property_tax_cash_due_date = normalizeDate(item.property_tax_cash_due_date);
      normalized.property_tax_first_installment_due_date = normalizeDate(item.property_tax_first_installment_due_date);
      normalized.property_tax_second_installment_due_date = normalizeDate(item.property_tax_second_installment_due_date);
      
      // Normalizar datas das parcelas
      let installmentsArray = item.iptu_installments;
      if (typeof installmentsArray === 'string') {
        try { installmentsArray = JSON.parse(installmentsArray); } catch(e) { installmentsArray = []; }
      }
      if (installmentsArray && Array.isArray(installmentsArray)) {
        normalized.iptu_installments = installmentsArray.map((inst: any) => ({
          ...inst,
          due_date: normalizeDate(inst.due_date)
        }));
      }
      
      return normalized;
    });
    
    if (JSON.stringify(normalizedArray) !== JSON.stringify(iptus)) {
      setIptus(normalizedArray);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (tempIptu.payment_condition === 'INSTALLMENTS' && isModalOpen) {
      installmentsCountRef.current?.focus();
    }
  }, [tempIptu.payment_condition, isModalOpen]);

  const openModal = (mode: 'add' | 'edit', index?: number) => {
    if (readOnly) return;
    setErrorMsg('');

    if (mode === 'edit' && index !== undefined) {
      setEditingIndex(index);
      const entry = iptus[index];
      setTempIptu({
        ...entry,
        property_tax: entry.property_tax != null ? Number(entry.property_tax) : (baseIptu || undefined),
      });
    } else {
      setEditingIndex(null);
      setTempIptu({
        year: new Date().getFullYear().toString(),
        payment_condition: 'IN_FULL_15_DISCOUNT',
        property_tax: baseIptu || undefined,
        property_tax_cash: '',
        property_tax_cash_due_date: '',
        property_tax_first_installment: '',
        property_tax_first_installment_due_date: '',
        property_tax_second_installment: '',
        property_tax_second_installment_due_date: '',
        iptu_installments_count: '',
        iptu_installments: []
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingIndex(null);
    setErrorMsg('');
  };

  const handleSave = () => {
    setErrorMsg('');
    const effectiveBase = Number(tempIptu.property_tax ?? baseIptu);
    if (effectiveBase <= 0) return setErrorMsg('Preencha o Valor Base do IPTU primeiro.');

    const yearValue = Number(tempIptu.year);
    const currentYear = new Date().getFullYear();

    if (!tempIptu.year) return setErrorMsg('O Ano do Exercício é obrigatório.');
    if (yearValue < currentYear - 5 || yearValue > currentYear + 5) {
      return setErrorMsg(`O ano deve estar entre ${currentYear - 5} e ${currentYear + 5}.`);
    }

    if (tempIptu.payment_condition === 'IN_FULL_15_DISCOUNT') {
      const val = Number(tempIptu.property_tax_cash);
      if (!val || val <= 0) return setErrorMsg('Informe o valor.');
      if (!tempIptu.property_tax_cash_due_date) return setErrorMsg('Informe a data de vencimento.');
    }
    else if (tempIptu.payment_condition === 'SECOND_INSTALLMENT_10_DISCOUNT') {
      const firstInstallment = Number(tempIptu.property_tax_first_installment);
      if (!firstInstallment || firstInstallment <= 0) return setErrorMsg('Informe o valor da 1ª parcela.');
      if (!tempIptu.property_tax_first_installment_due_date) return setErrorMsg('Informe a data de vencimento da 1ª parcela.');
    }
    else if (tempIptu.payment_condition === 'INSTALLMENTS') {
      const sum = (tempIptu.iptu_installments || []).reduce((acc, curr) => acc + Number(curr.value || 0), 0);
      if (sum <= 0) return setErrorMsg('Informe os valores das parcelas.');
    }

    const entryToSave: IptuEntry = {
      ...tempIptu,
      // Freeze base value at save time for new entries; preserve existing base for edits
      property_tax: tempIptu.property_tax != null ? tempIptu.property_tax : baseIptu,
    };
    const newIptus = [...iptus];
    if (editingIndex !== null) {
      newIptus[editingIndex] = entryToSave;
    } else {
      newIptus.push(entryToSave);
    }

    newIptus.sort((a, b) => Number(b.year) - Number(a.year));
    setIptus(newIptus);
    console.log('IPTU Manager - Dados enviados para o back-end:', newIptus);
    if (onChange) onChange(newIptus);
    closeModal();
  };

  const handleRemove = (index: number) => {
    if (readOnly) return;
    const item = iptus[index];
    showPopup(
      'Confirmar Exclusão',
      `Tem certeza que deseja excluir o lançamento de IPTU do ano ${item.year}?`,
      () => {
        const newIptus = iptus.filter((_, i) => i !== index);
        setIptus(newIptus);
        if (onChange) onChange(newIptus);
      },
      () => {} // callback de cancelamento vazio
    );
  };

  // Verifica se a 1ª parcela já foi lançada para o ano atual
  const getFirstInstallmentNumber = () => {
    const currentYear = tempIptu.year;
    // Verifica se já existe algum lançamento para o ano atual (exceto o que está sendo editado)
    const existingForYear = iptus.find((item, idx) => {
      if (editingIndex !== null && idx === editingIndex) return false; // Ignora o item sendo editado
      return String(item.year) === String(currentYear);
    });
    
    // Se já existe um lançamento com 1ª parcela definida (IN_FULL_15_DISCOUNT ou SECOND_INSTALLMENT_10_DISCOUNT), começa da 2ª
    if (existingForYear) {
      const hasFirstInstallment = existingForYear.payment_condition === 'IN_FULL_15_DISCOUNT' || 
                                   existingForYear.payment_condition === 'SECOND_INSTALLMENT_10_DISCOUNT';
      if (hasFirstInstallment) return 2;
    }
    
    return 1;
  };

  const generateInstallments = (count: string | number) => {
    const num = parseInt(String(count));
    console.log('generateInstallments - count:', count, 'num:', num);
    if (isNaN(num) || num <= 0) return setTempIptu(prev => ({ ...prev, iptu_installments_count: count, iptu_installments: [] }));
    
    const baseIptuNum = Number(tempIptu.property_tax ?? baseIptu);
    console.log('generateInstallments - baseIptu:', tempIptu.property_tax ?? baseIptu, 'baseIptuNum:', baseIptuNum);
    
    // Corrigido: Remoção da multiplicação indevida por 100
    const val = baseIptuNum > 0 ? Number((baseIptuNum / num).toFixed(2)) : 0;
    
    console.log('generateInstallments - calculated val:', val);
    const newInsts = Array.from({ length: num }).map(() => ({ due_date: '', value: val }));
    setTempIptu(prev => ({ ...prev, iptu_installments_count: num, iptu_installments: newInsts }));
  };

  const replicateFromInstallments = () => {
    if (tempIptu.payment_condition === 'IN_FULL_15_DISCOUNT') {
      const installmentTotal = (tempIptu.iptu_installments || []).reduce((acc, curr) => acc + Number(curr.value || 0), 0);
      if (installmentTotal > 0) {
        setTempIptu(prev => ({ ...prev, property_tax_cash: installmentTotal }));
      }
    }
    else if (tempIptu.payment_condition === 'SECOND_INSTALLMENT_10_DISCOUNT') {
      const installments = tempIptu.iptu_installments || [];
      if (installments.length >= 2) {
        setTempIptu(prev => ({
          ...prev,
          property_tax_first_installment: installments[0].value,
          property_tax_second_installment: installments[1].value
        }));
      }
    }
  };

  const replicateToAllInstallments = () => {
    const installments = tempIptu.iptu_installments || [];
    if (installments.length === 0) return;
    
    const firstInstallment = installments[0];
    const referenceValue = Number(firstInstallment.value) || 0;
    const referenceDate = firstInstallment.due_date;
    
    if (referenceValue <= 0 || !referenceDate) return;
    
    const newInstallments = installments.map((_, index) => {
      const date = new Date(referenceDate);
      date.setMonth(date.getMonth() + index);
      
      return {
        due_date: date.toISOString().split('T')[0],
        value: referenceValue
      };
    });
    
    setTempIptu(prev => ({ ...prev, iptu_installments: newInstallments }));
  };

  const shouldShowAlert = () => {
    if (baseIptu <= 0) return false;
    
    if (tempIptu.payment_condition === 'IN_FULL_15_DISCOUNT') {
      const val = Number(tempIptu.property_tax_cash);
      const expectedValue = baseIptu * 0.85; 
      const margin = baseIptu * 0.01; 
      return val < (expectedValue - margin) || val > (expectedValue + margin);
    }
    
    if (tempIptu.payment_condition === 'SECOND_INSTALLMENT_10_DISCOUNT') {
      const firstInstallment = Number(tempIptu.property_tax_first_installment);
      const secondInstallment = Number(tempIptu.property_tax_second_installment);
      
      if (!firstInstallment || firstInstallment <= 0 || !secondInstallment || secondInstallment <= 0) {
        return false; 
      }
      
      const totalActual = firstInstallment + secondInstallment;
      const totalExpected = baseIptu * 0.90;
      const margin = baseIptu * 0.02; 
      
      return totalActual < (totalExpected - margin) || totalActual > (totalExpected + margin);
    }
    
    if (tempIptu.payment_condition === 'INSTALLMENTS') {
      const installments = tempIptu.iptu_installments || [];
      if (installments.length === 0) return false;
      
      const allValuesPositive = installments.every(inst => Number(inst.value) > 0);
      if (!allValuesPositive) return false;
      
      const values = installments.map(inst => Number(inst.value));
      const uniqueValues = [...new Set(values)];
      
      if (uniqueValues.length === 1) return false;
      
      if (uniqueValues.length === 2) {
        const [value1, value2] = uniqueValues.sort((a, b) => a - b);
        const countValue1 = values.filter(v => v === value1).length;
        const countValue2 = values.filter(v => v === value2).length;
        
        const diff = Math.abs(value2 - value1);
        const maxDiff = Math.max(value1, value2) * 0.02; 
        
        if (diff <= maxDiff && (countValue1 === 1 || countValue2 === 1)) {
          return false; 
        }
      }
      
      return true;
    }
    
    return false;
  };

  const columns: ColumnDef[] = useMemo(() => {
    const baseColumns: ColumnDef[] = [
      { field: 'year', label: 'Ano', type: 'text' },
      { field: 'baseIptu', label: 'Valor Base IPTU', type: 'currency', formatter: 'currency' },
      { field: 'cota15', label: 'Cota 15%', type: 'currency', formatter: 'currency' },
      { field: 'venc_cota15', label: 'Venc. Cota 15%', type: 'text' },
      { field: 'parcela1', label: '1ª Parcela', type: 'currency', formatter: 'currency' },
      { field: 'venc_parcela1', label: 'Venc. 1ª Parc.', type: 'text' },
      { field: 'cota10', label: 'Cota 10%', type: 'currency', formatter: 'currency' },
      { field: 'venc_cota10', label: 'Venc. Cota 10%', type: 'text' },
    ];

    const maxInstallments = iptus.reduce((max, item) => {
      if (item.payment_condition === 'INSTALLMENTS') {
        const countFromField = Number(item.iptu_installments_count) || 0;
        const countFromArray = (item.iptu_installments || []).length;
        const totalItems = Math.max(countFromField, countFromArray);
        
        const existingForYear = iptus.find((other) => {
           return String(other.year) === String(item.year) &&
                  (other.payment_condition === 'IN_FULL_15_DISCOUNT' || 
                   other.payment_condition === 'SECOND_INSTALLMENT_10_DISCOUNT');
        });
        const startIdx = existingForYear ? 2 : 1;
        const highestParcela = startIdx + totalItems - 1;
        
        return Math.max(max, highestParcela);
      }
      return max;
    }, 0);

    for (let parcelaNum = 2; parcelaNum <= maxInstallments; parcelaNum++) {
      baseColumns.push({ field: `parcela${parcelaNum}`, label: `${parcelaNum}ª Parcela`, type: 'currency', formatter: 'currency' });
      baseColumns.push({ field: `vencimento${parcelaNum}`, label: `Venc. ${parcelaNum}ª Parc.`, type: 'text' });
    }

    return baseColumns;
  }, [iptus]);

  const tableData = useMemo(() => {
    const data = iptus.map((item, index) => {
      const row: any = {
        ...item,
        id: item.id || index.toString(),
        year: item.year,
        baseIptu: item.property_tax != null ? Number(item.property_tax) : 0,
      };

      if (item.payment_condition === 'IN_FULL_15_DISCOUNT') {
        row.cota15 = Number(item.property_tax_cash || 0);
        row.venc_cota15 = isoToDisplay(item.property_tax_cash_due_date);
      } 
      else if (item.payment_condition === 'SECOND_INSTALLMENT_10_DISCOUNT') {
        row.parcela1 = Number(item.property_tax_first_installment || 0);
        row.venc_parcela1 = isoToDisplay(item.property_tax_first_installment_due_date);
        
        row.cota10 = Number(item.property_tax_second_installment || 0);
        row.venc_cota10 = isoToDisplay(item.property_tax_second_installment_due_date);
      } 
      else if (item.payment_condition === 'INSTALLMENTS') {
        const installments = item.iptu_installments || [];
        const countFromField = Number(item.iptu_installments_count) || 0;
        const countFromArray = installments.length;
        const totalItems = Math.max(countFromField, countFromArray);
        
        const existingForYear = iptus.find((other) => {
           return String(other.year) === String(item.year) &&
                  (other.payment_condition === 'IN_FULL_15_DISCOUNT' || 
                   other.payment_condition === 'SECOND_INSTALLMENT_10_DISCOUNT');
        });
        const startIdx = existingForYear ? 2 : 1;
        
        for (let i = 0; i < totalItems; i++) {
          const parcelaNum = startIdx + i;
          if (parcelaNum === 1) {
             row.parcela1 = installments[i] ? Number(installments[i].value || 0) : null;
             row.venc_parcela1 = installments[i] ? isoToDisplay(installments[i].due_date) : null;
          } else {
             row[`parcela${parcelaNum}`] = installments[i] ? Number(installments[i].value || 0) : null;
             row[`vencimento${parcelaNum}`] = installments[i] ? isoToDisplay(installments[i].due_date) : null;
          }
        }
      }

      row._original = item;
      row._originalIndex = index;
      return row;
    });

    return data;
  }, [iptus]);

  // Aplicar ordenação aos dados
  const sortedTableData = useMemo(() => {
    if (!sortConfig || Object.keys(sortConfig).length === 0) {
      return tableData;
    }

    const sortField = Object.keys(sortConfig)[0];
    const sortOrder = sortConfig[sortField];

    return [...tableData].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      let comparison = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal), 'pt-BR');
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [tableData, sortConfig]);

  return (
    <div className="w-full space-y-6">
      {activeLease && (
        <div className="bg-brand/5 border border-brand/20 p-4 rounded-xl flex items-start gap-3">
          <Info className="text-brand shrink-0 mt-1" size={18} />
          <div>
            <p className="text-sm font-semibold text-brand">Imóvel com Locação Ativa - IPTU Vigente no Contrato</p>
            <p className="text-xs text-content-secondary">Locatário: {activeLease.tenant?.name} | Contrato: {activeLease.contract_number}</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {!readOnly && (
          <button type="button" onClick={() => openModal('add')} className="border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-content-muted hover:border-brand hover:text-brand hover:bg-brand/5 transition-all w-full">
            <Plus size={24} /> <span className="text-xs font-semibold mt-1">Lançar IPTU Anual</span>
          </button>
        )}
        <DynamicTableManager
          resource="iptu-property"
          title="IPTU"
          columns={columns}
          basePath=""
          enableCreate={false}
          enableView={false}
          enableDelete={true}
          localData={sortedTableData}
          onRowClick={() => {}}
          onEdit={(item) => {
            const originalIndex = item._originalIndex;
            openModal('edit', originalIndex);
          }}
          onDelete={(item) => {
            const originalIndex = item._originalIndex;
            handleRemove(originalIndex);
          }}
          onSortChange={setSortConfig}
        />
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b flex justify-between items-center bg-surface-subtle">
              <h3 className="font-bold flex items-center gap-2 text-content"><Landmark size={20} className="text-brand" /> {editingIndex !== null ? 'Editar' : 'Novo'} Lançamento Anual</h3>
              <X className="cursor-pointer text-content-muted" onClick={closeModal} />
            </div>
            <div className="p-6 overflow-y-auto space-y-5">

              <div className="p-4 bg-surface border border-ui-border rounded-lg flex items-center gap-4">
                <div className="p-2 bg-brand/10 text-brand rounded-full"><DollarSign size={20} /></div>
                <div className="flex-1">
                  <p className="text-[10px] text-content-muted uppercase font-bold tracking-tight">Valor Base do IPTU - Ano: {tempIptu.year}</p>
                  <input
                    type="text"
                    value={maskMoney(tempIptu.property_tax ?? 0)}
                    onChange={e => setTempIptu({ ...tempIptu, property_tax: parseMoney(e.target.value) })}
                    className="text-lg font-black text-content bg-transparent outline-none border-b border-dashed border-ui-border focus:border-brand w-full"
                    placeholder="R$ 0,00"
                  />
                </div>
              </div>

              {shouldShowAlert() && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-xs text-yellow-800 font-medium">
                    ⚠️ Atenção: Os valores informados devem corresponder aos valores reais do IPTU. Verifique os valores no carnê ou portal da prefeitura antes de confirmar.
                  </p>
                </div>
              )}

              {errorMsg && <div className="p-3 bg-red-50 text-state-error text-xs rounded-lg border border-red-200 font-medium">{errorMsg}</div>}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold mb-1.5 block text-content-secondary">Ano do Exercício</label>
                  <input type="number" value={tempIptu.year} onChange={e => setTempIptu({ ...tempIptu, year: e.target.value })} className="w-full p-2.5 border rounded-lg outline-none focus:border-brand text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold mb-1.5 block text-content-secondary">Condição de Pagamento</label>
                  <select value={tempIptu.payment_condition} onChange={e => setTempIptu({ ...tempIptu, payment_condition: e.target.value })} className="w-full p-2.5 border rounded-lg outline-none focus:border-brand text-sm bg-surface">
                    <option value="IN_FULL_15_DISCOUNT">Cota única 15%</option>
                    <option value="SECOND_INSTALLMENT_10_DISCOUNT">1ª parcela e 2ª cota com 10% de desconto</option>
                    <option value="INSTALLMENTS">Parcelado</option>
                  </select>
                </div>
              </div>

              {tempIptu.payment_condition === 'IN_FULL_15_DISCOUNT' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-bold block text-content-secondary">Valor Total</label>
                      {(tempIptu.iptu_installments || []).length > 0 && (
                        <button
                          type="button"
                          onClick={replicateFromInstallments}
                          className="text-xs px-2 py-1 bg-brand/10 text-brand rounded hover:bg-brand/20 transition-colors flex items-center gap-1"
                          title="Replicar valores do parcelado"
                        >
                          <Copy size={12} /> Replicar do Parcelado
                        </button>
                      )}
                    </div>
                    <input type="text" value={maskMoney(tempIptu.property_tax_cash ?? 0)} onChange={e => setTempIptu({ ...tempIptu, property_tax_cash: parseMoney(e.target.value) })} className="w-full p-2.5 border rounded-lg outline-none focus:border-brand text-sm" placeholder="R$ 0,00" />
                  </div>
                  <div>
                    <label className="text-xs font-bold mb-1.5 block text-content-secondary">Data de Vencimento</label>
                    <input type="date" value={tempIptu.property_tax_cash_due_date || ''} onChange={e => setTempIptu({ ...tempIptu, property_tax_cash_due_date: e.target.value })} className="w-full p-2.5 border rounded-lg outline-none focus:border-brand text-sm" />
                  </div>
                </div>
              )}

              {tempIptu.payment_condition === 'SECOND_INSTALLMENT_10_DISCOUNT' && (
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold block text-content-secondary">Valores das Parcelas</label>
                    {(tempIptu.iptu_installments || []).length >= 2 && (
                      <button
                        type="button"
                        onClick={replicateFromInstallments}
                        className="text-xs px-2 py-1 bg-brand/10 text-brand rounded hover:bg-brand/20 transition-colors flex items-center gap-1"
                        title="Replicar valores do parcelado"
                      >
                        <Copy size={12} /> Replicar do Parcelado
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold mb-1.5 block text-content-secondary">1ª Parcela</label>
                      <input type="text" value={maskMoney(tempIptu.property_tax_first_installment ?? 0)} onChange={e => setTempIptu({ ...tempIptu, property_tax_first_installment: parseMoney(e.target.value) })} className="w-full p-2.5 border rounded-lg outline-none focus:border-brand text-sm" placeholder="R$ 0,00" />
                      <label className="text-xs font-bold mb-1.5 block text-content-secondary mt-2">Vencimento 1ª Parcela</label>
                      <input type="date" value={tempIptu.property_tax_first_installment_due_date || ''} onChange={e => setTempIptu({ ...tempIptu, property_tax_first_installment_due_date: e.target.value })} className="w-full p-2.5 border rounded-lg outline-none focus:border-brand text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-bold mb-1.5 block text-content-secondary">2ª Cota com 10% de desconto.</label>
                      <input type="text" value={maskMoney(tempIptu.property_tax_second_installment ?? 0)} onChange={e => setTempIptu({ ...tempIptu, property_tax_second_installment: parseMoney(e.target.value) })} className="w-full p-2.5 border rounded-lg outline-none focus:border-brand text-sm" placeholder="R$ 0,00" />
                      <label className="text-xs font-bold mb-1.5 block text-content-secondary mt-2">Vencimento 2ª Cota</label>
                      <input type="date" value={tempIptu.property_tax_second_installment_due_date || ''} onChange={e => setTempIptu({ ...tempIptu, property_tax_second_installment_due_date: e.target.value })} className="w-full p-2.5 border rounded-lg outline-none focus:border-brand text-sm" />
                    </div>
                  </div>
                </div>
              )}

              {tempIptu.payment_condition === 'INSTALLMENTS' && (
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold block text-content-secondary flex items-center gap-2"><ListOrdered size={14} /> Qtd. Parcelas</label>
                    {(tempIptu.iptu_installments || []).length > 0 && (
                      <button
                        type="button"
                        onClick={replicateToAllInstallments}
                        disabled={!tempIptu.iptu_installments?.[0]?.due_date}
                        className={`text-xs px-2 py-1 rounded transition-colors flex items-center gap-1 ${
                          tempIptu.iptu_installments?.[0]?.due_date
                            ? 'bg-brand/10 text-brand hover:bg-brand/20 cursor-pointer'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                        }`}
                        title={tempIptu.iptu_installments?.[0]?.due_date ? 'Replicar valor e data para todas as parcelas' : 'Informe a data de vencimento da primeira parcela para habilitar'}
                      >
                        <Copy size={12} /> Replicar para Todas
                      </button>
                    )}
                  </div>
                  <input type="number" ref={installmentsCountRef} value={tempIptu.iptu_installments_count || ''} onChange={e => generateInstallments(e.target.value)} className="w-full p-2.5 border rounded-lg outline-none focus:border-brand text-sm mb-4" placeholder="Digite a quantidade" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto p-1 custom-scrollbar">
                    {tempIptu.iptu_installments?.map((inst, i) => (
                      <div key={i} className="p-3 border rounded-lg space-y-2 bg-surface-subtle">
                        <span className="text-[10px] font-bold text-brand">Parcela {i + getFirstInstallmentNumber()}</span>
                        <input type="text" value={maskMoney(inst.value ?? 0)} onChange={e => { const n = [...tempIptu.iptu_installments!]; n[i].value = parseMoney(e.target.value); setTempIptu({ ...tempIptu, iptu_installments: n }) }} className="text-xs p-2 border rounded w-full font-bold outline-none focus:border-brand" placeholder="R$ 0,00" />
                        <input type="date" value={inst.due_date} onChange={e => { const n = [...tempIptu.iptu_installments!]; n[i].due_date = e.target.value; setTempIptu({ ...tempIptu, iptu_installments: n }) }} className="text-xs p-2 border rounded w-full outline-none focus:border-brand" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="p-5 border-t bg-surface-subtle flex justify-end gap-3">
              <button type="button" onClick={closeModal} className="px-5 py-2 text-sm font-medium text-content-secondary">Cancelar</button>
              <button type="button" onClick={handleSave} className="px-8 py-2 bg-brand text-white rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg hover:bg-brand-hover active:scale-95 transition-all"><Check size={18} /> Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}