/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ReactNode } from "react";

interface ColumnConfig {
  key: string;
  label: string;
  format?: (value: any) => string | ReactNode;
  width?: string;
}

interface DataModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data: any[];
  columns?: ColumnConfig[] | string[];
}

export default function DataModal({ isOpen, onClose, title, data, columns }: DataModalProps) {
  // Transforma strings em ColumnConfig se necessário
  const normalizedColumns: ColumnConfig[] = (() => {
    if (!columns) {
      return data.length > 0 
        ? Object.keys(data[0])
            .filter(key => !key.startsWith('_'))
            .map(key => ({ 
              key, 
              label: formatColumnName(key),
              width: 'auto'
            })) 
        : [];
    }
    
    if (Array.isArray(columns) && columns.length > 0) {
      if (typeof columns[0] === 'string') {
        // Se for array de strings
        return (columns as string[]).map(key => ({
          key,
          label: formatColumnName(key),
          width: 'auto'
        }));
      } else {
        // Já é array de ColumnConfig
        return columns as ColumnConfig[];
      }
    }
    
    return [];
  })();

  // Função para formatar valor padrão
  const formatCellValue = (value: any, key?: string) => {
    if (value === null || value === undefined) return "-";
    
    // Se for objeto de agência
    if (key === 'agency' && typeof value === 'object') {
      return value?.tradeName || value?.legalName || value?.name || "-";
    }
    
    // Se for objeto de status
    if ((key === 'status' || key === 'currentStatus') && typeof value === 'string') {
      const statusMap: Record<string, string> = {
        'AVAILABLE': 'Disponível',
        'RENTED': 'Alugado',
        'OCCUPIED': 'Ocupado',
        'SOLD': 'Vendido',
        'MAINTENANCE': 'Manutenção',
        'UNAVAILABLE': 'Indisponível',
      };
      return statusMap[value] || value;
    }
    
    // Se for número (provavelmente valor monetário)
    if (typeof value === 'number') {
      // Verifica se é uma coluna de valor
      const valueKeys = ['rentalValue', 'saleValue', 'purchaseValue', 'propertyTax', 'condoFee', 'totalTaxAndCondo'];
      if (key && valueKeys.includes(key)) {
        return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
      return value.toLocaleString("pt-BR");
    }
    
    if (typeof value === 'string') {
      // Verifica se é data
      if (value.match(/^\d{4}-\d{2}-\d{2}/)) {
        try {
          return new Date(value).toLocaleDateString("pt-BR");
        } catch {
          return value;
        }
      }
      return value;
    }
    
    return String(value);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/70 z-50 flex justify-center items-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-surface rounded-2xl p-6 relative w-full max-w-6xl h-[90vh] flex flex-col"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-content">
                {title} - Detalhes ({data.length} itens)
              </h3>
              <button
                onClick={onClose}
                className="p-2 rounded-full bg-slate-200 hover:bg-slate-300 transition"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto">
              {data.length === 0 ? (
                <div className="flex justify-center items-center h-full text-content-muted">
                  Nenhum dado disponível
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-ui-border-soft">
                    <thead className="bg-surface-subtle sticky top-0">
                      <tr>
                        {normalizedColumns.map((column) => (
                          <th
                            key={column.key}
                            className="px-6 py-3 text-left text-xs font-medium text-content-muted uppercase tracking-wider"
                            style={{ width: column.width || 'auto' }}
                          >
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-surface divide-y divide-ui-border-soft">
                      {data.map((item, index) => (
                        <tr key={item.id || index} className="hover:bg-surface-subtle">
                          {normalizedColumns.map((column) => (
                            <td
                              key={column.key}
                              className="px-6 py-4 whitespace-nowrap text-sm text-content-muted"
                            >
                              {column.format 
                                ? column.format(item[column.key]) 
                                : formatCellValue(item[column.key], column.key)
                              }
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-ui-border-soft">
              <span className="text-sm text-content-muted">
                Total: {data.length} registros
              </span>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Fechar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Função auxiliar para formatar nome da coluna
function formatColumnName(column: string): string {
  const columnMap: Record<string, string> = {
    id: "ID",
    title: "Título",
    name: "Nome",
    email: "E-mail",
    type: "Tipo",
    rentalValue: "Valor Aluguel",
    saleValue: "Valor Venda",
    purchaseValue: "Valor Aquisição",
    propertyTax: "IPTU",
    condoFee: "Condomínio",
    totalTaxAndCondo: "Total Taxas",
    areaTotal: "Área Total (m²)",
    documentCount: "Qtd. Documentos",
    status: "Status",
    currentStatus: "Status",
    createdAt: "Data Criação",
    tradeName: "Nome Fantasia",
    legalName: "Razão Social",
    agency: "Imobiliária",
    propertiesCount: "Qtd. Propriedades",
  };
  
  return columnMap[column] || column.charAt(0).toUpperCase() + column.slice(1);
}