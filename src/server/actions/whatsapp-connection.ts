'use server';

import { withTenant } from '@/infra/auth/session';
import {
  connectEvolutionWhatsApp,
  disconnectEvolutionWhatsApp,
  getEvolutionWhatsAppConnection,
  type WhatsAppConnectionInfo,
} from '@/infra/services/evolution-whatsapp-client';
import { type ActionResult, runAction } from '@/shared/actions/action-result';

export async function getWhatsAppConnectionAction(): Promise<ActionResult<WhatsAppConnectionInfo>> {
  return runAction(() => withTenant(() => getEvolutionWhatsAppConnection(), { role: 'superAdmin' }));
}

export async function connectWhatsAppAction(): Promise<ActionResult<WhatsAppConnectionInfo>> {
  return runAction(() => withTenant(() => connectEvolutionWhatsApp(), { role: 'superAdmin' }));
}

export async function disconnectWhatsAppAction(): Promise<ActionResult<WhatsAppConnectionInfo>> {
  return runAction(() => withTenant(() => disconnectEvolutionWhatsApp(), { role: 'superAdmin' }));
}
