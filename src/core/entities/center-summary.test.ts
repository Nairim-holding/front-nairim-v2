import { describe, expect, it } from 'vitest';
import { buildCenterSummary } from './center-summary';
describe('Receitas e despesas por centro', () => {
  it('soma categorias por ID do centro, preserva centros com nomes iguais e lançamentos sem centro', () => {
    const result = buildCenterSummary([
      {center_id:'a',category_id:'in',amount:1000}, {center_id:'a',category_id:'in2',amount:500},
      {center_id:'a',category_id:'out',amount:250}, {center_id:'b',category_id:'out',amount:100},
      {center_id:null,category_id:'out',amount:20}, {center_id:'a',category_id:'unknown',amount:10},
    ], [{id:'a',name:'Imóvel'}, {id:'b',name:'Imóvel'}], [{id:'in',type:'INCOME'},{id:'in2',type:'INCOME'},{id:'out',type:'EXPENSE'}]);
    expect(result).toEqual([
      {id:'a',centerIds:['a'],name:'Imóvel',income:1500,expense:250,balance:1250},
      {id:'b',centerIds:['b'],name:'Imóvel',income:0,expense:100,balance:-100},
      {id:null,centerIds:[null],name:'Sem centro',income:0,expense:20,balance:-20},
    ]);
  });
  const categories = [{id:'in',type:'INCOME'},{id:'out',type:'EXPENSE'}];
  it('pairs a property credit and debit center even when their names differ', () => {
    const result = buildCenterSummary([{center_id:'cr',category_id:'in',amount:1500},{center_id:'db',category_id:'out',amount:250}],
      [{id:'cr',name:'Aluguel',company_id:'a'},{id:'db',name:'Manutenção',company_id:'a'}], categories,
      [{id:'property',title:'Rua América, 389',company_id:'a',center_id:'cr',debit_center_id:'db'}]);
    expect(result).toEqual([{id:'property:property',centerIds:['cr','db'],name:'Rua América, 389',income:1500,expense:250,balance:1250}]);
  });
  it('pairs legacy CR/DB names and orders the combined blocks by total movement', () => {
    const result = buildCenterSummary([
      {center_id:'a-cr',category_id:'in',amount:1500},{center_id:'a-db',category_id:'out',amount:250},
      {center_id:'b-cr',category_id:'in',amount:100},{center_id:'b-db',category_id:'out',amount:2000},
    ],[{id:'a-cr',name:'Rua América, 389 (CR)',company_id:'a',type:'INCOME'},{id:'a-db',name:' rua  américa, 389 (db) ',company_id:'a',type:'EXPENSE'},
      {id:'b-cr',name:'Rua Alemanha, 280 (CR)',company_id:'a',type:'INCOME'},{id:'b-db',name:'Rua Alemanha, 280 (DB)',company_id:'a',type:'EXPENSE'}],categories);
    expect(result).toEqual([
      {id:'b-cr',centerIds:['b-cr','b-db'],name:'Rua Alemanha, 280',income:100,expense:2000,balance:-1900},
      {id:'a-cr',centerIds:['a-cr','a-db'],name:'Rua América, 389',income:1500,expense:250,balance:1250},
    ]);
  });
  it('keeps equal addresses from different companies independent', () => {
    const result = buildCenterSummary([{center_id:'cr-a',category_id:'in',amount:1500},{center_id:'db-b',category_id:'out',amount:250}],
      [{id:'cr-a',name:'Casa (CR)',company_id:'a'},{id:'db-b',name:'Casa (DB)',company_id:'b'}],categories);
    expect(result).toHaveLength(2);
    expect(result.map(row=>[row.income,row.expense])).toEqual([[1500,0],[0,250]]);
  });
  it('does not infer a pair from ambiguous duplicate names or shared property centers', () => {
    const centers = [{id:'cr',name:'Casa (CR)',company_id:'a'},{id:'db',name:'Casa (DB)',company_id:'a'},{id:'db2',name:'Casa (DB)',company_id:'a'}];
    const totals = centers.map(center=>({center_id:center.id,category_id:center.id==='cr'?'in':'out',amount:100}));
    expect(buildCenterSummary(totals,centers,categories)).toHaveLength(3);
    expect(buildCenterSummary(totals,centers,categories,[
      {id:'p1',title:'Casa 1',company_id:'a',center_id:'cr',debit_center_id:'db'},
      {id:'p2',title:'Casa 2',company_id:'a',center_id:'cr',debit_center_id:'db2'},
    ])).toHaveLength(3);
  });
  it('keeps a property block when only one side has movements and preserves uncategorized totals', () => {
    const result = buildCenterSummary([{center_id:'db',category_id:'out',amount:250},{center_id:null,category_id:'in',amount:50}],
      [{id:'db',name:'Manutenção',company_id:'a'}],categories,
      [{id:'p',title:'Casa',company_id:'a',center_id:'cr',debit_center_id:'db'}]);
    expect(result).toEqual([{id:'property:p',centerIds:['db'],name:'Casa',income:0,expense:250,balance:-250},{id:null,centerIds:[null],name:'Sem centro',income:50,expense:0,balance:50}]);
  });

  it('does not join named CR/DB centers linked to different properties', () => {
    const result = buildCenterSummary([{center_id:'cr',category_id:'in',amount:1000},{center_id:'db',category_id:'out',amount:250}],
      [{id:'cr',name:'Casa (CR)',company_id:'a'},{id:'db',name:'Casa (DB)',company_id:'a'}],categories,
      [{id:'p1',title:'Casa 1',company_id:'a',center_id:'cr',debit_center_id:null},{id:'p2',title:'Casa 2',company_id:'a',center_id:null,debit_center_id:'db'}]);
    expect(result).toHaveLength(2);
  });

});
