# Resumo — Padrões de código

## Buscar uma aba a partir do cliente
Origem: `src/lib/dashboard.ts` (`fetchSection`).
```ts
const result = await getDashboardSectionAction(section, start, end, options.companyIds);
if (!result.ok) {
  const error = new Error(result.error) as Error & { status?: number };
  error.status = result.status;   // a tela distingue 403 de falha real
  throw error;
}
```

## Query com guarda de permissão
Origem: `src/server/queries/dashboard.ts` e `owner.ts` (mesmo molde).
```ts
return withPermission('dashboard', 'view', () => useCase.execute({ startDate, endDate }));
```

## Visibilidade de gráficos por usuário
Origem: `src/layout/DashboardLayout/sections/index.tsx`.
```ts
const { visibleWidgetIds, setVisibleWidgetIds } =
  useWidgetVisibility('financeiro-v5', FINANCIAL_WIDGET_IDS, ['widget-21']);
```
O 3º argumento lista ids novos que devem aparecer mesmo para quem já salvou preferências.

## Período por seção sem recarregar a página
Origem: `useSectionPeriod` em `sections/index.tsx`: guarda anos, meses e "limpo"; só chama `onRangeChange(start, end)` quando muda (a 1ª renderização não dispara, exceto no Portfólio, que começa limpo). Não use `router.push` para trocar período: remonta a árvore e apaga o estado do filtro.

## Pegadinhas
- Mantenha `getDefaultDateRange()` (`lib/dashboard.ts`) em sincronia com o padrão de `useSectionPeriod`; os dois alimentam o primeiro carregamento e já divergiram uma vez ("Ano inteiro" no cabeçalho com dados do mês).
- Tooltips ECharts recebem texto do banco: use `utils/echartsTooltip.ts` (escapa título, rótulos e valores).
- `src/app/layout.tsx` continua Server Component; nada de `'use client'` ali.
