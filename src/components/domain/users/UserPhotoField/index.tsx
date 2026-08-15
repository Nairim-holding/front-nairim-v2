/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, Trash2, UserRound } from 'lucide-react';
import { uploadUserPhotoAction } from '@/server/actions/user';

interface UserPhotoFieldProps {
  /** URL salva, ou o File escolhido enquanto o usuário ainda não existe. */
  value: any;
  onChange: (value: any) => void;
  /** Em edição a foto sobe na hora; em criação fica pendente até salvar. */
  userId?: string;
  disabled?: boolean;
}

const MAX_MB = 5;

export default function UserPhotoField({
  value,
  onChange,
  userId,
  disabled = false,
}: UserPhotoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // value pode ser URL (salva) ou File (pendente, no cadastro)
  useEffect(() => {
    if (!value) {
      setPreview(null);
      return;
    }

    if (typeof value === 'string') {
      setPreview(value);
      return;
    }

    if (value instanceof File) {
      const url = URL.createObjectURL(value);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [value]);

  const handlePick = async (file: File) => {
    setError(null);

    if (!file.type.startsWith('image/')) {
      setError('Selecione um arquivo de imagem');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`A imagem deve ter no máximo ${MAX_MB} MB`);
      return;
    }

    // Sem id ainda (cadastro): guarda o File e a página sobe após criar
    if (!userId) {
      onChange(file);
      return;
    }

    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);

      const result = await uploadUserPhotoAction(userId, body);

      if (!result.ok) {
        setError(result.error || `Erro ao enviar a foto`);
        return;
      }

      onChange(result.data?.photo_url ?? null);
    } catch (e: any) {
      setError(e?.message || 'Falha ao enviar a foto');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-start gap-4">
      <div className="w-24 h-24 rounded-full overflow-hidden bg-page border border-ui-border flex items-center justify-center shrink-0">
        {preview ? (
          // next/image exigiria allowlist de domínio para URLs externas
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Foto do usuário" className="w-full h-full object-cover" />
        ) : (
          <UserRound size={32} className="text-content-muted" />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={disabled || uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handlePick(file);
            e.target.value = '';
          }}
        />

        {!disabled && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-ui-border hover:bg-ui-border-muted text-content-secondary transition-colors disabled:opacity-50"
            >
              <Upload size={16} />
              {uploading ? 'Enviando…' : preview ? 'Trocar foto' : 'Escolher foto'}
            </button>

            {preview && (
              <button
                type="button"
                disabled={uploading}
                onClick={() => {
                  onChange(null);
                  setError(null);
                }}
                title="Remover foto"
                className="p-2 rounded-lg text-state-error hover:bg-surface-subtle transition-colors disabled:opacity-50"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        )}

        <p className="text-xs text-content-muted">
          JPG ou PNG, até {MAX_MB} MB.
          {!userId && ' A foto é enviada ao salvar o cadastro.'}
        </p>

        {error && <p className="text-state-error text-sm">{error}</p>}
      </div>
    </div>
  );
}
