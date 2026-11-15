import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import SummaryPanel from './index';

it('exibe receitas e despesas previstas e usa o resumo previsto no fechamento', () => {
  const html = renderToStaticMarkup(createElement(SummaryPanel, {
    summary: {
      receitasPrevisto: 2075.63,
      receitasRecebido: 29863.54,
      despesasPrevisto: 921.08,
      despesasPago: 55054.22,
      saldoContas: 57978.54,
    },
  }));
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  expect(text).toContain('Total a Receber R$ 31.939,17 Total a Pagar R$ 55.975,30 Resumo Previsto -R$ 24.036,13');
  expect(text).toContain('Receitas Previsto R$ 31.939,17 Recebido R$ 29.863,54 Falta a Receber R$ 2.075,63');
  expect(text).toContain('Despesas Previsto R$ 55.975,30 Pago R$ 55.054,22 Falta a Pagar R$ 921,08');
  expect(text).toContain('Saldo da(s) conta(s) R$ 57.978,54 Previsto Restante -R$ 24.036,13 Previsão de Fechamento R$ 33.942,41');
});
