/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { getAuditLogByIdAction } from '@/server/actions/audit-log';

interface ChangedField {
  field: string;
  label: string;
  old_value: unknown;
  new_value: unknown;
}

interface AuditLogDetail {
  id: string;
  company: { id: string; name: string } | null;
  user_name: string | null;
  user_email: string | null;
  action: string;
  action_label: string;
  table_name: string;
  table_label: string;
  record_id: string | null;
  ip: string | null;
  created_at: string;
  changed_fields: ChangedField[];
}

interface AuditLogDetailModalProps {
  logId: string;
  onClose: () => void;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

/**
 * Tradução dos rótulos de campo do diff (Tarefa 5.3 do guia de correções). O
 * backend só "prettifica" o nome técnico (`file_path` → "File Path"), sem
 * traduzir — o comentário em `api-nairim-v2/src/lib/auditModels.ts` já
 * reconhece isso como escopo futuro. Cobre os campos mais comuns nos modelos
 * auditados (Lançamento, Documento, Locação, Imóvel etc.); campo sem mapa
 * conhecido mantém o rótulo original vindo do backend, em vez de quebrar.
 */
const FIELD_LABEL_PT: Record<string, string> = {
  'Id': 'ID',
  'Company Id': 'Empresa',
  'Created At': 'Criado em',
  'Created By': 'Criado por',
  'Updated At': 'Atualizado em',
  'Updated By': 'Atualizado por',
  'Deleted At': 'Excluído em',
  'Deleted By': 'Excluído por',
  'Type': 'Tipo',
  'Status': 'Situação',
  'Description': 'Descrição',
  'Amount': 'Valor',
  'Event Date': 'Data do Evento',
  'Effective Date': 'Data Efetiva',
  'Due Date': 'Vencimento',
  'Start Date': 'Data de Início',
  'End Date': 'Data de Fim',
  'Is Active': 'Ativo',
  'Is Featured': 'Destaque',
  'Is Transfer': 'É Transferência',
  'Name': 'Nome',
  'Title': 'Título',
  'Email': 'E-mail',
  'Phone': 'Telefone',
  'Cpf': 'CPF',
  'Cnpj': 'CNPJ',
  'Category Id': 'Categoria',
  'Subcategory Id': 'Subcategoria',
  'Financial Institution Id': 'Instituição Financeira',
  'Card Id': 'Cartão',
  'Center Id': 'Centro',
  'Supplier Id': 'Fornecedor',
  'Lease Id': 'Locação',
  'Property Id': 'Imóvel',
  'Owner Id': 'Proprietário',
  'Tenant Id': 'Inquilino',
  'User Id': 'Usuário',
  'Invoice Id': 'Fatura',
  'Transaction Id': 'Lançamento',
  'File Path': 'Arquivo',
  'File Type': 'Tipo de Arquivo',
  'File Name': 'Nome do Arquivo',
  'Contract Number': 'Número do Contrato',
  'Address': 'Endereço',
  'City': 'Cidade',
  'State': 'Estado',
  'Zip Code': 'CEP',
  'Latitude': 'Latitude',
  'Longitude': 'Longitude',
  'Default Amount': 'Valor Padrão',
  'Monthly Values': 'Valores Mensais',
};

function translateFieldLabel(label: string): string {
  return FIELD_LABEL_PT[label] ?? label;
}

/** Sem formatação especial por tipo: o print exibe até booleano cru
 *  ("true"/"false"), então valor vazio vira "—" e o resto é String(value). */
function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

export default function AuditLogDetailModal({ logId, onClose }: AuditLogDetailModalProps) {
  const [log, setLog] = useState<AuditLogDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const result = await getAuditLogByIdAction(logId);
        if (!result.ok) throw new Error(result.error);
        // A action serializa `created_at: Date` para string no round-trip
        // servidor→cliente (JSON não tem tipo Date) — o shape local já reflete
        // isso (`created_at: string`).
        if (!cancelled) setLog({ ...result.data, created_at: String(result.data.created_at) });
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Falha ao carregar o log');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [logId]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-log-detail-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-6xl max-h-[90vh] flex flex-col bg-surface rounded-lg shadow-2xl border border-ui-border font-poppins"
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-ui-border">
          <h2 id="audit-log-detail-title" className="text-lg font-semibold text-content truncate">
            Detalhes do log do sistema{log ? `: ${log.action_label}` : ''}
          </h2>
          <button
            type="button"
            onClick={onClose}
            title="Fechar"
            className="p-1 rounded text-content-muted hover:text-content hover:bg-surface-subtle transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto">
          {loading && (
            <p className="text-sm text-content-muted">Carregando…</p>
          )}

          {error && (
            <p className="text-sm text-state-error">{error}</p>
          )}

          {log && (
            <>
              {/* Meta: usuário, data/hora, ação, tabela */}
              <p className="text-sm text-content-secondary mb-4">
                <span className="font-medium text-content">Usuário:</span> {log.user_name || log.user_email || '—'}
                {'  '}
                <span className="font-medium text-content">Data/Hora:</span> {formatDateTime(log.created_at)}
                {'  '}
                <span className="font-medium text-content">Ação:</span> {log.action_label}
                {'  '}
                <span className="font-medium text-content">Tabela:</span> {log.table_label}
              </p>

              {log.changed_fields.length === 0 ? (
                <p className="text-sm text-content-muted italic py-6 text-center">
                  {log.action === 'LOGIN' || log.action === 'LOGIN_FAILED'
                    ? 'Login não envolve alteração de dados.'
                    : 'Nenhuma alteração de campo registrada para esta ação.'}
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-ui-border">
                  <table className="w-full text-sm border-collapse table-auto">
                    <thead>
                      <tr className="bg-page">
                        <th className="text-left font-medium text-content-secondary px-4 py-2.5 whitespace-nowrap">Campo</th>
                        <th className="text-left font-medium text-content-secondary px-4 py-2.5">Valor Antigo</th>
                        <th className="text-left font-medium text-content-secondary px-4 py-2.5">Valor Novo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {log.changed_fields.map((f) => (
                        <tr
                          key={f.field}
                          className="border-t border-ui-border bg-[var(--color-brand-primary)]/5"
                        >
                          <td className="px-4 py-2.5 text-content whitespace-nowrap align-top">{translateFieldLabel(f.label)}</td>
                          <td className="px-4 py-2.5 text-content-muted line-through decoration-state-error/50 whitespace-nowrap">
                            {formatValue(f.old_value)}
                          </td>
                          <td className="px-4 py-2.5 text-content font-medium whitespace-nowrap">
                            {formatValue(f.new_value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
