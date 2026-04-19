/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useCallback, useMemo } from "react";
import { X, CreditCard, Calendar, DollarSign, Search, ChevronLeft, ChevronRight } from "lucide-react";
import type { Option } from "@/types/types";

// Format currency to BRL
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

// Parse month/year input
const parseMonthYear = (value: string): { month: number; year: number } | null => {
  const match = value.match(/^(\d{2})\/(\d{4})$/);
  if (!match) return null;
  return {
    month: parseInt(match[1], 10),
    year: parseInt(match[2], 10),
  };
};

// Mask month/year input (MM/YYYY)
const maskMonthYear = (value: string): string => {
  const numeric = value.replace(/\D/g, '');
  if (numeric.length <= 2) return numeric;
  return `${numeric.slice(0, 2)}/${numeric.slice(2, 6)}`;
};

// Mask date input (DD/MM/YYYY)
const maskDate = (value: string): string => {
  const numeric = value.replace(/\D/g, '');
  if (numeric.length <= 2) return numeric;
  if (numeric.length <= 4) return `${numeric.slice(0, 2)}/${numeric.slice(2, 4)}`;
  return `${numeric.slice(0, 2)}/${numeric.slice(2, 4)}/${numeric.slice(4, 8)}`;
};

// Convert DD/MM/YYYY to YYYY-MM-DD for backend
const parseDateToBackend = (value: string): string | null => {
  const parts = value.split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  if (!day || !month || !year || year.length !== 4) return null;
  return `${year}-${month}-${day}`;
};

interface Invoice {
  id: string;
  cardId: string;
  month: number;
  year: number;
  totalAmount: number;
  status: "PENDING" | "COMPLETED";
  closingDate: string;
  dueDate: string;
  transactions: any[];
}

interface CardDetails extends Option {
  brand?: string;
  limit?: number;
  currentBalance?: number;
}

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards: CardDetails[];
  institutions: Option[];
  onSearchInvoice: (cardId: string, month: number, year: number) => Promise<Invoice | null>;
  onUpdateStatus?: (invoiceId: string, status: string, data: { institution_id?: string; effective_date?: string }) => Promise<void>;
}

export default function InvoiceModal({
  isOpen,
  onClose,
  cards,
  institutions,
  onSearchInvoice,
  onUpdateStatus,
}: InvoiceModalProps) {
  const [selectedCard, setSelectedCard] = useState<string>("");
  const [monthYear, setMonthYear] = useState<string>("");
  const [isSearching, setIsSearching] = useState(false);
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(null);
  const [status, setStatus] = useState<string>("PENDING");
  const [institution, setInstitution] = useState<string>("");
  const [effectiveDate, setEffectiveDate] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedCardDetails = useMemo(() => {
    return cards.find((c) => c.value === selectedCard);
  }, [selectedCard, cards]);

  const handleSearch = async () => {
    console.log('🔍 handleSearch chamado:', { selectedCard, monthYear });
    if (!selectedCard || !monthYear) {
      console.log('❌ selectedCard ou monthYear vazio');
      return;
    }
    
    const parsed = parseMonthYear(monthYear);
    console.log('📅 Data parseada:', parsed);
    if (!parsed) {
      console.log('❌ Formato de data inválido');
      return;
    }

    setIsSearching(true);
    try {
      console.log('📡 Chamando onSearchInvoice...');
      const data: any = await onSearchInvoice(selectedCard, parsed.month, parsed.year);
      console.log('✅ Resultado bruto:', data);
      
      // Mapear dados do backend (snake_case) para interface (camelCase)
      if (data) {
        const invoice: Invoice = {
          id: data.id,
          cardId: data.card_id,
          month: data.month,
          year: data.year,
          totalAmount: parseFloat(data.total_amount) || 0,
          status: data.status,
          closingDate: data.closing_date,
          dueDate: data.due_date,
          transactions: data.transactions || []
        };
        console.log('📝 Invoice mapeada:', invoice);
        setCurrentInvoice(invoice);
        setStatus(invoice.status === "COMPLETED" ? "COMPLETED" : "PENDING");
      } else {
        setCurrentInvoice(null);
      }
    } catch (error) {
      console.error("❌ Error searching invoice:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!currentInvoice || !onUpdateStatus) return;
    
    setIsSubmitting(true);
    try {
      // Enviar status direto (PENDING/COMPLETED) - backend usa TransactionStatus
      const backendDate = effectiveDate ? (parseDateToBackend(effectiveDate) || undefined) : undefined;
      
      await onUpdateStatus(currentInvoice.id, status, {
        institution_id: institution || undefined,
        effective_date: backendDate,
      });
      // Fechar modal e atualizar dados
      onClose();
    } catch (error) {
      console.error("Error updating status:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = useCallback(() => {
    onClose();
    setTimeout(() => {
      setSelectedCard("");
      setMonthYear("");
      setCurrentInvoice(null);
      setStatus("PENDING");
      setInstitution("");
      setEffectiveDate("");
    }, 300);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-surface rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4 border border-ui-border-soft">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-ui-border-soft">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-brand" />
            <h2 className="text-lg font-semibold text-content">
              Gerenciar Faturas dos Cartões
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 hover:bg-surface-subtle rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-content-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Search Section */}
          <div className="grid grid-cols-12 gap-4">
            {/* Card Select */}
            <div className="col-span-5 space-y-1">
              <label className="text-sm font-medium text-content-secondary">
                Cartão de crédito *
              </label>
              <select
                value={selectedCard}
                onChange={(e) => setSelectedCard(e.target.value)}
                className="w-full px-3 py-2 border border-ui-border rounded-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none text-sm bg-surface text-content"
              >
                <option value="">Selecione</option>
                {cards.map((card) => (
                  <option key={card.value} value={card.value}>
                    {card.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Month/Year Input */}
            <div className="col-span-5 space-y-1">
              <label className="text-sm font-medium text-content-secondary">
                Mês/Ano *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={monthYear}
                  onChange={(e) => setMonthYear(maskMonthYear(e.target.value))}
                  placeholder="MM/YYYY"
                  maxLength={7}
                  className="w-full px-3 py-2 border border-ui-border rounded-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none text-sm bg-surface text-content placeholder:text-content-placeholder"
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted pointer-events-none" />
              </div>
            </div>

            {/* Search Button */}
            <div className="col-span-2 flex items-end">
              <button
                onClick={handleSearch}
                disabled={!selectedCard || !monthYear || isSearching}
                className="w-full py-2 px-3 bg-brand hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center"
              >
                {isSearching ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Invoice Total Card */}
          {currentInvoice && (
            <div className="p-6 bg-surface-subtle rounded-xl border border-ui-border-soft text-center">
              <p className="text-sm font-medium text-content-secondary mb-3">
                Valor total da fatura
              </p>
              <p className="text-4xl font-bold text-content">
                {formatCurrency(currentInvoice.totalAmount)}
              </p>
            </div>
          )}

          {/* Transactions List - If invoice exists */}
          {currentInvoice && currentInvoice.transactions.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-content-secondary uppercase tracking-wide">
                Lançamentos na fatura
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {currentInvoice.transactions.map((transaction, index) => (
                  <div
                    key={transaction.id || index}
                    className="p-3 bg-surface-subtle rounded-lg border border-ui-border-soft flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-content">
                        {transaction.description || "Sem descrição"}
                      </p>
                      <p className="text-xs text-content-muted">
                        {transaction.category?.name || "Sem categoria"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-content">
                        {formatCurrency(transaction.amount || 0)}
                      </p>
                      <p className="text-xs text-content-muted">
                        {transaction.installment_number
                          ? `Parcela ${transaction.installment_number}/${transaction.total_installments}`
                          : "À vista"
                        }
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Update Section - Only when invoice exists */}
          {currentInvoice && onUpdateStatus && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-content-secondary uppercase tracking-wide">
                Atualizar lançamentos
              </h3>

              <div className="grid grid-cols-3 gap-4">
                {/* Institution */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-content-secondary flex items-center gap-1">
                    Inst. Financeira
                    <span className="text-content-muted" title="Instituição para pagamento">ⓘ</span>
                  </label>
                  <select
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    className="w-full px-3 py-2 border border-ui-border rounded-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none text-sm bg-surface text-content"
                  >
                    <option value="">Selecione</option>
                    {institutions?.map((inst) => (
                      <option key={inst.value} value={inst.value}>
                        {inst.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-content-secondary">
                    Status *
                  </label>
                  <div className="flex rounded-lg overflow-hidden border border-ui-border">
                    <button
                      type="button"
                      onClick={() => setStatus("PENDING")}
                      className={`flex-1 py-2 px-3 text-xs font-medium transition-colors ${
                        status === "PENDING"
                          ? "bg-state-error text-white"
                          : "bg-surface text-content-secondary hover:bg-surface-subtle"
                      }`}
                    >
                      Pendente
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus("COMPLETED")}
                      className={`flex-1 py-2 px-3 text-xs font-medium transition-colors ${
                        status === "COMPLETED"
                          ? "bg-state-success text-white"
                          : "bg-surface text-content-secondary hover:bg-surface-subtle"
                      }`}
                    >
                      Concluído
                    </button>
                  </div>
                </div>

                {/* Effective Date */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-content-secondary">
                    Data de Efetivação
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={effectiveDate}
                      onChange={(e) => setEffectiveDate(maskDate(e.target.value))}
                      placeholder="dd/mm/aaaa"
                      maxLength={10}
                      className="w-full px-3 py-2 border border-ui-border rounded-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none text-sm bg-surface text-content placeholder:text-content-placeholder"
                    />
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleUpdateStatus}
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-brand hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Atualizando...
                  </span>
                ) : (
                  "Atualizar Status"
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
