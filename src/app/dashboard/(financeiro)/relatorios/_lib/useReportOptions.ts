import { useEffect, useState } from 'react';
import type { ReportOptions } from './types';
import { type ActionResult } from '@/shared/actions/action-result';
import { listCategoriesAction } from '@/server/actions/financial-category';
import { listSubcategoriesAction } from '@/server/actions/financial-subcategory';
import { listFinancialInstitutionsAction } from '@/server/actions/financial-institution';
import { listCardsAction } from '@/server/actions/financial-card';
import { listCentersAction } from '@/server/actions/financial-center';

const EMPTY_OPTIONS: ReportOptions = {
  institutions: [],
  cards: [],
  incomeCategories: [],
  expenseCategories: [],
  subcategoriesByCategory: {},
  centers: [],
};

/** Extrai o array `data` de um ActionResult paginado. */
function getActionData<T>(result: ActionResult<{ data: T[] }>): T[] {
  return result.ok ? result.data.data : [];
}

/** Carrega os catálogos usados nos filtros de Relatórios (Instituição, Cartão, Categoria/Subcategoria, Centro). */
export function useReportOptions() {
  const [options, setOptions] = useState<ReportOptions>(EMPTY_OPTIONS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [catRes, subRes, instRes, cardRes, centRes] = await Promise.all([
          listCategoriesAction({ limit: 100, 'filter[is_active]': 'true' }),
          listSubcategoriesAction({ limit: 100, 'filter[is_active]': 'true' }),
          listFinancialInstitutionsAction({ limit: 100 }),
          listCardsAction({ limit: 100, 'filter[is_active]': 'true' }),
          listCentersAction({ limit: 100 }),
        ]);
        const [cats, subs, insts, cards, cents] = await Promise.all([
          getActionData(catRes),
          getActionData(subRes),
          getActionData(instRes),
          getActionData(cardRes),
          getActionData(centRes),
        ]);

        if (cancelled) return;

        const subcategoriesByCategory: Record<string, { label: string; value: string }[]> = {};
        subs.forEach((sub) => {
          if (!subcategoriesByCategory[sub.category_id]) subcategoriesByCategory[sub.category_id] = [];
          subcategoriesByCategory[sub.category_id].push({ label: sub.name, value: sub.id });
        });

        setOptions({
          institutions: insts.map((i) => ({
            label: i.name,
            value: i.id,
            isActive: i.is_active,
          })),
          cards: cards.map((c) => ({ label: c.name, value: c.id })),
          incomeCategories: cats
            .filter((c) => c.type === 'INCOME')
            .map((c) => ({ label: c.name, value: c.id })),
          expenseCategories: cats
            .filter((c) => c.type === 'EXPENSE')
            .map((c) => ({ label: c.name, value: c.id })),
          subcategoriesByCategory,
          centers: cents.map((c) => ({
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
