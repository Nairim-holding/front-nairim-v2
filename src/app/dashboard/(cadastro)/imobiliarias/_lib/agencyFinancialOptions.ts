/* eslint-disable @typescript-eslint/no-explicit-any */
// Mesma lógica usada em imoveis/_lib/propertyTransform.ts: busca categoria/subcategoria
// financeira no servidor (com o token do cookie), evitando o fetch client-side sem
// Authorization que deixava as listas vazias.

export interface SelectOption {
  label: string;
  value: string;
}

export interface AgencyFinancialOptions {
  categoryOptions: SelectOption[];
  subcategoriesRaw: { id: string; name: string; category_id: string }[];
}

function getApiUrl(): string {
  return process.env.NEXT_PUBLIC_URL_API ?? '';
}

function authHeaders(token?: string): HeadersInit | undefined {
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

export async function fetchAgencyFinancialOptions(token?: string): Promise<AgencyFinancialOptions> {
  const API_URL = getApiUrl();
  const headers = authHeaders(token);

  const [categoriesRes, subcategoriesRes] = await Promise.all([
    fetch(`${API_URL}/financial-category?limit=1000&filter[is_active]=true`, { cache: 'no-store', headers }),
    fetch(`${API_URL}/financial-subcategory?limit=1000&filter[is_active]=true`, { cache: 'no-store', headers }),
  ]);

  const [categories, subcategories] = await Promise.all([
    categoriesRes.ok ? categoriesRes.json() : Promise.resolve({ data: [] }),
    subcategoriesRes.ok ? subcategoriesRes.json() : Promise.resolve({ data: [] }),
  ]);

  // Mantém apenas categorias do usuário — remove as criadas pelo sistema (is_system).
  const categoryList = (categories.data || []).filter((c: any) => !c.is_system);
  const userCategoryIds = new Set(categoryList.map((c: any) => c.id));
  const subcategoryList = (subcategories.data || []).filter((s: any) => userCategoryIds.has(s.category_id));

  return {
    categoryOptions: categoryList.map((c: any) => ({ label: c.name, value: c.id })),
    subcategoriesRaw: subcategoryList.map((s: any) => ({ id: s.id, name: s.name, category_id: s.category_id })),
  };
}
