import type { ContactChannel } from '@/core/entities/contact-channel';

/**
 * Persistência dos canais extras de contato (Etapa 3).
 *
 * Inquilinos, proprietários, imobiliárias e fornecedores repetem exatamente o
 * mesmo par create/update de contatos. Em vez de espalhar o nested-create de
 * ContactChannel por oito lugares, os dois helpers abaixo concentram a regra —
 * e, quando o formato mudar, muda num arquivo só.
 *
 * Camada: infra.
 */

/** O que o formulário manda para o repositório, além dos campos principais. */
export interface ContactInput {
  contact?: string | null;
  phone?: string | null;
  cellphone?: string | null;
  email?: string | null;
  channels?: ContactChannel[];
}

/** Campos escalares do Contact, sem os canais. */
export function contactScalars(contact: ContactInput): {
  contact: string | null;
  phone: string | null;
  cellphone: string | null;
  email: string | null;
} {
  return {
    contact: contact.contact || null,
    phone: contact.phone || null,
    cellphone: contact.cellphone || null,
    email: contact.email || null,
  };
}

/**
 * `data.channels` no formato do Prisma para criar o Contact junto dos canais
 * numa tacada só. Devolve `{}` quando não há extras, para não gravar relação
 * vazia à toa.
 */
export function contactChannelsCreate(contact: ContactInput): {
  channels?: { create: Array<{ kind: ContactChannel['kind']; value: string; label: string | null; display_order: number }> };
} {
  const channels = (contact.channels ?? [])
    .map((channel, index) => ({
      kind: channel.kind,
      value: String(channel.value ?? '').trim(),
      label: channel.label ?? null,
      display_order: channel.display_order ?? index + 1,
    }))
    .filter((channel) => channel.value !== '');

  if (channels.length === 0) return {};
  return { channels: { create: channels } };
}

/** Payload completo de criação de um Contact, canais inclusos. */
export function buildContactCreateData<T extends Record<string, unknown>>(
  contact: ContactInput,
  owner: T,
): Record<string, unknown> {
  return { ...contactScalars(contact), ...owner, ...contactChannelsCreate(contact) };
}
