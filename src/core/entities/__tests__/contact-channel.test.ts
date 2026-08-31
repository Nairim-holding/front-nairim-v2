import { describe, expect, it } from 'vitest';
import {
  allChannelValues,
  hasAnyValue,
  normalizeValues,
  toFormValue,
  toPersistedValue,
} from '@/core/entities/contact-channel';

describe('normalização dos valores', () => {
  it('descarta vazios e espaços em branco', () => {
    expect(normalizeValues(['  ', '', null, undefined, '(11) 99999-0000'])).toEqual(['(11) 99999-0000']);
  });

  it('remove duplicatas preservando a ordem digitada', () => {
    expect(normalizeValues(['a@x.com', 'b@x.com', 'A@X.com'])).toEqual(['a@x.com', 'b@x.com']);
  });
});

describe('banco → formulário', () => {
  it('coloca o principal como primeiro item de cada lista', () => {
    const form = toFormValue({
      id: 'c1',
      contact: 'Maria',
      cellphone: '(11) 90000-0001',
      phone: '(11) 3000-0001',
      email: 'maria@x.com',
      channels: [
        { kind: 'CELLPHONE', value: '(11) 90000-0002', display_order: 1 },
        { kind: 'EMAIL', value: 'maria.alt@x.com', display_order: 1 },
      ],
    });
    expect(form.cellphones).toEqual(['(11) 90000-0001', '(11) 90000-0002']);
    expect(form.phones).toEqual(['(11) 3000-0001']);
    expect(form.emails).toEqual(['maria@x.com', 'maria.alt@x.com']);
  });

  it('respeita display_order dos canais', () => {
    const form = toFormValue({
      cellphone: null,
      channels: [
        { kind: 'CELLPHONE', value: 'segundo', display_order: 2 },
        { kind: 'CELLPHONE', value: 'primeiro', display_order: 1 },
      ],
    });
    expect(form.cellphones).toEqual(['primeiro', 'segundo']);
  });

  it('lida com contato sem nenhum canal', () => {
    expect(toFormValue({ contact: 'Sozinho' })).toEqual({
      id: undefined,
      contact: 'Sozinho',
      cellphones: [],
      phones: [],
      emails: [],
    });
  });
});

describe('formulário → banco', () => {
  it('manda o primeiro para o campo principal e o resto para canais', () => {
    const persisted = toPersistedValue({
      contact: 'Maria',
      cellphones: ['(11) 90000-0001', '(11) 90000-0002', '(11) 90000-0003'],
      phones: [],
      emails: ['maria@x.com'],
    });
    expect(persisted.cellphone).toBe('(11) 90000-0001');
    expect(persisted.phone).toBeNull();
    expect(persisted.email).toBe('maria@x.com');
    expect(persisted.channels).toEqual([
      { kind: 'CELLPHONE', value: '(11) 90000-0002', display_order: 1 },
      { kind: 'CELLPHONE', value: '(11) 90000-0003', display_order: 2 },
    ]);
  });

  it('ignora linhas vazias deixadas no formulário', () => {
    const persisted = toPersistedValue({
      contact: 'Maria',
      cellphones: ['(11) 90000-0001', '', '   '],
      phones: [''],
      emails: [],
    });
    expect(persisted.cellphone).toBe('(11) 90000-0001');
    expect(persisted.channels).toEqual([]);
  });

  it('sobrevive a ida e volta sem perder valor', () => {
    const original = {
      id: 'c1',
      contact: 'Maria',
      cellphones: ['(11) 90000-0001', '(11) 90000-0002'],
      phones: ['(11) 3000-0001'],
      emails: ['maria@x.com', 'maria.alt@x.com'],
    };
    expect(toFormValue(toPersistedValue(original))).toEqual(original);
  });
});

describe('utilitários', () => {
  it('reconhece contato sem nenhum dado', () => {
    expect(hasAnyValue({ contact: '', cellphones: [''], phones: [], emails: [] })).toBe(false);
    expect(hasAnyValue({ contact: '', cellphones: ['(11) 90000-0001'], phones: [], emails: [] })).toBe(true);
  });

  it('lista todos os meios de contato', () => {
    expect(
      allChannelValues({
        cellphone: '(11) 90000-0001',
        email: 'maria@x.com',
        channels: [{ kind: 'EMAIL', value: 'alt@x.com', display_order: 1 }],
      }),
    ).toEqual(['(11) 90000-0001', 'maria@x.com', 'alt@x.com']);
  });
});
