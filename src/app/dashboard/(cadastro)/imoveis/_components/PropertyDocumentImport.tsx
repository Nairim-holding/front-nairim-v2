/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useRef, useState } from 'react';
import { FileSearch } from 'lucide-react';
import ModalShell, { ModalCancelButton, ModalPrimaryButton } from '@/components/investimentos/ModalShell';
import { useMessageContext } from '@/contexts/MessageContext';
import { previewPropertyDocumentImportAction, type PropertyDocumentPreview } from '@/server/actions/property-document-import';

interface Props {
  /** Recebe os valores escolhidos, prontos para mesclar no formulário do imóvel. */
  onApply: (values: Record<string, any>) => void;
}

const KIND_LABELS = { IPTU: 'Carnê de IPTU', FICHA_CADASTRAL: 'Ficha Cadastral' } as const;

/**
 * Preenche o cadastro do imóvel a partir do carnê de IPTU e/ou da Ficha
 * Cadastral da prefeitura: envia os PDFs, mostra o que foi lido e aplica ao
 * formulário só os campos que o usuário mantiver marcados.
 */
export default function PropertyDocumentImport({ onApply }: Props) {
  const { showMessage } = useMessageContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<PropertyDocumentPreview | null>(null);
  const [checked, setChecked] = useState<string[]>([]);

  const read = async (selected: File[]) => {
    if (selected.length === 0) return;
    setBusy(true);
    try {
      const formData = new FormData();
      selected.forEach((file) => formData.append('files', file));
      const result = await previewPropertyDocumentImportAction(formData);
      if (!result.ok) throw new Error(result.error ?? 'Não foi possível ler os documentos.');
      setFiles(selected);
      setPreview(result.data);
      setChecked(result.data.fields.map((field) => field.field));
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Não foi possível ler os documentos.', 'error');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const toggle = (field: string) => setChecked((current) => current.includes(field) ? current.filter((item) => item !== field) : [...current, field]);

  const apply = () => {
    if (!preview) return;
    const values: Record<string, any> = Object.fromEntries(
      preview.fields.filter((field) => checked.includes(field.field)).map((field) => [field.field, field.value]),
    );
    // Os PDFs lidos ficam anexados ao imóvel (documentos "Outros").
    values.arquivosOutros = files;
    onApply(values);
    setPreview(null);
    showMessage('Cadastro preenchido com os dados do documento. Confira os campos antes de salvar.', 'success');
  };

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-ui-border-soft bg-surface-subtle p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-brand/10 text-brand"><FileSearch size={20} /></div>
        <div>
          <p className="text-[15px] font-semibold text-content">Preencher a partir do IPTU ou da Ficha Cadastral</p>
          <p className="text-[13px] text-content-secondary">
            Envie o PDF do carnê de IPTU e/ou da Ficha Cadastral emitidos pela prefeitura. O sistema lê os dados e preenche o cadastro para você conferir.
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="hidden"
        aria-label="Selecionar PDF do IPTU ou da Ficha Cadastral"
        onChange={(event) => void read(Array.from(event.target.files ?? []))}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="shrink-0 px-5 py-2 text-sm font-medium text-white bg-brand rounded-lg hover:bg-brand-hover disabled:opacity-50 transition-colors"
      >
        {busy ? 'Lendo documentos…' : 'Selecionar PDF'}
      </button>

      {preview && (
        <ModalShell
          title="Dados lidos do documento"
          onClose={() => setPreview(null)}
          maxWidth="max-w-3xl"
          footer={(
            <>
              <ModalCancelButton onClick={() => setPreview(null)} />
              <ModalPrimaryButton onClick={apply} disabled={checked.length === 0}>Preencher cadastro</ModalPrimaryButton>
            </>
          )}
        >
          <div className="space-y-4">
            <ul className="text-sm text-content-secondary">
              {preview.documents.map((document) => (
                <li key={document.fileName}>{KIND_LABELS[document.kind]}{document.year ? ` ${document.year}` : ''} — {document.fileName}</li>
              ))}
            </ul>

            {preview.warnings.length > 0 && (
              <ul className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                {preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            )}

            <p className="text-xs text-content-muted">Desmarque o que não quiser preencher. Campos já digitados serão substituídos pelos marcados.</p>

            <div className="overflow-hidden rounded-lg border border-ui-border-soft">
              <table className="w-full text-sm text-content">
                <tbody>
                  {preview.fields.map((field) => (
                    <tr key={field.field}>
                      <td className="w-10 border-b border-ui-border-soft p-2 align-top">
                        <input
                          type="checkbox"
                          checked={checked.includes(field.field)}
                          onChange={() => toggle(field.field)}
                          aria-label={`Preencher ${field.label}`}
                        />
                      </td>
                      <td className="w-1/3 border-b border-ui-border-soft p-2 align-top text-content-secondary">{field.label}</td>
                      <td className="border-b border-ui-border-soft p-2 align-top font-medium">{field.display}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
