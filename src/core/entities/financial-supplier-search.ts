type SearchContact = {
  contact?: string | null;
  phone?: string | null;
  cellphone?: string | null;
  email?: string | null;
  channels?: Array<{ value: string; deleted_at?: Date | null }>;
};

export type SearchableSupplier = {
  legal_name?: string | null;
  trade_name?: string | null;
  cnpj?: string | null;
  cpf?: string | null;
  state_registration?: string | null;
  municipal_registration?: string | null;
  addresses?: Array<{ address?: Record<string, unknown> | null }>;
  contacts?: SearchContact[];
};

const normalize = (value: unknown): string => String(value ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const digits = (value: unknown): string => String(value ?? '').replace(/\D/g, '');

/** Busca em todos os contatos, inclusive canais extras, com ou sem máscara telefônica. */
export function matchesSupplierSearch(supplier: SearchableSupplier, searchTerm: string): boolean {
  const term = normalize(searchTerm);
  if (!term) return true;
  const numericTerm = digits(searchTerm);
  const isPhoneOrDocument = numericTerm.length >= 4 && /^[\d\s().+\-/]+$/.test(searchTerm.trim());

  const fields: unknown[] = [
    supplier.legal_name, supplier.trade_name, supplier.cnpj, supplier.cpf,
    supplier.state_registration, supplier.municipal_registration,
    ...(supplier.addresses ?? []).flatMap(({ address }) => address
      ? [address.street, address.district, address.city, address.state, address.zip_code, address.complement]
      : []),
    ...(supplier.contacts ?? []).flatMap((contact) => [
      contact.contact, contact.phone, contact.cellphone, contact.email,
      ...(contact.channels ?? []).filter((channel) => !channel.deleted_at).map((channel) => channel.value),
    ]),
  ];

  return fields.some((value) => normalize(value).includes(term)
    || (isPhoneOrDocument && digits(value).includes(numericTerm)));
}
