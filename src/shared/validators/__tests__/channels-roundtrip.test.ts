import { describe, it, expect } from 'vitest';
import { updateOwnerSchema } from '@/shared/validators/owner';
import { updateTenantSchema } from '@/shared/validators/tenant';
import { updateAgencySchema } from '@/shared/validators/agency';
import { updateFinancialSupplierSchema } from '@/shared/validators/financial-supplier';
import { toPersistedValue } from '@/core/entities/contact-channel';

/**
 * Regressão: telefones/e-mails extras sumiam ao salvar (Etapa 3).
 *
 * O Zod descarta chave desconhecida no `.parse()` — sem erro e sem aviso. Como
 * os schemas de contato não declaravam `channels`, o formulário mandava o
 * número extra e ele era apagado antes de chegar ao repositório, salvando só o
 * principal. Os quatro cadastros tinham o mesmo furo, então todos são cobertos.
 */
describe('canais extras sobrevivem à validação', () => {
  // Mesmo caminho da tela: o form edita listas e `toPersistedValue` separa
  // principal (cellphone) dos extras (channels).
  const contact = toPersistedValue({
    contact: 'Célia Cristina Bianchi',
    cellphones: ['14996715918', '14222222222'],
    phones: [],
    emails: [],
  });

  it('separa principal e extra antes de enviar', () => {
    expect(contact.cellphone).toBe('14996715918');
    expect(contact.channels).toHaveLength(1);
  });

  const cases = [
    ['proprietário', updateOwnerSchema, { name: 'x' }],
    ['inquilino', updateTenantSchema, { name: 'x' }],
    ['imobiliária', updateAgencySchema, { name: 'x' }],
    ['fornecedor', updateFinancialSupplierSchema, { legal_name: 'x' }],
  ] as const;

  it.each(cases)('%s mantém o canal extra no parse', (_label, schema, base) => {
    const parsed = schema.parse({ ...base, contacts: [contact] }) as {
      contacts?: Array<{ channels?: Array<{ value: string; kind: string }> }>;
    };

    const channels = parsed.contacts?.[0].channels;
    expect(channels).toHaveLength(1);
    expect(channels?.[0].value).toBe('14222222222');
    expect(channels?.[0].kind).toBe('CELLPHONE');
  });

  it('imobiliária preserva um único número selecionado para alertas', () => {
    const selected = toPersistedValue({
      contact: 'Célia Cristina Bianchi',
      cellphones: ['14996715918'],
      phones: [],
      emails: [],
      whatsapp_notification_phone: '14996715918',
    });

    const parsed = updateAgencySchema.parse({ contacts: [selected] });
    expect(parsed.contacts?.[0].whatsapp_notification_phone).toBe('14996715918');
  });

  it('imobiliária rejeita número que não pertence ao contato', () => {
    expect(() => updateAgencySchema.parse({
      contacts: [{
        contact: 'Célia Cristina Bianchi',
        cellphone: '14996715918',
        whatsapp_notification_phone: '14999999999',
      }],
    })).toThrow('Selecione um telefone válido deste contato');
  });

  it('imobiliária aceita somente um número selecionado entre todos os contatos', () => {
    expect(() => updateAgencySchema.parse({
      contacts: [
        { cellphone: '14996715918', whatsapp_notification_phone: '14996715918' },
        { cellphone: '14999999999', whatsapp_notification_phone: '14999999999' },
      ],
    })).toThrow('Selecione somente um número por imobiliária');
  });
});
