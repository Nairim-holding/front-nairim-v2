import 'server-only';

import { env } from '@/infra/config/env';
import { ValidationError } from '@/core/errors/domain-errors';

export interface WhatsAppDeliveryResult {
  messageId: string | null;
}

export type WhatsAppConnectionState =
  | 'NOT_CONFIGURED'
  | 'NOT_CREATED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'UNKNOWN';

export interface WhatsAppConnectionInfo {
  configured: boolean;
  instance: string | null;
  state: WhatsAppConnectionState;
  phone: string | null;
  qrCode: string | null;
}

function normalizedPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 10) throw new ValidationError('Telefone da imobiliária inválido para WhatsApp.');
  return digits.startsWith('55') ? digits : `55${digits}`;
}

export function evolutionWhatsAppConfigured(): boolean {
  return Boolean(env.EVOLUTION_API_URL && env.EVOLUTION_API_KEY && env.EVOLUTION_INSTANCE);
}

function configuredBaseUrl(): string {
  if (!evolutionWhatsAppConfigured()) {
    throw new ValidationError(
      'O servidor do WhatsApp ainda não foi configurado. Informe os dados da Evolution API no servidor.',
    );
  }
  const baseUrl = env.EVOLUTION_API_URL.replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(baseUrl)) throw new ValidationError('EVOLUTION_API_URL inválida.');
  return baseUrl;
}

function responseMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  if (typeof record.message === 'string') return record.message;
  const response = record.response;
  if (response && typeof response === 'object') {
    const message = (response as Record<string, unknown>).message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message) && typeof message[0] === 'string') return message[0];
  }
  return null;
}

async function evolutionRequest(path: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${configuredBaseUrl()}${path}`, {
      ...init,
      headers: {
        apikey: env.EVOLUTION_API_KEY,
        ...(init?.body ? { 'content-type': 'application/json' } : {}),
        ...init?.headers,
      },
      signal: controller.signal,
      cache: 'no-store',
    });
    const raw = await response.text();
    let payload: unknown = {};
    try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = {}; }
    if (!response.ok) {
      const detail = responseMessage(payload);
      throw new Error(`Evolution API recusou a operação (${response.status})${detail ? `: ${detail}` : ''}`);
    }
    return payload;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('A Evolution API não respondeu dentro de 15 segundos.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function normalizeState(value: unknown): WhatsAppConnectionState {
  const state = String(value ?? '').toLowerCase();
  if (state === 'open' || state === 'connected') return 'CONNECTED';
  if (state === 'connecting') return 'CONNECTING';
  if (state === 'close' || state === 'closed' || state === 'disconnected') return 'DISCONNECTED';
  return 'UNKNOWN';
}

function instanceRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.map(asRecord).filter((row): row is Record<string, unknown> => !!row);
  const record = asRecord(payload);
  const rows = record?.instances;
  return Array.isArray(rows) ? rows.map(asRecord).filter((row): row is Record<string, unknown> => !!row) : [];
}

function qrCodeFrom(payload: unknown, depth = 0): string | null {
  if (depth > 5 || !payload) return null;
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const found = qrCodeFrom(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const record = asRecord(payload);
  if (!record) return null;
  for (const key of ['base64', 'qrcode', 'qrCode']) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 100) {
      return value.startsWith('data:image/') ? value : `data:image/png;base64,${value}`;
    }
    const nested = qrCodeFrom(value, depth + 1);
    if (nested) return nested;
  }
  for (const value of Object.values(record)) {
    const nested = qrCodeFrom(value, depth + 1);
    if (nested) return nested;
  }
  return null;
}

function phoneFromInstance(row: Record<string, unknown>): string | null {
  const raw = row.ownerJid ?? row.number ?? asRecord(row.instance)?.ownerJid;
  if (typeof raw !== 'string') return null;
  const digits = raw.split('@')[0].replace(/\D/g, '');
  return digits || null;
}

export async function getEvolutionWhatsAppConnection(): Promise<WhatsAppConnectionInfo> {
  if (!evolutionWhatsAppConfigured()) {
    return { configured: false, instance: env.EVOLUTION_INSTANCE || null, state: 'NOT_CONFIGURED', phone: null, qrCode: null };
  }
  // Sem filtro: a Evolution responde 404 quando o nome ainda não existe;
  // a listagem geral responde [] e permite que a tela ofereça "Conectar".
  const payload = await evolutionRequest('/instance/fetchInstances');
  const rows = instanceRows(payload);
  const row = rows.find((item) => item.name === env.EVOLUTION_INSTANCE || item.instanceName === env.EVOLUTION_INSTANCE)
    ?? rows[0];
  if (!row) {
    return { configured: true, instance: env.EVOLUTION_INSTANCE, state: 'NOT_CREATED', phone: null, qrCode: null };
  }
  const nested = asRecord(row.instance);
  const state = normalizeState(row.connectionStatus ?? row.status ?? nested?.state ?? nested?.status);
  let qrCode: string | null = null;
  if (state === 'CONNECTING') {
    const connectPayload = await evolutionRequest(`/instance/connect/${encodeURIComponent(env.EVOLUTION_INSTANCE)}`);
    qrCode = qrCodeFrom(connectPayload);
  }
  return {
    configured: true,
    instance: env.EVOLUTION_INSTANCE,
    state,
    phone: phoneFromInstance(row),
    qrCode,
  };
}

export async function connectEvolutionWhatsApp(): Promise<WhatsAppConnectionInfo> {
  const current = await getEvolutionWhatsAppConnection();
  if (current.state === 'CONNECTED') return current;

  let payload: unknown;
  if (current.state === 'NOT_CREATED') {
    payload = await evolutionRequest('/instance/create', {
      method: 'POST',
      body: JSON.stringify({
        instanceName: env.EVOLUTION_INSTANCE,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
      }),
    });
  } else {
    payload = await evolutionRequest(`/instance/connect/${encodeURIComponent(env.EVOLUTION_INSTANCE)}`);
  }

  let qrCode = qrCodeFrom(payload);
  if (!qrCode && current.state === 'NOT_CREATED') {
    const connectPayload = await evolutionRequest(`/instance/connect/${encodeURIComponent(env.EVOLUTION_INSTANCE)}`);
    qrCode = qrCodeFrom(connectPayload);
  }
  return {
    configured: true,
    instance: env.EVOLUTION_INSTANCE,
    state: 'CONNECTING',
    phone: null,
    qrCode,
  };
}

export async function disconnectEvolutionWhatsApp(): Promise<WhatsAppConnectionInfo> {
  const current = await getEvolutionWhatsAppConnection();
  if (current.state === 'NOT_CREATED' || current.state === 'DISCONNECTED') return current;
  await evolutionRequest(`/instance/logout/${encodeURIComponent(env.EVOLUTION_INSTANCE)}`, { method: 'DELETE' });
  return {
    configured: true,
    instance: env.EVOLUTION_INSTANCE,
    state: 'DISCONNECTED',
    phone: null,
    qrCode: null,
  };
}

/** Cliente mínimo para o endpoint sendText da Evolution API v2. */
export async function sendEvolutionWhatsApp(phone: string, message: string): Promise<WhatsAppDeliveryResult> {
  const payload = asRecord(await evolutionRequest(
    `/message/sendText/${encodeURIComponent(env.EVOLUTION_INSTANCE)}`,
    {
      method: 'POST',
      body: JSON.stringify({ number: normalizedPhone(phone), text: message }),
    },
  ));
  const key = asRecord(payload?.key);
  return { messageId: typeof key?.id === 'string' ? key.id : null };
}
