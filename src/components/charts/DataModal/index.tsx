'use client';

import { useMemo, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface ColumnConfig {
  key: string;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  format?: (value: any) => string | ReactNode;
  width?: string;
}

interface DataModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  columns?: ColumnConfig[] | string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const COLUMN_LABEL_MAP: Record<string, string> = {
  id: 'ID',
  title: 'Título',
  name: 'Nome',
  email: 'E-mail',
  type: 'Tipo',
  rentalValue: 'Valor Aluguel',
  saleValue: 'Valor Venda',
  purchaseValue: 'Valor Aquisição',
  propertyTax: 'IPTU',
  condoFee: 'Condomínio',
  totalTaxAndCondo: 'Total Taxas',
  areaTotal: 'Área Total (m²)',
  documentCount: 'Qtd. Documentos',
  status: 'Status',
  currentStatus: 'Status',
  createdAt: 'Data Criação',
  tradeName: 'Nome Fantasia',
  legalName: 'Razão Social',
  agency: 'Imobiliária',
  propertiesCount: 'Qtd. Propriedades',
};

const MONETARY_KEYS = new Set([
  'rentalValue', 'saleValue', 'purchaseValue', 'propertyTax', 'condoFee', 'totalTaxAndCondo',
]);

const STATUS_LABEL_MAP: Record<string, string> = {
  AVAILABLE: 'Disponível',
  RENTED: 'Alugado',
  OCCUPIED: 'Ocupado',
  SOLD: 'Vendido',
  MAINTENANCE: 'Manutenção',
  UNAVAILABLE: 'Indisponível',
};

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}/;

function toColumnLabel(key: string): string {
  return COLUMN_LABEL_MAP[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

function toColumnConfig(key: string): ColumnConfig {
  return { key, label: toColumnLabel(key), width: 'auto' };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatCellValue(value: any, key?: string): string {
  if (value === null || value === undefined) return '-';

  if (key === 'agency' && typeof value === 'object') {
    return value?.tradeName ?? value?.legalName ?? value?.name ?? '-';
  }

  if ((key === 'status' || key === 'currentStatus') && typeof value === 'string') {
    return STATUS_LABEL_MAP[value] ?? value;
  }

  if (typeof value === 'number') {
    if (key && MONETARY_KEYS.has(key)) {
      return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return value.toLocaleString('pt-BR');
  }

  if (typeof value === 'string' && DATE_REGEX.test(value)) {
    try {
      return new Date(value).toLocaleDateString('pt-BR');
    } catch {
      return value;
    }
  }

  return String(value);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DataModal({ isOpen, onClose, title, data, columns }: DataModalProps) {
  // Trava o scroll da página por baixo do modal enquanto ele está aberto,
  // restaurando o valor original ao fechar (sem isso, a página some por trás
  // do overlay mas continua rolando junto com o mouse/teclado).
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const normalizedColumns = useMemo<ColumnConfig[]>(() => {
    if (!columns) {
      return data.length > 0
        ? Object.keys(data[0])
            .filter((key) => !key.startsWith('_'))
            .map(toColumnConfig)
        : [];
    }

    if (!Array.isArray(columns) || columns.length === 0) return [];

    return typeof columns[0] === 'string'
      ? (columns as string[]).map(toColumnConfig)
      : (columns as ColumnConfig[]);
  }, [columns, data]);

  const renderCell = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (col: ColumnConfig, row: any) =>
      col.format ? col.format(row[col.key]) : formatCellValue(row[col.key], col.key),
    [],
  );

  if (typeof document === 'undefined') return null;

  return createPortal(
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
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-ui-border-soft">
              <h3 className="text-xl font-semibold text-content">
                {title} — Detalhes ({data.length} itens)
              </h3>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-surface-subtle transition-colors text-content-muted hover:text-content-secondary"
                title="Fechar"
                aria-label="Fechar modal"
              >
                <X size={20} />
              </button>
            </div>

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
                        {normalizedColumns.map((col) => (
                          <th
                            key={col.key}
                            className="px-6 py-3 text-left text-xs font-medium text-content-muted uppercase tracking-wider"
                            style={{ width: col.width ?? 'auto' }}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-surface divide-y divide-ui-border-soft">
                      {data.map((row, idx) => (
                        <tr key={row.id ?? idx} className="hover:bg-surface-subtle">
                          {normalizedColumns.map((col) => (
                            <td
                              key={col.key}
                              className="px-6 py-4 whitespace-nowrap text-sm text-content-muted"
                            >
                              {renderCell(col, row)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center mt-4 pt-4 border-t border-ui-border-soft">
              <span className="text-sm text-content-muted">Total: {data.length} registros</span>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-brand text-content-inverse rounded-lg hover:bg-brand-hover transition-colors text-sm font-medium"
              >
                Fechar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
