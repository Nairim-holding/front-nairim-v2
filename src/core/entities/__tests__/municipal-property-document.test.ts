import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildMunicipalPrefill,
  layoutFromTextItems,
  mergeMunicipalDocuments,
  parseBrazilianNumber,
  parseMunicipalPropertyDocument,
  sameMunicipalProperty,
  titleCase,
  type PdfPageLayout,
} from '@/core/entities/municipal-property-document';

/**
 * Fixtures: trechos de texto crus (texto + posição) dos PDFs de exemplo do
 * cliente — carnê de IPTU e Ficha Cadastral da Prefeitura de Garça —, com
 * nomes, documentos, endereço e cadastro trocados por valores fictícios.
 */
function loadLayout(name: string): PdfPageLayout[] {
  const raw = JSON.parse(readFileSync(join(__dirname, 'fixtures', name), 'utf8')) as { pages: Array<Array<[string, number, number, number, number]>> };
  return raw.pages.map((items) => layoutFromTextItems(items.map(([text, a, b, e, f]) => ({ text, transform: [a, b, 0, 0, e, f] }))));
}

const ficha = () => parseMunicipalPropertyDocument(loadLayout('garca-ficha-cadastral.json'))!;
const iptu = () => parseMunicipalPropertyDocument(loadLayout('garca-iptu.json'))!;

describe('Ficha Cadastral — Prefeitura de Garça', () => {
  it('lê os dados cadastrais do imóvel', () => {
    expect(ficha()).toMatchObject({
      kind: 'FICHA_CADASTRAL',
      municipality: 'Garça',
      state: 'SP',
      year: 2026,
      registrationNumber: '0001234500',
      taxRegistration: 'RM 12345',
      ownerName: 'EMPRESA EXEMPLO LTDA.',
      ownerDocument: '11222333000181',
      street: 'Rua das Flores',
      number: '309',
      district: 'Jardim Exemplo',
      zipCode: '17400-000',
      sector: null,
      block: '17A',
      lot: '43P44P',
      unit: '1',
      landArea: 200,
      builtArea: 145.82,
      frontage: 10,
      linearMeasure: '10.00X20.00',
      marketValue: 143178.19,
      zoning: '1ª Zona',
      buildingType: 'Tijolos Media',
      usage: 'Residencial',
      architecturalType: 'Casa',
      iptu: null,
    });
  });

  it('não confunde o endereço do imóvel com o de correspondência', () => {
    const data = ficha();
    expect(data.street).not.toContain('Acacias');
    expect(data.zipCode).not.toBe('17400-001');
  });
});

describe('Carnê de IPTU — Prefeitura de Garça', () => {
  it('lê os dados cadastrais do demonstrativo, sem os cortes do cabeçalho', () => {
    expect(iptu()).toMatchObject({
      kind: 'IPTU',
      year: 2026,
      registrationNumber: '0001234500',
      taxRegistration: 'RM 12345',
      ownerName: 'EMPRESA EXEMPLO LTDA.',
      // O carnê traz o CNPJ sem os dois últimos dígitos: não serve para localizar o proprietário.
      ownerDocument: null,
      street: 'Das Flores',
      number: '309',
      district: 'Jardim Exemplo',
      zipCode: '17400-000',
      sector: null,
      block: '17A',
      lot: '43P44P',
      unit: '1',
      landArea: 200,
      builtArea: 145.82,
      frontage: 10,
      marketValue: 143178.19,
      zoning: '1ª Zona',
      buildingType: 'Tijolos Media',
    });
  });

  it('lê o imposto, as cotas com desconto e as parcelas', () => {
    const tax = iptu().iptu!;
    expect(tax.year).toBe(2026);
    expect(tax.total).toBe(629.98);
    expect(tax.cash).toEqual({ dueDate: '2026-03-10', amount: 535.48 });
    expect(tax.discounted).toEqual({ dueDate: '2026-04-10', amount: 510.29 });
    expect(tax.installments).toHaveLength(10);
    expect(tax.installments[0]).toEqual({ number: 1, dueDate: '2026-03-10', amount: 62.99 });
    expect(tax.installments[2]).toEqual({ number: 3, dueDate: '2026-05-11', amount: 62.99 });
    expect(tax.installments[9]).toEqual({ number: 10, dueDate: '2026-12-10', amount: 63.07 });
    // As parcelas fecham com o imposto do demonstrativo.
    expect(Math.round(tax.installments.reduce((sum, item) => sum + item.amount, 0) * 100) / 100).toBe(629.98);
  });
});

describe('junção e preenchimento do cadastro', () => {
  it('junta os dois documentos: cadastro da ficha, IPTU do carnê', () => {
    const merged = mergeMunicipalDocuments([iptu(), ficha()])!;
    expect(merged.ownerDocument).toBe('11222333000181');
    expect(merged.street).toBe('Rua das Flores');
    expect(merged.usage).toBe('Residencial');
    expect(merged.iptu?.installments).toHaveLength(10);
  });

  it('recusa documentos de imóveis diferentes', () => {
    expect(sameMunicipalProperty([iptu(), ficha()])).toBe(true);
    expect(sameMunicipalProperty([iptu(), { ...ficha(), registrationNumber: '0009999999' }])).toBe(false);
  });

  it('monta os campos do formulário nos formatos que ele usa', () => {
    const merged = mergeMunicipalDocuments([iptu(), ficha()])!;
    const { fields, warnings } = buildMunicipalPrefill(merged, {
      owner: { id: 'owner-1', name: 'Empresa Exemplo Ltda.' },
      propertyType: { id: 'type-1', description: 'Casa' },
    });
    const value = (field: string) => fields.find((item) => item.field === field)?.value;

    expect(value('title')).toBe('Rua das Flores, 309');
    expect(value('registration_number')).toBe('0001234500');
    expect(value('tax_registration')).toBe('RM 12345');
    expect(value('owner_id')).toBe('owner-1');
    expect(value('type_id')).toBe('type-1');
    expect(value('area_total')).toBe('200,00');
    expect(value('area_built')).toBe('145,82');
    expect(value('frontage')).toBe('10,00');
    expect(value('zip_code')).toBe('17400-000');
    expect(value('city')).toBe('Garça');
    expect(value('state')).toBe('SP');
    expect(value('block')).toBe('17A');
    expect(value('lot')).toBe('43P44P');
    expect(String(value('market_value')).replace(/\s/g, ' ')).toBe('R$ 143.178,19');
    expect(String(value('property_tax')).replace(/\s/g, ' ')).toBe('R$ 629,98');

    const [entry] = value('iptus') as Array<Record<string, unknown>>;
    expect(entry).toMatchObject({ year: 2026, payment_condition: 'INSTALLMENTS', property_tax: 629.98, iptu_installments_count: 10 });
    expect((entry.iptu_installments as unknown[])[0]).toEqual({ due_date: '2026-03-10', value: 62.99 });

    // O que não tem campo próprio vai para as Observações.
    expect(value('notes')).toContain('Zoneamento: 1ª Zona');
    expect(value('notes')).toContain('Medida linear: 10.00X20.00');
    expect(warnings.some((warning) => warning.includes('cota única'))).toBe(true);
  });

  it('avisa quando o proprietário não está cadastrado, sem inventar vínculo', () => {
    const { fields, warnings } = buildMunicipalPrefill(ficha());
    expect(fields.some((item) => item.field === 'owner_id')).toBe(false);
    expect(warnings.some((warning) => warning.includes('não está cadastrado'))).toBe(true);
  });
});

describe('apoio', () => {
  it('devolve null para um layout desconhecido', () => {
    const layout = [layoutFromTextItems([{ text: 'Prefeitura Municipal de Marília', transform: [10, 0, 0, 10, 40, 800] }, { text: 'IPTU 2026', transform: [10, 0, 0, 10, 40, 780] }])];
    expect(parseMunicipalPropertyDocument(layout)).toBeNull();
  });

  it('monta as linhas de página normal e de página girada', () => {
    const normal = layoutFromTextItems([
      { text: 'B', transform: [8, 0, 0, 8, 100, 700] },
      { text: 'A', transform: [8, 0, 0, 8, 20, 701] },
      { text: 'C', transform: [8, 0, 0, 8, 20, 650] },
    ]);
    expect(normal.map((row) => row.tokens.map((token) => token.text))).toEqual([['A', 'B'], ['C']]);

    const rotated = layoutFromTextItems([
      { text: 'B', transform: [0, 8, 0, 0, 30, 100] },
      { text: 'A', transform: [0, 8, 0, 0, 31, 20] },
      { text: 'C', transform: [0, 8, 0, 0, 80, 20] },
    ]);
    expect(rotated.map((row) => row.tokens.map((token) => token.text))).toEqual([['A', 'B'], ['C']]);
  });

  it('interpreta números brasileiros com e sem separador de milhar', () => {
    expect(parseBrazilianNumber('143.178,19')).toBe(143178.19);
    expect(parseBrazilianNumber('143178,19')).toBe(143178.19);
    expect(parseBrazilianNumber('0,00')).toBe(0);
    expect(parseBrazilianNumber('17A')).toBeNull();
    expect(parseBrazilianNumber('10.00X20.00')).toBeNull();
  });

  it('formata nomes em maiúsculas', () => {
    expect(titleCase('RUA DAS FLORES')).toBe('Rua das Flores');
  });
});
