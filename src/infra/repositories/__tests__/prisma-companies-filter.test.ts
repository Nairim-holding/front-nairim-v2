import { describe, expect, it, vi } from 'vitest';

vi.mock('@/infra/database/prisma', () => ({ default: {} }));

import { buildCompanyListWhere } from '../prisma-companies-repository';

describe('consulta de empresas', () => {
  it('aplica nome, slug e status', () => {
    expect(buildCompanyListWhere({
      page: 1,
      limit: 100,
      search: '',
      includeInactive: false,
      name: 'Nairim',
      slug: 'nairim',
      is_active: true,
    })).toEqual({
      deleted_at: null,
      name: { contains: 'Nairim', mode: 'insensitive' },
      slug: { contains: 'nairim', mode: 'insensitive' },
      is_active: true,
    });
  });

  it('inclui soft-deletadas quando o filtro pede inativas', () => {
    expect(buildCompanyListWhere({
      page: 1,
      limit: 100,
      search: '',
      includeInactive: false,
      is_active: false,
    })).toEqual({ is_active: false });
  });
});
