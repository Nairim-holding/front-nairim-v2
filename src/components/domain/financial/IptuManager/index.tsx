/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Edit2, X, Calendar, Check, Landmark, DollarSign, ListOrdered, Info, Copy } from 'lucide-react';
import { maskMoney } from '@/utils';
import { formatMoney, parseMoney } from '@/app/dashboard/(cadastro)/imoveis/_lib/propertyTransform';
import DynamicTableManager from '@/components/table/DataTable';
import { ColumnDef } from '@/types/types';

interface IptuInstallment {
  due_date: string;
  value: string | number;
}

interface IptuEntry {
  id?: string;
  year: string | number;
  payment_condition: string;
  property_tax_cash?: string | number | null;
  property_tax_first_installment?: string | number | null;
  property_tax_second_installment?: string | number | null;
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

  const [tempIptu, setTempIptu] = useState<IptuEntry>({
    year: new Date().getFullYear().toString(),
    payment_condition: 'IN_FULL_15_DISCOUNT',
  });

  useEffect(() => {
    const valueArray = Array.isArray(value) ? value : [];
    console.log('IPTU Manager - Dados recebidos do back-end:', valueArray);
    if (JSON.stringify(valueArray) !== JSON.stringify(iptus)) {
      setIptus(valueArray);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const getConditionLabel = (condition: string) => {
    switch (condition) {
      case 'IN_FULL_15_DISCOUNT': return 'Cota única 15%';
      case 'SECOND_INSTALLMENT_10_DISCOUNT': return '1ª parcela e 2ª cota com 10% de desconto';
      case 'INSTALLMENTS': return 'Parcelado';
      default: return condition;
    }
  };

  const openModal = (mode: 'add' | 'edit', index?: number) => {
    if (readOnly) return;
    setErrorMsg('');

    if (mode === 'edit' && index !== undefined) {
      setEditingIndex(index);
      setTempIptu({ ...iptus[index] });
    } else {
      setEditingIndex(null);
      setTempIptu({
        year: new Date().getFullYear().toString(),
        payment_condition: 'IN_FULL_15_DISCOUNT',
        property_tax_cash: '',
        property_tax_first_installment: '',
        property_tax_second_installment: '',
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
    if (baseIptu <= 0) return setErrorMsg('Preencha o Valor Base do IPTU primeiro.');

    const yearValue = Number(tempIptu.year);
    const currentYear = new Date().getFullYear();

    if (!tempIptu.year) return setErrorMsg('O Ano do Exercício é obrigatório.');
    if (yearValue < currentYear - 5 || yearValue > currentYear + 5) {
      return setErrorMsg(`O ano deve estar entre ${currentYear - 5} e ${currentYear + 5}.`);
    }

    if (tempIptu.payment_condition === 'IN_FULL_15_DISCOUNT') {
      const val = Number(tempIptu.property_tax_cash);
      if (!val || val <= 0) return setErrorMsg('Informe o valor.');
    }
    else if (tempIptu.payment_condition === 'SECOND_INSTALLMENT_10_DISCOUNT') {
      const firstInstallment = Number(tempIptu.property_tax_first_installment);
      const secondInstallment = Number(tempIptu.property_tax_second_installment);
      if (!firstInstallment || firstInstallment <= 0) return setErrorMsg('Informe o valor da 1ª parcela.');
      if (!secondInstallment || secondInstallment <= 0) return setErrorMsg('Informe o valor da 2ª parcela.');
    }
    else if (tempIptu.payment_condition === 'INSTALLMENTS') {
      const sum = (tempIptu.iptu_installments || []).reduce((acc, curr) => acc + Number(curr.value || 0), 0);
      if (sum <= 0) return setErrorMsg('Informe os valores das parcelas.');
    }

    const newIptus = [...iptus];
    if (editingIndex !== null) {
      newIptus[editingIndex] = { ...tempIptu };
    } else {
      newIptus.push({ ...tempIptu });
    }

    newIptus.sort((a, b) => Number(b.year) - Number(a.year));
    setIptus(newIptus);
    console.log('IPTU Manager - Dados enviados para o back-end:', newIptus);
    if (onChange) onChange(newIptus);
    closeModal();
  };

  const handleRemove = (index: number) => {
    if (readOnly) return;
    const newIptus = iptus.filter((_, i) => i !== index);
    setIptus(newIptus);
    if (onChange) onChange(newIptus);
  };

  const generateInstallments = (count: string | number) => {
    const num = parseInt(String(count));
    if (isNaN(num) || num <= 0) return setTempIptu(prev => ({ ...prev, iptu_installments: [] }));
    const val = baseIptu > 0 ? (baseIptu / num).toFixed(2) : '';
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
    
    // Pega o valor e data da primeira parcela como referência
    const firstInstallment = installments[0];
    const referenceValue = Number(firstInstallment.value) || 0;
    const referenceDate = firstInstallment.due_date;
    
    if (referenceValue <= 0 || !referenceDate) return;
    
    // Cria novas parcelas replicando o valor e incrementando as datas
    const newInstallments = installments.map((_, index) => {
      const date = new Date(referenceDate);
      date.setMonth(date.getMonth() + index); // Incrementa +1 mês para cada parcela
      
      return {
        due_date: date.toISOString().split('T')[0], // Formata YYYY-MM-DD
        value: referenceValue.toString()
      };
    });
    
    setTempIptu(prev => ({ ...prev, iptu_installments: newInstallments }));
  };

  const shouldShowAlert = () => {
    if (baseIptu <= 0) return false;
    
    if (tempIptu.payment_condition === 'IN_FULL_15_DISCOUNT') {
      const val = Number(tempIptu.property_tax_cash);
      const expectedValue = baseIptu * 0.85; // 15% de desconto
      const margin = baseIptu * 0.01; // 1% de margem para maior precisão
      return val < (expectedValue - margin) || val > (expectedValue + margin);
    }
    
    if (tempIptu.payment_condition === 'SECOND_INSTALLMENT_10_DISCOUNT') {
      const firstInstallment = Number(tempIptu.property_tax_first_installment);
      const secondInstallment = Number(tempIptu.property_tax_second_installment);
      
      // Verifica se os valores são positivos
      if (!firstInstallment || !secondInstallment || firstInstallment <= 0 || secondInstallment <= 0) {
        return false; // Não mostra alerta se valores não foram preenchidos
      }
      
      // Para 2 parcelas com 10% de desconto apenas na segunda parcela:
      // 1ª parcela: 50% do valor base (sem descontoss)
      // 2ª parcela: 40% do valor base (50% - 10% de desconto)
      // Total: 90% do valor base
      const totalActual = firstInstallment + secondInstallment;
      const totalExpected = baseIptu * 0.90;
      const margin = baseIptu * 0.02; // 2% de margem para acomodar variações
      
      // Verifica se o total está dentro da margem esperada
      return totalActual < (totalExpected - margin) || totalActual > (totalExpected + margin);
    }
    
    if (tempIptu.payment_condition === 'INSTALLMENTS') {
      const installments = tempIptu.iptu_installments || [];
      if (installments.length === 0) return false;
      
      // Verifica se todos os valores são positivos
      const allValuesPositive = installments.every(inst => Number(inst.value) > 0);
      if (!allValuesPositive) return false;
      
      // Para parcelado, o padrão esperado é que a maioria das parcelas tenha o mesmo valor
      // e a última parcela possa ter um valor ligeiramente diferente para ajustar o total
      
      const values = installments.map(inst => Number(inst.value));
      const uniqueValues = [...new Set(values)];
      
      // Se todas as parcelas têm o mesmo valor, isso é aceitável
      if (uniqueValues.length === 1) return false;
      
      // Se há exatamente 2 valores diferentes, verificar se corresponde ao padrão esperado
      if (uniqueValues.length === 2) {
        const [value1, value2] = uniqueValues.sort((a, b) => a - b);
        const countValue1 = values.filter(v => v === value1).length;
        const countValue2 = values.filter(v => v === value2).length;
        
        // Verifica se o padrão é: maioria das parcelas com um valor, última parcela com valor diferente
        // Exemplo: 9 parcelas de R$ 62,99 e 1 parcela de R$ 63,07
        const diff = Math.abs(value2 - value1);
        const maxDiff = Math.max(value1, value2) * 0.02; // 2% de diferença máxima permitida
        
        // Se a diferença é pequena e há apenas uma parcela com valor diferente, é aceitável
        if (diff <= maxDiff && (countValue1 === 1 || countValue2 === 1)) {
          return false; // Não mostra alerta - padrão correto
        }
      }
      
      // Para qualquer outra combinação, mostra o alerta
      return true;
    }
    
    return false;
  };

  // Define column structure for IPTU table
  const columns: ColumnDef[] = useMemo(() => [
    { field: 'year', label: 'Ano', type: 'text' },
    { field: 'baseIptu', label: 'Valor do IPTU', type: 'currency', formatter: 'currency' },
    { field: 'cota15', label: 'Cota 15% de desconto', type: 'currency', formatter: 'currency' },
    { field: 'cota10', label: 'Cota 10% de desconto', type: 'currency', formatter: 'currency' },
    { field: 'vencimento1', label: 'Venc. 1º', type: 'text' },
    { field: 'parcela1', label: '1º parcela', type: 'currency', formatter: 'currency' },
    { field: 'vencimento2', label: 'Venc. 2º', type: 'text' },
    { field: 'parcela2', label: '2º parcela', type: 'currency', formatter: 'currency' },
    { field: 'vencimento3', label: 'Venc. 3º', type: 'text' },
    { field: 'parcela3', label: '3º parcela', type: 'currency', formatter: 'currency' },
    { field: 'vencimento4', label: 'Venc. 4º', type: 'text' },
    { field: 'parcela4', label: '4º parcela', type: 'currency', formatter: 'currency' },
    { field: 'vencimento5', label: 'Venc. 5º', type: 'text' },
    { field: 'parcela5', label: '5º parcela', type: 'currency', formatter: 'currency' },
    { field: 'vencimento6', label: 'Venc. 6º', type: 'text' },
    { field: 'parcela6', label: '6º parcela', type: 'currency', formatter: 'currency' },
    { field: 'vencimento7', label: 'Venc. 7º', type: 'text' },
    { field: 'parcela7', label: '7º parcela', type: 'currency', formatter: 'currency' },
    { field: 'vencimento8', label: 'Venc. 8º', type: 'text' },
    { field: 'parcela8', label: '8º parcela', type: 'currency', formatter: 'currency' },
    { field: 'vencimento9', label: 'Venc. 9º', type: 'text' },
    { field: 'parcela9', label: '9º parcela', type: 'currency', formatter: 'currency' },
    { field: 'vencimento10', label: 'Venc. 10º', type: 'text' },
    { field: 'parcela10', label: '10º parcela', type: 'currency', formatter: 'currency' },
  ], []);

  // Transform IPTU data to flat format for table
  const tableData = useMemo(() => {
    return iptus.map((item, index) => {
      const cota15 = item.payment_condition === 'IN_FULL_15_DISCOUNT' ? item.property_tax_cash : null;
      const cota10 = item.payment_condition === 'SECOND_INSTALLMENT_10_DISCOUNT'
        ? (Number(item.property_tax_first_installment || 0) + Number(item.property_tax_second_installment || 0))
        : null;

      const installments = item.iptu_installments || [];
      const row: any = {
        id: item.id || index.toString(),
        year: item.year,
        baseIptu: baseIptu,
        cota15: cota15,
        cota10: cota10,
      };

      // Add installment columns with due dates - for SECOND_INSTALLMENT_10_DISCOUNT, use the individual installment values
      if (item.payment_condition === 'SECOND_INSTALLMENT_10_DISCOUNT') {
        row.parcela1 = item.property_tax_first_installment || null;
        row.parcela2 = item.property_tax_second_installment || null;
        row.vencimento1 = installments[0]?.due_date ? new Date(installments[0].due_date).toLocaleDateString('pt-BR') : null;
        row.vencimento2 = installments[1]?.due_date ? new Date(installments[1].due_date).toLocaleDateString('pt-BR') : null;
        for (let i = 3; i <= 10; i++) {
          row[`parcela${i}`] = null;
          row[`vencimento${i}`] = null;
        }
      } else {
        // For other conditions, use installments array with due dates
        for (let i = 1; i <= 10; i++) {
          row[`parcela${i}`] = installments[i - 1]?.value || null;
          row[`vencimento${i}`] = installments[i - 1]?.due_date 
            ? new Date(installments[i - 1].due_date).toLocaleDateString('pt-BR') 
            : null;
        }
      }

      // Store original data and index for edit/delete
      row._original = item;
      row._originalIndex = index;

      return row;
    });
  }, [iptus, baseIptu]);

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
          resource="iptu"
          title="IPTU"
          columns={columns}
          basePath=""
          enableCreate={false}
          enableView={false}
          enableEdit={false}
          enableDelete={false}
          localData={tableData}
          onRowClick={() => {}}
          onEdit={(item, index) => {
            const originalIndex = item._originalIndex;
            openModal('edit', originalIndex);
          }}
          onDelete={(item, index) => {
            const originalIndex = item._originalIndex;
            handleRemove(originalIndex);
          }}
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
                  <p className="text-lg font-black text-content">{formatMoney(baseIptu)}</p>
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
                    </div>
                    <div>
                      <label className="text-xs font-bold mb-1.5 block text-content-secondary">2ª Parcela</label>
                      <input type="text" value={maskMoney(tempIptu.property_tax_second_installment ?? 0)} onChange={e => setTempIptu({ ...tempIptu, property_tax_second_installment: parseMoney(e.target.value) })} className="w-full p-2.5 border rounded-lg outline-none focus:border-brand text-sm" placeholder="R$ 0,00" />
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
                        className="text-xs px-2 py-1 bg-brand/10 text-brand rounded hover:bg-brand/20 transition-colors flex items-center gap-1"
                        title="Replicar valor e data para todas as parcelas"
                      >
                        <Copy size={12} /> Replicar para Todas
                      </button>
                    )}
                  </div>
                  <input type="number" value={tempIptu.iptu_installments_count || '0'} onChange={e => generateInstallments(e.target.value)} className="w-full p-2.5 border rounded-lg outline-none focus:border-brand text-sm mb-4" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto p-1 custom-scrollbar">
                    {tempIptu.iptu_installments?.map((inst, i) => (
                      <div key={i} className="p-3 border rounded-lg space-y-2 bg-surface-subtle">
                        <span className="text-[10px] font-bold text-brand">Parcela {i + 1}</span>
                        <input type="date" value={inst.due_date} onChange={e => { const n = [...tempIptu.iptu_installments!]; n[i].due_date = e.target.value; setTempIptu({ ...tempIptu, iptu_installments: n }) }} className="text-xs p-2 border rounded w-full outline-none focus:border-brand" />
                        <input type="text" value={maskMoney(inst.value ?? 0)} onChange={e => { const n = [...tempIptu.iptu_installments!]; n[i].value = parseMoney(e.target.value); setTempIptu({ ...tempIptu, iptu_installments: n }) }} className="text-xs p-2 border rounded w-full font-bold outline-none focus:border-brand" />
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