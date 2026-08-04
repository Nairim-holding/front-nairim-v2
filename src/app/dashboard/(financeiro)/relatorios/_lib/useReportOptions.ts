import { useEffect, useState } from 'react';
import { authFetch } from '@/utils/authFetch';
import type { ReportOptions } from './types';

const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';

const EMPTY_OPTIONS: ReportOptions = {
  institutions: [],
  cards: [],
  incomeCategories: [],
  expenseCategories: [],
  subcategoriesByCategory: {},
  centers: [],
};

/** Carrega os catálogos usados nos filtros de Relatórios (Instituição, Cartão, Categoria/Subcategoria, Centro). */
export function useReportOptions() {
  const [options, setOptions] = useState<ReportOptions>(EMPTY_OPTIONS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [catRes, subRes, instRes, cardRes, centRes] = await Promise.all([
          authFetch(`${API_URL}/financial-category?limit=1000&filter[is_active]=true`),
          authFetch(`${API_URL}/financial-subcategory?limit=1000&filter[is_active]=true`),
          authFetch(`${API_URL}/financial-institution?limit=1000`),
          authFetch(`${API_URL}/financial-card?limit=1000&filter[is_active]=true`),
          authFetch(`${API_URL}/financial-center?limit=1000`),
        ]);
        const [cats, subs, insts, cards, cents] = await Promise.all([
          catRes.json(), subRes.json(), instRes.json(), cardRes.json(), centRes.json(),
        ]);

        if (cancelled) return;

        const allCategories = (cats?.data ?? cats ?? []) as Array<{ id: string; name: string; type: string }>;
        const subcategoriesByCategory: Record<string, { label: string; value: string }[]> = {};
        (subs?.data ?? subs ?? []).forEach((sub: { id: string; name: string; category_id: string }) => {
          if (!subcategoriesByCategory[sub.category_id]) subcategoriesByCategory[sub.category_id] = [];
          subcategoriesByCategory[sub.category_id].push({ label: sub.name, value: sub.id });
        });

        setOptions({
          institutions: (insts?.data ?? insts ?? []).map((i: { id: string; name: string; is_active: boolean }) => ({
            label: i.name,
            value: i.id,
            isActive: i.is_active,
          })),
          cards: (cards?.data ?? cards ?? []).map((c: { id: string; name: string }) => ({ label: c.name, value: c.id })),
          incomeCategories: allCategories
            .filter((c) => c.type === 'INCOME')
            .map((c) => ({ label: c.name, value: c.id })),
          expenseCategories: allCategories
            .filter((c) => c.type === 'EXPENSE')
            .map((c) => ({ label: c.name, value: c.id })),
          subcategoriesByCategory,
          centers: (cents?.data ?? cents ?? []).map((c: { id: string; name: string; type: 'INCOME' | 'EXPENSE' }) => ({
            label: c.name,
            value: c.id,
            type: c.type,
          })),
        });
      } catch (error) {
        console.error('[useReportOptions] Erro ao carregar opções de filtro:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { options, isLoading };
}
