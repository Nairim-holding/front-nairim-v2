import { describe, expect, it } from 'vitest';

/** Reproduz a decisão do DynamicForm sobre `searchable`. */
const resolveSearchable = (fieldName: string, explicit?: boolean) =>
  explicit ?? (fieldName.endsWith('_id') || undefined);

const SEARCHABLE_THRESHOLD = 4;
const isSearchable = (searchable: boolean | undefined, optionCount: number) =>
  searchable ?? optionCount > SEARCHABLE_THRESHOLD;

describe('busca nos selects', () => {
  it('campo de relacionamento tem busca mesmo com poucas opções', () => {
    for (const f of ['tenant_id','agency_id','property_id','category_id','card_id','owner_id']) {
      expect(isSearchable(resolveSearchable(f), 2), f).toBe(true);
    }
  });

  it('enum fixo curto não ganha caixa de busca', () => {
    expect(isSearchable(resolveSearchable('marital_status'), 3)).toBe(false);
    expect(isSearchable(resolveSearchable('furnished'), 2)).toBe(false);
  });

  it('enum longo ainda ganha busca pelo tamanho', () => {
    expect(isSearchable(resolveSearchable('marital_status'), 9)).toBe(true);
  });

  it('searchable explícito vence a inferência', () => {
    expect(isSearchable(resolveSearchable('tenant_id', false), 2)).toBe(false);
  });
});
