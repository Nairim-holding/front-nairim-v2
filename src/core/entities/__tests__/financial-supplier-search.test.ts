import { describe, expect, it } from 'vitest';
import { matchesSupplierSearch } from '../financial-supplier-search';

const supplier = {
  legal_name: 'Contato de Exemplo',
  cpf: '12345678901',
  contacts: [{
    contact: 'Adão Calheiro',
    cellphone: '14991663055',
    phone: '(14) 3471-2222',
    email: 'principal@exemplo.com.br',
    channels: [
      { value: '(14) 99888-7766' },
      { value: 'alternativo@exemplo.com.br' },
      { value: '1111-2222', deleted_at: new Date() },
    ],
  }],
};

describe('busca de contatos financeiros', () => {
  it.each(['991663055', '99166-3055', '(14) 99166-3055'])('encontra celular com a busca %s', (term) => {
    expect(matchesSupplierSearch(supplier, term)).toBe(true);
  });

  it('encontra telefone fixo, canais adicionais e e-mails sem diferenciar maiúsculas', () => {
    expect(matchesSupplierSearch(supplier, '3471-2222')).toBe(true);
    expect(matchesSupplierSearch(supplier, '998887766')).toBe(true);
    expect(matchesSupplierSearch(supplier, 'ALTERNATIVO@EXEMPLO.COM.BR')).toBe(true);
    expect(matchesSupplierSearch(supplier, 'principal@exemplo.com.br')).toBe(true);
    expect(matchesSupplierSearch(supplier, 'Adao Calheiro')).toBe(true);
  });

  it('preserva a busca por CPF e ignora canais excluídos', () => {
    expect(matchesSupplierSearch(supplier, '123.456.789-01')).toBe(true);
    expect(matchesSupplierSearch(supplier, '11112222')).toBe(false);
  });
});
