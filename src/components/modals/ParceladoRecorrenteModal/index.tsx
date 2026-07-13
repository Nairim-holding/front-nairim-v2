/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useCallback, useMemo } from "react";
import { X, RefreshCw, Layers } from "lucide-react";
import type { Option } from "@/types/types";
import QuickCreateAutocomplete from "@/components/ui/QuickCreateAutocomplete";

// Função de máscara monetária para formatar enquanto digita
const formatCurrencyInput = (value: string): string => {
  if (!value) return '';
  
  // Remove tudo que não é dígito
  const numericValue = value.replace(/\D/g, "");
  
  if (!numericValue) return '';
  
  // Converte para número
  const numberValue = parseFloat(numericValue) / 100;
  
  // Formata como moeda brasileira
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numberValue);
};

// Extrai valor numérico do valor formatado em pt-BR (para enviar à API)
const extractNumericValue = (formattedValue: string): number => {
  if (!formattedValue) return 0;
  // Remove R$ e espaços
  const cleaned = formattedValue.replace(/[R$\s]/g, '');
  // Remove separador de milhar (ponto) e substitui vírgula por ponto (decimal)
  const normalized = cleaned.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(normalized);
  return isNaN(num) ? 0 : num;
};

interface FormOptions {
  institutions: Option[];
  incomeCategories: Option[];
  expenseCategories: Option[];
  centers: (Option & { type?: string })[];
  suppliers: Option[];
  cards: Option[];
  subcategories: { [categoryId: string]: Option[] };
}

interface ParceladoRecorrenteModalProps {
  isOpen: boolean;
  onClose: () => void;
  formOptions: FormOptions;
  onSubmit: (data: any) => Promise<void>;
}

type TransactionType = "INCOME" | "EXPENSE";
type PaymentMode = "PARCELADO" | "RECORRENTE";

export default function ParceladoRecorrenteModal({
  isOpen,
  onClose,
  formOptions,
  onSubmit,
}: ParceladoRecorrenteModalProps) {
  const [transactionType, setTransactionType] = useState<TransactionType>("EXPENSE");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("PARCELADO");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helper to get today's date in YYYY-MM-DD format
  const getToday = () => new Date().toISOString().split('T')[0];

  // Form fields
  const [formData, setFormData] = useState({
    institution: "",
    card: "",
    category: "",
    subcategory: "",
    center: "",
    supplier: "",
    description: "",
    amount: "",
    startDate: getToday(),
    firstPaymentDate: getToday(),
    numInstallments: "",
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleClose = useCallback(() => {
    onClose();
    // Reset form after close animation
    setTimeout(() => {
      setTransactionType("EXPENSE");
      setPaymentMode("PARCELADO");
      setFormData({
        institution: "",
        card: "",
        category: "",
        subcategory: "",
        center: "",
        supplier: "",
        description: "",
        amount: "",
        startDate: getToday(),
        firstPaymentDate: getToday(),
        numInstallments: "",
      });
    }, 300);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Ajustar payload de acordo com o tipo de transação
      const isIncome = transactionType === "INCOME";
      const payload: any = {
        transactionType,
        paymentMode: isIncome ? null : paymentMode,
        ...formData,
        amount: extractNumericValue(formData.amount), // Extrai valor numérico formatado
        numInstallments: parseInt(formData.numInstallments) || 1,
        // Para receita, também usar firstPaymentDate separado
      };

      await onSubmit(payload);
      handleClose();
    } catch (error) {
      console.error("Error submitting form:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter categories by type
  const filteredCategories = useMemo(() => {
    return transactionType === "INCOME"
      ? formOptions.incomeCategories || []
      : formOptions.expenseCategories || [];
  }, [transactionType, formOptions]);

  // Filter centers by type
  const filteredCenters = useMemo(() => {
    return formOptions.centers?.filter(
      (center) => !center.type || center.type === transactionType
    ) || [];
  }, [transactionType, formOptions.centers]);

  // Get subcategories for selected category
  const availableSubcategories = useMemo(() => {
    if (!formData.category || !formOptions.subcategories) return [];
    return formOptions.subcategories[formData.category] || [];
  }, [formData.category, formOptions.subcategories]);

  // Show/hide fields based on payment mode and transaction type
  const showInstallments = paymentMode === "PARCELADO";
  const isExpense = transactionType === "EXPENSE";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-surface rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4 border border-ui-border-soft">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-ui-border-soft">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-brand" />
            <h2 className="text-lg font-semibold text-content">
              Inserir Lançamento Parcelado / Recorrente
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 hover:bg-surface-subtle rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-content-muted" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-3 space-y-2">
          {/* Tipo de Lançamento + Modo de Pagamento (Modo só para Despesa) */}
          <div className={isExpense ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : ""}>
            <div className="space-y-1">
              <label className="text-sm font-medium text-content-secondary">
                Tipo de Lançamento
              </label>
              <div className="flex gap-2 p-1 bg-surface-subtle rounded-lg">
                <button
                  type="button"
                  onClick={() => setTransactionType("EXPENSE")}
                  className={`flex-1 py-1.5 px-4 rounded-md text-sm font-medium transition-all ${
                    transactionType === "EXPENSE"
                      ? "bg-state-error text-white shadow-sm"
                      : "text-content-secondary hover:bg-surface-muted"
                  }`}
                >
                  Despesa
                </button>
                <button
                  type="button"
                  onClick={() => setTransactionType("INCOME")}
                  className={`flex-1 py-1.5 px-4 rounded-md text-sm font-medium transition-all ${
                    transactionType === "INCOME"
                      ? "bg-state-success text-white shadow-sm"
                      : "text-content-secondary hover:bg-surface-muted"
                  }`}
                >
                  Receita
                </button>
              </div>
            </div>

            {isExpense && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-content-secondary">
                  Modo de Pagamento
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMode("PARCELADO")}
                    className={`flex-1 py-1.5 px-3 rounded-lg border text-sm font-medium transition-all ${
                      paymentMode === "PARCELADO"
                        ? "border-brand bg-brand/5 text-brand"
                        : "border-ui-border-soft text-content-secondary hover:border-ui-border"
                    }`}
                  >
                    <Layers className="w-4 h-4 inline mr-1" />
                    Parcelado
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode("RECORRENTE")}
                    className={`flex-1 py-1.5 px-3 rounded-lg border text-sm font-medium transition-all ${
                      paymentMode === "RECORRENTE"
                        ? "border-brand bg-brand/5 text-brand"
                        : "border-ui-border-soft text-content-secondary hover:border-ui-border"
                    }`}
                  >
                    <RefreshCw className="w-4 h-4 inline mr-1" />
                    Recorrente
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Instituição + Cartão (Despesa) + Categoria */}
          <div className={isExpense ? "grid grid-cols-1 lg:grid-cols-3 gap-3" : "grid grid-cols-1 sm:grid-cols-2 gap-3"}>
            <div className="space-y-1">
              <label className="text-sm font-medium text-content-secondary">
                Inst. Financeira
              </label>
              <QuickCreateAutocomplete
                value={formData.institution}
                onChange={(v) => handleInputChange("institution", v)}
                options={formOptions.institutions || []}
                placeholder="Selecione ou digite..."
                allowCreate={true}
                size="md"
              />
            </div>

            {isExpense && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-content-secondary">
                  Cartão de Crédito
                </label>
                <QuickCreateAutocomplete
                  value={formData.card}
                  onChange={(v) => handleInputChange("card", v)}
                  options={formOptions.cards || []}
                  placeholder="Selecione (opcional)..."
                  allowCreate={true}
                  size="md"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-sm font-medium text-content-secondary">
                Categoria *
              </label>
              <QuickCreateAutocomplete
                value={formData.category}
                onChange={(v) => {
                  handleInputChange("category", v);
                  handleInputChange("subcategory", ""); // Reset subcategory
                }}
                options={filteredCategories}
                placeholder="Selecione ou digite..."
                allowCreate={true}
                size="md"
              />
            </div>
          </div>

          {/* Subcategoria + Centro + Contato (Despesa) */}
          <div className={isExpense ? "grid grid-cols-1 lg:grid-cols-3 gap-3" : "grid grid-cols-1 sm:grid-cols-2 gap-3"}>
            <div className="space-y-1">
              <label className="text-sm font-medium text-content-secondary">
                Subcategoria
              </label>
              <QuickCreateAutocomplete
                value={formData.subcategory}
                onChange={(v) => handleInputChange("subcategory", v)}
                options={availableSubcategories}
                placeholder={availableSubcategories.length === 0 ? "---" : "Selecione ou digite..."}
                disabled={availableSubcategories.length === 0}
                allowCreate={true}
                size="md"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-content-secondary">
                Centro
              </label>
              <QuickCreateAutocomplete
                value={formData.center}
                onChange={(v) => handleInputChange("center", v)}
                options={filteredCenters}
                placeholder="Selecione ou digite..."
                allowCreate={true}
                size="md"
              />
            </div>

            {isExpense && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-content-secondary">
                  Contato
                </label>
                <QuickCreateAutocomplete
                  value={formData.supplier}
                  onChange={(v) => handleInputChange("supplier", v)}
                  options={formOptions.suppliers || []}
                  placeholder="Selecione ou digite..."
                  allowCreate={true}
                  size="md"
                />
              </div>
            )}
          </div>

          {/* Número + Valor + Datas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-content-secondary">
                {isExpense
                  ? (showInstallments ? "Nº parcelas *" : "Nº lançamentos *")
                  : "Nº parcelas *"}
              </label>
              <input
                type="number"
                min="1"
                max="120"
                required
                value={formData.numInstallments}
                onChange={(e) => handleInputChange("numInstallments", e.target.value)}
                placeholder={isExpense && showInstallments ? "Ex: 12" : "Ex: 24"}
                className="w-full px-3 py-2 border border-ui-border rounded-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none text-sm bg-surface text-content"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-content-secondary">
                {isExpense
                  ? (showInstallments ? "Valor da parcela *" : "Valor do lançamento *")
                  : "Valor da parcela *"}
              </label>
              <input
                type="text"
                required
                value={formData.amount}
                onChange={(e) => {
                  const maskedValue = formatCurrencyInput(e.target.value);
                  handleInputChange("amount", maskedValue);
                }}
                placeholder="R$ 0,00"
                className="w-full px-3 py-2 border border-ui-border rounded-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none text-sm bg-surface text-content"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-content-secondary">
                {isExpense
                  ? (showInstallments ? "Data da Compra *" : "Data inicial *")
                  : "Data inicial *"}
              </label>
              <input
                type="date"
                required
                value={formData.startDate}
                onChange={(e) => handleInputChange("startDate", e.target.value)}
                className="w-full px-3 py-2 border border-ui-border rounded-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none text-sm bg-surface text-content"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-content-secondary">
                {isExpense ? "1º Pagamento *" : "Data 1º pagamento *"}
              </label>
              <input
                type="date"
                required
                value={formData.firstPaymentDate}
                onChange={(e) => handleInputChange("firstPaymentDate", e.target.value)}
                className="w-full px-3 py-2 border border-ui-border rounded-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none text-sm bg-surface text-content"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-content-secondary">
              Descrição
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Descreva o lançamento..."
              className="w-full px-3 py-2 border border-ui-border rounded-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none text-sm bg-surface text-content placeholder:text-content-placeholder"
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-2 border-t border-ui-border-soft">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-content-secondary hover:text-content hover:bg-surface-subtle rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 text-sm font-medium text-white bg-brand hover:bg-brand-hover rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
