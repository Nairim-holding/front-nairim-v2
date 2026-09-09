import { describe, expect, it } from 'vitest';
import { findOccupyingLease } from './property-occupancy';

const now = new Date('2026-09-09T12:00:00Z');
const expired = { status: 'ACTIVE', end_date: '2026-08-30', tenant: { name: 'João Gabriel Santos' } };

describe('contrato que bloqueia o status do imóvel', () => {
  it('libera o caso Maceió, 309 mesmo se o status do contrato vencido ainda for ACTIVE', () => {
    expect(findOccupyingLease([expired], now)).toBeUndefined();
  });

  it('encontra outro contrato não vencido depois do histórico antigo', () => {
    const current = { ...expired, end_date: '2026-10-01' };
    expect(findOccupyingLease([expired, current], now)).toBe(current);
  });

  it('ignora contratos cancelados e excluídos mesmo com vencimento futuro', () => {
    expect(findOccupyingLease([
      { status: 'CANCELED', end_date: '2027-01-01' },
      { status: 'ACTIVE', end_date: '2027-01-01', deleted_at: '2026-09-01' },
    ], now)).toBeUndefined();
  });

  it('mantém o bloqueio até o fim do dia do vencimento em São Paulo', () => {
    expect(findOccupyingLease([expired], new Date('2026-08-31T02:59:59Z'))).toBe(expired);
    expect(findOccupyingLease([expired], new Date('2026-08-31T03:00:00Z'))).toBeUndefined();
  });

  it('reserva o imóvel com contrato futuro, como no cálculo do banco', () => {
    const future = { status: 'ACTIVE', start_date: '2027-01-01', end_date: new Date('2027-12-31T00:00:00Z') };
    expect(findOccupyingLease([future], now)).toBe(future);
  });

  it('não informa inquilino atual quando não há contratos', () => {
    expect(findOccupyingLease(undefined, now)).toBeUndefined();
    expect(findOccupyingLease([], now)).toBeUndefined();
  });
});
