import 'server-only';
import { listOwnersData } from '@/server/queries/owner';
import { listPropertyTypesData } from '@/server/queries/property-type';
import { listAgenciesData } from '@/server/queries/agency';
import { listFinancialCentersData } from '@/server/queries/financial-center';
import { listFinancialCategoriesData } from '@/server/queries/financial-category';
import { listFinancialSubcategoriesData } from '@/server/queries/financial-subcategory';
import { getPropertyByIdData } from '@/server/queries/property';
import type { Category } from '@/core/entities/category';
import type { Subcategory } from '@/core/entities/subcategory';
import type { Property } from '@/core/entities/property';
import {
  buildOwnerOptions,
  buildTypeOptions,
  buildAgencyOptions,
  buildCenterOptions,
  buildCategoryOptions,
  buildSubcategoryOptions,
  type PropertySelectOptions,
} from './propertyTransform';

// Substitui os antigos fetches HTTP ao Express (fetchPropertySelectOptions /
// fetchProperty) por consultas diretas via server queries (withTenant). O
// parâmetro `token` é mantido por compatibilidade de assinatura, mas não é mais
// utilizado — o guard de tenancy agora vem da sessão do servidor Next.

export async function fetchPropertySelectOptions(_token?: string): Promise<PropertySelectOptions> {
  // ⚠️ Achado em teste E2E (2026-08-13): os validadores Zod de listagem (owner,
  // property-type, agency, financial-category, financial-subcategory) impõem
  // `limit` máximo de 100 — diferente do Express, onde esse teto só era
  // imposto de verdade em alguns controllers (ex.: property-type) e em outros
  // (owner, agency) era código morto nunca chamado na listagem. Como o port
  // Zod valida sempre, `limit` acima de 100 aqui quebra a página inteira com
  // 500. Capado em 100 em todos — se alguma empresa tiver mais de 100
  // proprietários/tipos/imobiliárias/categorias ativas, paginar em vez de
  // aumentar este número.
  const [owners, types, agencies, creditCenters, debitCenters, categories, subcategories] =
    await Promise.all([
      listOwnersData({ limit: 100 }),
      listPropertyTypesData({ limit: 100 }),
      listAgenciesData({ limit: 100 }),
      listFinancialCentersData({ limit: 100, 'filter[type]': 'INCOME' }),
      listFinancialCentersData({ limit: 100, 'filter[type]': 'EXPENSE' }),
      listFinancialCategoriesData({ limit: 100, 'filter[is_active]': 'true' }),
      listFinancialSubcategoriesData({ limit: 100, 'filter[is_active]': 'true' }),
    ]);

  const creditCenterList = creditCenters.data ?? [];
  const debitCenterList = debitCenters.data ?? [];

  // Mantém apenas categorias do USUÁRIO — remove as criadas pelo sistema (is_system).
  const categoryList = (categories.data ?? []).filter((c: Category) => !c.is_system);
  const userCategoryIds = new Set(categoryList.map((c: Category) => c.id));
  const subcategoryList = (subcategories.data ?? []).filter((s: Subcategory) =>
    userCategoryIds.has(s.category_id),
  );

  return {
    ownerOptions: buildOwnerOptions(owners.data ?? []),
    typeOptions: buildTypeOptions(types.data ?? []),
    agencyOptions: buildAgencyOptions(agencies.data ?? []),
    centerOptions: buildCenterOptions(creditCenterList),
    creditCenterOptions: buildCenterOptions(creditCenterList),
    debitCenterOptions: buildCenterOptions(debitCenterList),
    categoryOptions: buildCategoryOptions(categoryList),
    subcategoryOptions: buildSubcategoryOptions(subcategoryList, categoryList),
    subcategoriesRaw: subcategoryList.map((s) => ({
      id: s.id,
      name: s.name,
      category_id: s.category_id,
    })),
  };
}

export async function fetchProperty(id: string, _token?: string): Promise<Property> {
  return getPropertyByIdData(id);
}