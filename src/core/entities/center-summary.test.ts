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
      {id:'a',name:'Imóvel',income:1500,expense:250,balance:1250},
      {id:'b',name:'Imóvel',income:0,expense:100,balance:-100},
      {id:null,name:'Sem centro',income:0,expense:20,balance:-20},
    ]);
  });
});
