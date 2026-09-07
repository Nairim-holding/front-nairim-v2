'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, MessageCircle, Power, RefreshCw, Unplug } from 'lucide-react';
import {
  connectWhatsAppAction,
  disconnectWhatsAppAction,
  getWhatsAppConnectionAction,
} from '@/server/actions/whatsapp-connection';
import type { WhatsAppConnectionInfo } from '@/infra/services/evolution-whatsapp-client';
import { describeActionError } from '@/shared/actions/action-result';
import { useMessageContext } from '@/contexts/MessageContext';

const stateLabel: Record<WhatsAppConnectionInfo['state'], string> = {
  NOT_CONFIGURED: 'Configuração pendente',
  NOT_CREATED: 'Não conectado',
  CONNECTING: 'Aguardando leitura do QR Code',
  CONNECTED: 'Conectado',
  DISCONNECTED: 'Desconectado',
  UNKNOWN: 'Estado indisponível',
};

function formatPhone(phone: string | null): string | null {
  if (!phone) return null;
  if (phone.length === 13 && phone.startsWith('55')) {
    return `+55 (${phone.slice(2, 4)}) ${phone.slice(4, 9)}-${phone.slice(9)}`;
  }
  return `+${phone}`;
}

export default function WhatsAppConnectionPanel() {
  const [info, setInfo] = useState<WhatsAppConnectionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [operation, setOperation] = useState<'connect' | 'disconnect' | null>(null);
  const { showMessage } = useMessageContext();

  const refresh = useCallback(async (silent = false) => {
    const result = await getWhatsAppConnectionAction();
    if (!silent) setLoading(false);
    if (!result.ok) {
      if (!silent) showMessage(describeActionError(result, 'Não foi possível consultar o WhatsApp.'), 'error');
      return;
    }
    setInfo((current) => ({
      ...result.data,
      qrCode: result.data.state === 'CONNECTED' ? null : result.data.qrCode ?? current?.qrCode ?? null,
    }));
  }, [showMessage]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    if (info?.state !== 'CONNECTING') return;
    const timer = window.setInterval(() => void refresh(true), 5000);
    return () => window.clearInterval(timer);
  }, [info?.state, refresh]);

  const connect = async () => {
    setOperation('connect');
    const result = await connectWhatsAppAction();
    setOperation(null);
    if (!result.ok) {
      showMessage(describeActionError(result, 'Não foi possível gerar o QR Code.'), 'error');
      return;
    }
    setInfo(result.data);
    if (result.data.state === 'CONNECTED') {
      showMessage('WhatsApp já está conectado.', 'success');
    }
  };

  const disconnect = async () => {
    if (!window.confirm('Deseja desconectar o número usado nas cobranças automáticas?')) return;
    setOperation('disconnect');
    const result = await disconnectWhatsAppAction();
    setOperation(null);
    if (!result.ok) {
      showMessage(describeActionError(result, 'Não foi possível desconectar o WhatsApp.'), 'error');
      return;
    }
    setInfo(result.data);
    showMessage('WhatsApp desconectado.', 'success');
  };

  const connected = info?.state === 'CONNECTED';
  const connecting = info?.state === 'CONNECTING';

  return (
    <div className="bg-surface border border-ui-border rounded-xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-500/10 text-green-500">
            <MessageCircle size={22} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-content">WhatsApp de cobranças</h2>
            <p className="text-[13px] text-content-secondary">
              Número utilizado para avisar as imobiliárias sobre repasses atrasados.
            </p>
          </div>
        </div>
        {!loading && info && (
          <span className={`inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1 text-xs font-semibold ${
            connected
              ? 'bg-green-500/10 text-green-500'
              : connecting
                ? 'bg-amber-500/10 text-amber-500'
                : 'bg-surface-subtle text-content-secondary'
          }`}>
            {connected ? <CheckCircle2 size={14} /> : <Unplug size={14} />}
            {stateLabel[info.state]}
          </span>
        )}
      </div>

      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-content-muted">
          <Loader2 size={17} className="animate-spin" /> Consultando conexão...
        </div>
      ) : info?.state === 'NOT_CONFIGURED' ? (
        <div className="mt-5 rounded-lg border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-content-secondary">
          A Evolution API ainda precisa ser instalada e configurada no servidor. Depois disso, o botão para gerar o QR Code aparecerá aqui.
        </div>
      ) : (
        <div className="mt-5">
          {connected && (
            <div className="rounded-lg border border-green-500/25 bg-green-500/10 p-4">
              <p className="font-medium text-green-500">Pronto para enviar cobranças</p>
              <p className="mt-1 text-sm text-content-secondary">
                {formatPhone(info?.phone) ?? 'O número está conectado à sessão do WhatsApp.'}
              </p>
            </div>
          )}

          {connecting && (
            <div className="grid gap-5 md:grid-cols-[280px_1fr] md:items-center">
              <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-ui-border-soft bg-white p-3">
                {info?.qrCode ? (
                  <Image src={info.qrCode} alt="QR Code para conectar o WhatsApp" width={256} height={256} unoptimized />
                ) : (
                  <div className="text-center text-sm text-slate-500">
                    <Loader2 size={24} className="mx-auto mb-2 animate-spin" />
                    Aguardando o QR Code...
                  </div>
                )}
              </div>
              <div>
                <h3 className="font-semibold text-content">Leia o código pelo celular</h3>
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-content-secondary">
                  <li>Abra o WhatsApp no celular que fará os envios.</li>
                  <li>Acesse <strong>Aparelhos conectados</strong>.</li>
                  <li>Toque em <strong>Conectar um aparelho</strong>.</li>
                  <li>Aponte a câmera para este QR Code.</li>
                </ol>
                <p className="mt-3 text-xs text-content-muted">Esta tela reconhece a conexão automaticamente após a leitura.</p>
              </div>
            </div>
          )}

          {!connected && !connecting && (
            <p className="text-sm text-content-secondary">
              Conecte um número de WhatsApp para liberar os envios automáticos e os reenvios manuais.
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            {!connected && (
              <button
                type="button"
                onClick={() => void connect()}
                disabled={operation !== null}
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-60"
              >
                {operation === 'connect' ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
                {connecting ? 'Gerar novo QR Code' : 'Conectar WhatsApp'}
              </button>
            )}
            {connected && (
              <button
                type="button"
                onClick={() => void disconnect()}
                disabled={operation !== null}
                className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 px-4 py-2.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-60"
              >
                {operation === 'disconnect' ? <Loader2 size={16} className="animate-spin" /> : <Power size={16} />}
                Desconectar
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void refresh();
              }}
              disabled={loading || operation !== null}
              className="inline-flex items-center gap-2 rounded-lg border border-ui-border px-4 py-2.5 text-sm font-medium text-content-secondary transition-colors hover:bg-surface-subtle disabled:opacity-60"
            >
              <RefreshCw size={16} /> Atualizar situação
            </button>
          </div>
          {info?.instance && <p className="mt-3 text-xs text-content-muted">Identificação da conexão: {info.instance}</p>}
        </div>
      )}
    </div>
  );
}
