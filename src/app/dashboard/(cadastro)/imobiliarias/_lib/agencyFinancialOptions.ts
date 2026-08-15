/* eslint-disable @typescript-eslint/no-explicit-any */
// Busca categoria/subcategoria financeira via Server Actions (sessão do cookie),
// sem fetch client-side ao Express — mesma lógica de imoveis/_lib/propertyData.ts.

import { listCategoriesAction } from '@/server/actions/financial-category';
import { listSubcategoriesAction } from '@/server/actions/financial-subcategory';

export interface SelectOption {
  label: string;
  value: string;
}

export interface AgencyFinancialOptions {
  categoryOptions: SelectOption[];
  subcategoriesRaw: { id: string; name: string; category_id: string }[];
}

export async function fetchAgencyFinancialOptions(): Promise<AgencyFinancialOptions> {
  const [categoriesRes, subcategoriesRes] = await Promise.all([
    listCategoriesAction({ limit: 100, 'filter[is_active]': 'true' }),
    listSubcategoriesAction({ limit: 100, 'filter[is_active]': 'true' }),
  ]);

  const categories = categoriesRes.ok ? (categoriesRes.data?.data || categoriesRes.data || []) : [];
  const subcategories = subcategoriesRes.ok ? (subcategoriesRes.data?.data || subcategoriesRes.data || []) : [];

  // Mantém apenas categorias do usuário — remove as criadas pelo sistema (is_system).
  const categoryList = categories.filter((c: any) => !c.is_system);
  const userCategoryIds = new Set(categoryList.map((c: any) => c.id));
  const subcategoryList = subcategories.filter((s: any) => userCategoryIds.has(s.category_id));

  return {
    categoryOptions: categoryList.map((c: any) => ({ label: c.name, value: c.id })),
    subcategoriesRaw: subcategoryList.map((s: any) => ({ id: s.id, name: s.name, category_id: s.category_id })),
  };
}