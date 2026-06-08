'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { ImagePlus } from 'lucide-react';
import { useUploadSSE } from '@/hooks/useUploadSSE';
import UploadProgressOverlay from '@/components/feedback/UploadProgress/UploadProgressOverlay';
import { useAuth } from '@/contexts/AuthContext';
import { useMessageContext } from '@/contexts';

const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';

interface AssetUploaderProps {
  label: string;
  hint?: string;
  endpoint: string;
  currentUrl: string | null;
  onUploaded: (url: string) => void;
  previewClassName?: string;
}

export default function AssetUploader({
  label,
  hint,
  endpoint,
  currentUrl,
  onUploaded,
  previewClassName = 'w-40 h-24',
}: AssetUploaderProps) {
  const { token } = useAuth();
  const { showMessage } = useMessageContext();
  const { state, uploadAndTrack } = useUploadSSE();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append('file', file);
      const result = await uploadAndTrack<{ url: string }>({
        url: `${API_URL}${endpoint}`,
        method: 'POST',
        body: fd,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        compressImages: false,
      });
      if (result?.url) {
        onUploaded(result.url);
        showMessage(`${label} atualizado com sucesso!`, 'success');
      }
    } catch (err: any) {
      showMessage(err?.message ?? `Erro ao enviar ${label.toLowerCase()}`, 'error');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-content-secondary">{label}</span>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`relative flex items-center justify-center overflow-hidden rounded-lg border border-dashed border-ui-border bg-surface-subtle hover:border-brand transition-colors ${previewClassName}`}
        >
          {currentUrl ? (
            <Image src={currentUrl} alt={label} fill className="object-contain p-2" unoptimized />
          ) : (
            <ImagePlus size={28} className="text-content-muted" />
          )}
        </button>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-sm font-medium text-brand hover:text-brand-hover transition-colors text-left"
          >
            {currentUrl ? 'Substituir arquivo' : 'Selecionar arquivo'}
          </button>
          {hint && <span className="text-xs text-content-muted">{hint}</span>}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => handleFile(e.target.files?.[0])}
        />
      </div>
      <UploadProgressOverlay state={state} label={`Enviando ${label.toLowerCase()}...`} />
    </div>
  );
}
