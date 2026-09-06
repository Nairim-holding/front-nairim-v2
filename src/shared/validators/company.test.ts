import { describe, expect, it } from 'vitest';
import { listCompaniesQuerySchema } from './company';

describe('filtros de empresas', () => {
  it('mantém nome, slug e status na validação da listagem', () => {
    expect(listCompaniesQuerySchema.parse({
      name: 'Nairim',
      slug: 'nairim',
      is_active: 'false',
    })).toMatchObject({
      name: 'Nairim',
      slug: 'nairim',
      is_active: false,
    });
  });
});
