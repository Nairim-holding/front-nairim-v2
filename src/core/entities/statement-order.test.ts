import { expect, it } from 'vitest';
import { compareStatementOrder } from './statement-order';
it('ordena legado por criação/ID e novas baixas por conclusão nas duas direções', () => {
  const rows = [{id:'a',statement_order:2},{id:'c',statement_order:1},{id:'z',statement_order:null,created_at:'2026-01-01'},{id:'b',created_at:'2026-01-01'}];
  expect([...rows].sort(compareStatementOrder).map(row => row.id)).toEqual(['b','z','c','a']);
  expect([...rows].sort((a,b) => compareStatementOrder(a,b,'desc')).map(row => row.id)).toEqual(['a','c','z','b']);
});
