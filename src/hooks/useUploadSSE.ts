'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Estados possíveis de um upload acompanhado por SSE.
 */
export type UploadState =
  | { status: 'idle' }
  | { status: 'uploading'; bytesSent?: number; totalBytes?: number }
  | { status: 'processing'; done: number; total: number; filename?: string }
  | { status: 'completed'; result: unknown }
  | { status: 'error'; reason: string };

interface UploadOptions {
  /** Endpoint completo (incluindo API_URL) */
  url: string;
  /** Método HTTP (POST para create, PUT para update) */
  method?: 'POST' | 'PUT';
  /** Corpo do request (FormData multipart) */
  body: FormData;
  /** Headers extras (ex: Authorization). Não defina Content-Type — o browser cuida. */
  headers?: Record<string, string>;
}

interface SSEEnvelope {
  jobId: string;
  sseUrl: string;
}

/**
 * Hook para upload de arquivos com:
 *  - Resposta legada 201 (resolve imediatamente com o JSON do backend)
 *  - Resposta nova 202 + SSE (escuta progresso e resolve no evento `completed`)
 *
 * Compatível com ambos os contratos para permitir migração gradual do backend.
 */
export function useUploadSSE() {
  const [state, setState] = useState<UploadState>({ status: 'idle' });
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const reset = useCallback(() => {
    xhrRef.current?.abort();
    esRef.current?.close();
    xhrRef.current = null;
    esRef.current = null;
    setState({ status: 'idle' });
  }, []);

  /**
   * Envia o upload e aguarda a finalização (legada ou via SSE).
   * Retorna o objeto final (data da property, etc.) ou rejeita com Error.
   */
  const uploadAndTrack = useCallback(<T = unknown>(opts: UploadOptions): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;

      xhr.open(opts.method ?? 'POST', opts.url, true);
      if (opts.headers) {
        for (const [k, v] of Object.entries(opts.headers)) xhr.setRequestHeader(k, v);
      }
      // Importante: não setar Content-Type — o browser define com boundary correto.

      // Progresso de UPLOAD (bytes enviados ao servidor)
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setState({ status: 'uploading', bytesSent: e.loaded, totalBytes: e.total });
        } else {
          setState({ status: 'uploading' });
        }
      };

      xhr.upload.onloadstart = () => setState({ status: 'uploading' });

      xhr.onerror = () => {
        setState({ status: 'error', reason: 'Erro de rede durante o upload' });
        reject(new Error('Erro de rede durante o upload'));
      };

      xhr.onabort = () => {
        setState({ status: 'error', reason: 'Upload cancelado' });
        reject(new Error('Upload cancelado'));
      };

      xhr.onload = () => {
        const status = xhr.status;
        const text = xhr.responseText;
        let body: unknown;
        try { body = JSON.parse(text); } catch {
          setState({ status: 'error', reason: 'Resposta inválida do servidor' });
          return reject(new Error('Resposta inválida do servidor'));
        }

        // Erro HTTP
        if (status < 200 || status >= 300) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const b = body as any;
          let msg = b?.message || `Erro ${status}`;
          if (status === 400 && b?.errors) {
            msg = `Erros de validação: ${Object.entries(b.errors)
              .map(([f, m]) => `${f}: ${Array.isArray(m) ? m.join(', ') : m}`)
              .join('; ')}`;
          }
          setState({ status: 'error', reason: msg });
          return reject(new Error(msg));
        }

        // 202 Accepted: backend novo com SSE
        if (status === 202 && isSSEEnvelope(body)) {
          subscribeSSE<T>(body, opts.url, setState, esRef, resolve, reject);
          return;
        }

        // 201/200: backend legado — já temos o resultado
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const b = body as any;
        const data = b?.data ?? b;
        setState({ status: 'completed', result: data });
        resolve(data as T);
      };

      xhr.send(opts.body);
    });
  }, []);

  return { state, uploadAndTrack, reset } as const;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function isSSEEnvelope(body: unknown): body is SSEEnvelope {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as Record<string, unknown>).jobId === 'string' &&
    typeof (body as Record<string, unknown>).sseUrl === 'string'
  );
}

/**
 * Resolve a URL absoluta do endpoint SSE.
 * Se o backend retornar caminho relativo (`/uploads/:id/events`),
 * usa a mesma origem do endpoint de upload.
 */
function resolveSSEUrl(sseUrl: string, uploadUrl: string): string {
  if (/^https?:\/\//i.test(sseUrl)) return sseUrl;
  try {
    const base = new URL(uploadUrl);
    return `${base.origin}${sseUrl.startsWith('/') ? '' : '/'}${sseUrl}`;
  } catch {
    return sseUrl;
  }
}

function subscribeSSE<T>(
  envelope: SSEEnvelope,
  uploadUrl: string,
  setState: (s: UploadState) => void,
  esRef: React.MutableRefObject<EventSource | null>,
  resolve: (value: T) => void,
  reject: (err: Error) => void,
) {
  const fullUrl = resolveSSEUrl(envelope.sseUrl, uploadUrl);
  setState({ status: 'processing', done: 0, total: 0 });

  const es = new EventSource(fullUrl, { withCredentials: true });
  esRef.current = es;

  let lastResult: unknown = null;

  es.addEventListener('property_created', (e: MessageEvent) => {
    try { lastResult = JSON.parse(e.data); } catch { /* ignore */ }
  });

  es.addEventListener('progress', (e: MessageEvent) => {
    try {
      const d = JSON.parse(e.data) as { done: number; total: number; filename?: string };
      setState({ status: 'processing', done: d.done, total: d.total, filename: d.filename });
    } catch { /* ignore */ }
  });

  es.addEventListener('completed', (e: MessageEvent) => {
    let payload: unknown = lastResult;
    try { payload = JSON.parse(e.data); } catch { /* keep last */ }
    setState({ status: 'completed', result: payload });
    es.close();
    esRef.current = null;
    resolve(payload as T);
  });

  es.addEventListener('error', (e: MessageEvent | Event) => {
    // Eventos de erro do servidor têm `data`; erros de rede do EventSource não.
    const msgEv = e as MessageEvent;
    if (msgEv.data) {
      let reason = 'Erro no processamento';
      try {
        const d = JSON.parse(msgEv.data);
        reason = d.message || d.reason || reason;
      } catch { /* ignore */ }
      setState({ status: 'error', reason });
      es.close();
      esRef.current = null;
      reject(new Error(reason));
    }
    // Sem `data`: EventSource tenta reconectar automaticamente — não rejeitar aqui.
  });
}
