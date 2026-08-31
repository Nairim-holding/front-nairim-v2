/**
 * Múltiplos telefones/e-mails por contato (Etapa 3).
 *
 * ── Por que não migrar tudo para uma tabela só ───────────────────────────────
 * O Contact continua com `cellphone`/`phone`/`email` como valor PRINCIPAL, e
 * os extras vão para ContactChannel. Assim nenhuma tela, filtro, export ou
 * relatório que hoje lê `contact.email` precisa mudar de uma vez, e a migração
 * de dados vira acréscimo (nada é reescrito nem apagado).
 *
 * Este módulo faz a tradução entre as duas visões: a do formulário (uma lista
 * por tipo) e a do banco (principal + canais).
 *
 * Camada: core (regra pura, sem I/O).
 */

export type ContactChannelKind = 'CELLPHONE' | 'PHONE' | 'EMAIL';

export interface ContactChannel {
  id?: string;
  kind: ContactChannelKind;
  value: string;
  label?: string | null;
  display_order?: number;
}

/** Contato como o banco guarda: principal nos campos + extras nos canais. */
export interface ContactWithChannels {
  id?: string;
  contact?: string | null;
  cellphone?: string | null;
  phone?: string | null;
  email?: string | null;
  channels?: ContactChannel[];
}

/** Contato como o formulário edita: uma lista por tipo. */
export interface ContactFormValue {
  id?: string;
  contact?: string | null;
  cellphones: string[];
  phones: string[];
  emails: string[];
}

const clean = (value: string | null | undefined): string => String(value ?? '').trim();

/** Remove vazios e duplicatas, preservando a ordem digitada. */
export function normalizeValues(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const value = clean(raw);
    if (!value) continue;
    // Duplicata é comparada case-insensitive por causa dos e-mails; para
    // telefone dá no mesmo, já que só tem dígito e pontuação.
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

const KIND_OF: Record<keyof Omit<ContactFormValue, 'id' | 'contact'>, ContactChannelKind> = {
  cellphones: 'CELLPHONE',
  phones: 'PHONE',
  emails: 'EMAIL',
};

/** Banco → formulário: principal entra como primeiro item de cada lista. */
export function toFormValue(contact: ContactWithChannels): ContactFormValue {
  const byKind = (kind: ContactChannelKind) =>
    (contact.channels ?? [])
      .filter((channel) => channel.kind === kind)
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
      .map((channel) => channel.value);

  return {
    id: contact.id,
    contact: contact.contact ?? '',
    cellphones: normalizeValues([contact.cellphone, ...byKind('CELLPHONE')]),
    phones: normalizeValues([contact.phone, ...byKind('PHONE')]),
    emails: normalizeValues([contact.email, ...byKind('EMAIL')]),
  };
}

/**
 * Formulário → banco: o primeiro de cada lista vira o campo principal e o
 * resto vira canal. `display_order` acompanha a posição na tela, então a
 * ordem que o usuário escolheu sobrevive ao salvar/recarregar.
 */
export function toPersistedValue(form: ContactFormValue): ContactWithChannels {
  const cellphones = normalizeValues(form.cellphones);
  const phones = normalizeValues(form.phones);
  const emails = normalizeValues(form.emails);

  const channels: ContactChannel[] = [];
  const pushExtras = (values: string[], key: keyof typeof KIND_OF) => {
    values.slice(1).forEach((value, index) => {
      channels.push({ kind: KIND_OF[key], value, display_order: index + 1 });
    });
  };
  pushExtras(cellphones, 'cellphones');
  pushExtras(phones, 'phones');
  pushExtras(emails, 'emails');

  return {
    id: form.id,
    contact: clean(form.contact) || null,
    cellphone: cellphones[0] ?? null,
    phone: phones[0] ?? null,
    email: emails[0] ?? null,
    channels,
  };
}

/** Um contato só vale a pena salvar se tem nome ou algum meio de contato. */
export function hasAnyValue(form: ContactFormValue): boolean {
  return Boolean(
    clean(form.contact)
      || normalizeValues(form.cellphones).length
      || normalizeValues(form.phones).length
      || normalizeValues(form.emails).length,
  );
}

/** Todos os meios de contato, para busca/exibição resumida. */
export function allChannelValues(contact: ContactWithChannels): string[] {
  const form = toFormValue(contact);
  return [...form.cellphones, ...form.phones, ...form.emails];
}
