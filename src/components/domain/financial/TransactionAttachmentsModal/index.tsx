'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Paperclip, Upload, Trash2, Download, FileText, Image as ImageIcon } from 'lucide-react';
import { authFetch } from '@/utils/authFetch';
import { useMessageContext } from '@/contexts/MessageContext';

const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';

/** Mesmo limite do backend (DocumentService.MAX_TRANSACTION_ATTACHMENTS) — Tarefa 2 do guia de correções. */
export const MAX_ATTACHMENTS = 5;
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const ALLOWED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png';

interface TransactionDocument {
  id: string;
  file_path: string;
  file_type: string;
  description: string | null;
  created_at: string;
}

interface TransactionAttachmentsModalProps {
  transactionId: string;
  onClose: () => void;
  /** Chamado sempre que a contagem de anexos muda (upload/exclusão), para a grid atualizar o ícone sem refetch completo. */
  onCountChange?: (count: number) => void;
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function iconForFileType(fileType: string) {
  return fileType.startsWith('image/') ? ImageIcon : FileText;
}

export default function TransactionAttachmentsModal({ transactionId, onClose, onCountChange }: TransactionAttachmentsModalProps) {
  const { showMessage } = useMessageContext();
  const [documents, setDocuments] = useState<TransactionDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await authFetch(`${API_URL}/financial-transaction/${transactionId}/documents`);
      if (response.ok) {
        const result = await response.json();
        const list = Array.isArray(result.data) ? result.data : [];
        setDocuments(list);
        onCountChange?.(list.length);
      }
    } catch (error) {
      console.error('[TransactionAttachmentsModal] Erro ao carregar anexos:', error);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const remainingSlots = MAX_ATTACHMENTS - documents.length;

  const handleFilesSelected = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);

    if (fileArray.length > remainingSlots) {
      showMessage(`Limite de ${MAX_ATTACHMENTS} anexos por lançamento. Você pode enviar mais ${remainingSlots} arquivo(s).`, 'error', 4000);
      return;
    }

    const invalid = fileArray.find((f) => !ALLOWED_MIME_TYPES.includes(f.type));
    if (invalid) {
      showMessage(`Tipo de arquivo não permitido: ${invalid.name}. Envie apenas PDF, JPG ou PNG.`, 'error', 4000);
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      fileArray.forEach((file) => formData.append('attachments', file));

      const response = await authFetch(`${API_URL}/financial-transaction/${transactionId}/documents`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message ?? 'Erro ao enviar anexos.');
      }

      showMessage('Anexo(s) enviado(s) com sucesso', 'success', 2500);
      await fetchDocuments();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Erro ao enviar anexos.', 'error', 4000);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [remainingSlots, transactionId, showMessage, fetchDocuments]);

  const handleDelete = useCallback(async (documentId: string) => {
    setDeletingId(documentId);
    try {
      const response = await authFetch(`${API_URL}/financial-transaction/${transactionId}/documents/${documentId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message ?? 'Erro ao excluir anexo.');
      }
      showMessage('Anexo excluído com sucesso', 'success', 2000);
      await fetchDocuments();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Erro ao excluir anexo.', 'error', 4000);
    } finally {
      setDeletingId(null);
    }
  }, [transactionId, showMessage, fetchDocuments]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-surface rounded-2xl shadow-xl border border-ui-border-soft w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ui-border-soft shrink-0">
          <div className="flex items-center gap-2">
            <Paperclip size={18} className="text-brand" />
            <h2 className="text-sm font-semibold text-content">Anexos do Lançamento</h2>
          </div>
          <button type="button" onClick={onClose} className="text-content-muted hover:text-content transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3 min-h-[160px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-content-muted text-sm">Carregando...</div>
          ) : documents.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-content-muted text-sm text-center">
              Nenhum anexo neste lançamento.
            </div>
          ) : (
            documents.map((doc) => {
              const Icon = iconForFileType(doc.file_type);
              return (
                <div key={doc.id} className="flex items-center gap-3 border border-ui-border-soft rounded-lg px-3 py-2.5">
                  <Icon size={20} className="text-content-muted shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-content truncate" title={doc.description ?? ''}>
                      {doc.description || 'Anexo'}
                    </p>
                    <p className="text-[11px] text-content-muted">{formatDateTime(doc.created_at)}</p>
                  </div>
                  <a
                    href={doc.file_path}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Baixar"
                    className="p-1.5 rounded-lg text-content-muted hover:text-brand hover:bg-surface-subtle transition-colors shrink-0"
                  >
                    <Download size={16} />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDelete(doc.id)}
                    disabled={deletingId === doc.id}
                    title="Excluir"
                    className="p-1.5 rounded-lg text-content-muted hover:text-state-error hover:bg-surface-subtle transition-colors disabled:opacity-40 shrink-0"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="px-5 py-4 border-t border-ui-border-soft shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_EXTENSIONS}
            multiple
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || remainingSlots <= 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-ui-border text-sm font-medium text-content-secondary hover:bg-surface-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Upload size={16} />
            {isUploading ? 'Enviando...' : remainingSlots > 0 ? `Adicionar arquivo (PDF, JPG ou PNG)` : 'Limite de anexos atingido'}
          </button>
          <p className="text-[11px] text-content-muted mt-2 text-center">
            {documents.length}/{MAX_ATTACHMENTS} anexos utilizados
          </p>
        </div>
      </div>
    </div>
  );
}
