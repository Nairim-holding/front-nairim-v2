import { isQuickCreateSentinel, extractQuickCreateName } from '@/components/ui/QuickCreateAutocomplete';
import { quickCreateFinancialCategoryAction } from '@/server/actions/financial-category';
import { quickCreateFinancialSubcategoryAction } from '@/server/actions/financial-subcategory';
import { quickCreateFinancialCenterAction } from '@/server/actions/financial-center';
import type { ActionResult } from '@/shared/actions/action-result';

function createdId(result: ActionResult<{ id: string }>, label: string): string {
  if (!result.ok) {
    throw new Error(`Não foi possível cadastrar ${label}: ${result.errors?.join(', ') || result.error}`);
  }
  return result.data.id;
}

/** Resolve o cadastro rápido ao salvar, como nos lançamentos. */
export async function resolvePropertyQuickCreates(data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const resolved = { ...data };

  // Aluguéis e restituições de IPTU são receitas. A categoria precisa existir
  // antes de cadastrar a subcategoria, inclusive quando ambas são novas.
  for (const [categoryField, subcategoryField] of [
    ['category_id', 'subcategory_id'],
    ['iptu_refund_category_id', 'iptu_refund_subcategory_id'],
  ]) {
    const category = resolved[categoryField];
    if (typeof category === 'string' && isQuickCreateSentinel(category)) {
      resolved[categoryField] = createdId(await quickCreateFinancialCategoryAction({
        name: extractQuickCreateName(category), type: 'INCOME',
      }), 'a categoria');
    }

    const subcategory = resolved[subcategoryField];
    if (typeof subcategory === 'string' && isQuickCreateSentinel(subcategory)) {
      if (!resolved[categoryField]) throw new Error('Selecione uma categoria antes de cadastrar a subcategoria.');
      resolved[subcategoryField] = createdId(await quickCreateFinancialSubcategoryAction({
        name: extractQuickCreateName(subcategory), category_id: resolved[categoryField],
      }), 'a subcategoria');
    }
  }

  for (const [field, type] of [['center_id', 'INCOME'], ['debit_center_id', 'EXPENSE']]) {
    const value = resolved[field];
    if (typeof value === 'string' && isQuickCreateSentinel(value)) {
      resolved[field] = createdId(await quickCreateFinancialCenterAction({
        name: extractQuickCreateName(value), type,
      }), type === 'INCOME' ? 'o centro de custo de crédito' : 'o centro de custo de débito');
    }
  }

  return resolved;
}
