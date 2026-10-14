/**
 * Leitura de documentos da prefeitura (carnê de IPTU e Ficha Cadastral) para
 * preencher o cadastro do imóvel (doc de correções de 13/10/2026).
 *
 * O texto do PDF chega fora de ordem (rótulos e valores em blocos separados),
 * então a leitura parte da posição de cada trecho na página: primeiro monta as
 * linhas (`layoutFromTextItems`) e depois localiza os campos pelos rótulos.
 *
 * Cada prefeitura tem o próprio layout. Hoje só o de Garça/SP é reconhecido —
 * outra prefeitura entra como um novo par detectar/ler em `PARSERS`.
 *
 * Camada: core (regra pura, sem I/O).
 */

// ─── Layout da página ────────────────────────────────────────────────────────

/** Trecho de texto como o PDF entrega: `transform` = [a, b, c, d, e, f]. */
export interface PdfTextItem {
  text: string;
  transform: number[];
}

export interface PdfToken {
  x: number;
  text: string;
}

/** Linha da página: `y` cresce de cima para baixo; tokens da esquerda para a direita. */
export interface PdfRow {
  y: number;
  tokens: PdfToken[];
}

export type PdfPageLayout = PdfRow[];

/** Trechos a até esta distância vertical pertencem à mesma linha. */
const ROW_TOLERANCE = 2;

/**
 * Reconstrói as linhas da página. Páginas giradas (a Ficha Cadastral de Garça
 * é paisagem gravada a 90°) trocam os eixos: o texto corre no eixo vertical
 * do PDF, então a "linha" passa a ser a coordenada horizontal.
 */
export function layoutFromTextItems(items: PdfTextItem[]): PdfPageLayout {
  const points = items
    .filter((item) => item.text.trim() !== '')
    .map((item) => {
      const [a, b, , , e, f] = item.transform;
      const rotated = Math.abs(b) > Math.abs(a);
      if (!rotated) return { y: -f, x: e, text: item.text.trim() };
      return b > 0 ? { y: e, x: f, text: item.text.trim() } : { y: -e, x: -f, text: item.text.trim() };
    })
    .sort((p, q) => p.y - q.y || p.x - q.x);

  const rows: PdfRow[] = [];
  for (const point of points) {
    const row = rows.find((candidate) => Math.abs(candidate.y - point.y) <= ROW_TOLERANCE);
    if (row) row.tokens.push({ x: point.x, text: point.text });
    else rows.push({ y: point.y, tokens: [{ x: point.x, text: point.text }] });
  }
  for (const row of rows) row.tokens.sort((p, q) => p.x - q.x);
  return rows.sort((p, q) => p.y - q.y);
}

// ─── Resultado ───────────────────────────────────────────────────────────────

export type MunicipalDocumentKind = 'IPTU' | 'FICHA_CADASTRAL';

export interface MunicipalIptuInstallment {
  number: number;
  /** ISO yyyy-mm-dd. */
  dueDate: string;
  amount: number;
}

export interface MunicipalIptu {
  year: number;
  /** Imposto do exercício, sem desconto. */
  total: number | null;
  /** Cota única com desconto. */
  cash: { dueDate: string; amount: number } | null;
  /** Quitação com desconto menor, junto da 1ª parcela. */
  discounted: { dueDate: string; amount: number } | null;
  installments: MunicipalIptuInstallment[];
}

export interface MunicipalPropertyData {
  kind: MunicipalDocumentKind;
  municipality: string;
  state: string;
  year: number | null;
  /** "Cadastro" da prefeitura. */
  registrationNumber: string | null;
  /** "Inscrição" municipal. */
  taxRegistration: string | null;
  ownerName: string | null;
  /** CPF/CNPJ do proprietário, só dígitos — `null` quando o documento traz o número incompleto. */
  ownerDocument: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  zipCode: string | null;
  sector: string | null;
  block: string | null;
  lot: string | null;
  unit: string | null;
  landArea: number | null;
  builtArea: number | null;
  frontage: number | null;
  linearMeasure: string | null;
  marketValue: number | null;
  zoning: string | null;
  buildingType: string | null;
  /** Destinação do imóvel (Residencial, Comercial…). */
  usage: string | null;
  /** Tipo arquitetônico (Casa, Apartamento…). */
  architecturalType: string | null;
  iptu: MunicipalIptu | null;
}

function emptyData(kind: MunicipalDocumentKind, municipality: string, state: string): MunicipalPropertyData {
  return {
    kind, municipality, state, year: null,
    registrationNumber: null, taxRegistration: null, ownerName: null, ownerDocument: null,
    street: null, number: null, complement: null, district: null, zipCode: null,
    sector: null, block: null, lot: null, unit: null,
    landArea: null, builtArea: null, frontage: null, linearMeasure: null, marketValue: null,
    zoning: null, buildingType: null, usage: null, architecturalType: null, iptu: null,
  };
}

// ─── Utilitários de leitura ──────────────────────────────────────────────────

const MONEY = /^-?\d{1,3}(?:\.\d{3})*,\d{2}$|^-?\d+,\d{2}$/;

/** "143.178,19" e "143178,19" → 143178.19. */
export function parseBrazilianNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const cleaned = value.trim();
  if (!MONEY.test(cleaned)) return null;
  const parsed = Number(cleaned.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

/** "10/03/2026" → "2026-03-10". */
function parseBrazilianDate(value: string): string | null {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

const onlyDigits = (value: string | null | undefined) => (value ?? '').replace(/\D/g, '');

/** Só aceita CPF (11) ou CNPJ (14) completos — o carnê de Garça corta os últimos dígitos. */
function fullDocument(value: string | null | undefined): string | null {
  const digits = onlyDigits(value);
  return digits.length === 11 || digits.length === 14 ? digits : null;
}

const LOWERCASE_WORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

/** "JOAQUIM RAMOS MENDES" → "Joaquim Ramos Mendes". */
export function titleCase(value: string): string {
  return value.trim().toLowerCase().split(/\s+/).map((word, index) => (
    index > 0 && LOWERCASE_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)
  )).join(' ');
}

const allTokens = (pages: PdfPageLayout[]): string[] => pages.flatMap((page) => page.flatMap((row) => row.tokens.map((token) => token.text)));

const isLabel = (text: string) => text.endsWith(':');

/**
 * Valores que seguem um rótulo "Nome:" na MESMA linha, um por ocorrência do
 * rótulo (de cima para baixo). Rótulo seguido de outro rótulo = campo vazio.
 */
function valuesAfterLabel(rows: PdfRow[], label: string): Array<string | null> {
  const values: Array<string | null> = [];
  for (const row of rows) {
    row.tokens.forEach((token, index) => {
      if (token.text !== label) return;
      const next = row.tokens[index + 1];
      values.push(next && !isLabel(next.text) ? next.text : null);
    });
  }
  return values;
}

/** Quanto o valor pode começar à esquerda do rótulo (números alinhados à direita). */
const COLUMN_LEFT_SLACK = 12;
/** Quanto o valor pode começar à direita do rótulo (valores centralizados na célula). */
const COLUMN_RIGHT_REACH = 60;
/** Distância máxima entre a linha do rótulo e a do valor. */
const COLUMN_MAX_DROP = 16;

/**
 * Valor de um campo em layout de tabela: rótulo numa linha, valor logo abaixo,
 * na mesma coluna. Um valor pertence ao rótulo mais à direita que ainda começa
 * antes dele — assim "17A" sob "Quadra" não é lido como o "Setor" vazio ao lado.
 */
function valueBelowLabel(rows: PdfRow[], label: string, occurrence = 0): string | null {
  let seen = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const labelRow = rows[index];
    const labelToken = labelRow.tokens.find((token) => token.text === label);
    if (!labelToken) continue;
    if (seen++ !== occurrence) continue;

    for (let below = index + 1; below < rows.length && rows[below].y - labelRow.y <= COLUMN_MAX_DROP; below += 1) {
      for (const token of rows[below].tokens) {
        const offset = token.x - labelToken.x;
        if (offset < -COLUMN_LEFT_SLACK || offset > COLUMN_RIGHT_REACH) continue;
        const owner = labelRow.tokens.filter((candidate) => candidate.x <= token.x + COLUMN_LEFT_SLACK).at(-1);
        if (owner === labelToken) return token.text;
      }
    }
    return null;
  }
  return null;
}

// ─── Prefeitura de Garça/SP ──────────────────────────────────────────────────

const GARCA = { municipality: 'Garça', state: 'SP' };

const isGarca = (tokens: string[]) => tokens.some((text) => text.includes('Prefeitura Municipal de Garça'));

/** "Rua - MACEIO, 309" → { street: "Rua Maceio", number: "309" }. */
function splitFichaStreet(value: string | null): { street: string | null; number: string | null } {
  if (!value) return { street: null, number: null };
  const match = value.match(/^(.+?)\s*-\s*(.+?),\s*(\S+)$/);
  if (!match) return { street: titleCase(value), number: null };
  return { street: titleCase(`${match[1]} ${match[2]}`), number: match[3] };
}

/** Ficha Cadastral de Garça: campos "Rótulo: valor" na mesma linha. */
function parseGarcaFicha(pages: PdfPageLayout[]): MunicipalPropertyData {
  const rows = pages.flat();
  const data = emptyData('FICHA_CADASTRAL', GARCA.municipality, GARCA.state);
  // Proprietário e imóvel vêm antes do compromissário e do endereço de
  // correspondência — por isso sempre a primeira ocorrência do rótulo.
  const first = (label: string) => valuesAfterLabel(rows, label)[0] ?? null;

  const header = allTokens(pages).find((text) => /Ficha Cadastral Exerc[ií]cio:/.test(text));
  data.year = header ? Number(header.match(/(\d{4})/)?.[1]) || null : null;

  data.registrationNumber = first('Cadastro:');
  data.taxRegistration = first('Inscrição:');
  data.ownerName = first('Nome:');
  data.ownerDocument = fullDocument(first('CPF/CNPJ:'));

  const address = splitFichaStreet(first('Logradouro:'));
  data.street = address.street;
  data.number = address.number;
  data.district = first('Bairro:') ? titleCase(first('Bairro:') as string) : null;
  data.complement = first('Complemento:');
  data.zipCode = first('CEP:');

  data.sector = first('Setor:');
  data.block = first('Quadra:');
  data.lot = first('Lote:');
  data.unit = first('Unidade:');

  data.landArea = parseBrazilianNumber(first('Área do Terreno:'));
  data.builtArea = parseBrazilianNumber(first('Área Edificada:'));
  data.frontage = parseBrazilianNumber(first('Testada:'));
  data.linearMeasure = first('Medida Linear:');
  // O primeiro "Valor Venal:" é o total do cabeçalho; os outros dois são terreno e edificação.
  data.marketValue = parseBrazilianNumber(first('Valor Venal:'));
  data.zoning = first('Zoneamento:');
  data.buildingType = first('Tipo Edificação:');

  // Características: pares "código - nome" / "código - valor" na mesma linha.
  const characteristic = (name: string): string | null => {
    for (const row of rows) {
      const index = row.tokens.findIndex((token) => token.text.includes(name));
      const value = index >= 0 ? row.tokens[index + 1]?.text : undefined;
      if (value) return value.replace(/^\d+\s*-\s*/, '').trim() || null;
    }
    return null;
  };
  data.usage = characteristic('Destinação do Imóvel');
  data.architecturalType = characteristic('Tipo Arquitetônico');

  return data;
}

const INSTALLMENT_ROW = /\d-\d+-\d+-(\d+)\s+\d{6,}\s+\d{1,2}\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{1,3}(?:\.\d{3})*,\d{2})/;

/** Parcela 0 = cota única; 99 = quitação com desconto junto da 1ª parcela. */
const CASH_INSTALLMENT = 0;
const DISCOUNTED_INSTALLMENT = 99;

/** Carnê de IPTU de Garça: boletos por parcela + "Demonstrativo dos Cálculos". */
function parseGarcaIptu(pages: PdfPageLayout[]): MunicipalPropertyData {
  const data = emptyData('IPTU', GARCA.municipality, GARCA.state);
  const tokens = allTokens(pages);

  const yearText = tokens.find((text) => /^EXERCICIO \d{4}$/.test(text)) ?? tokens.find((text) => /^IPTU \d{4}$/.test(text));
  data.year = yearText ? Number(yearText.match(/(\d{4})/)?.[1]) : null;

  // Os dados cadastrais completos estão no demonstrativo; o cabeçalho do carnê
  // corta campos (o lote "43P44P" aparece como "43P4"). Sem demonstrativo, vale o cabeçalho.
  let section: PdfRow[] = pages[0] ?? [];
  let hasStatement = false;
  for (const page of pages) {
    const start = page.findIndex((row) => row.tokens.some((token) => token.text.includes('Demonstrativo dos Cálculos')));
    if (start >= 0) { section = page.slice(start); hasStatement = true; }
  }
  if (!hasStatement) {
    const firstSlip = section.findIndex((row) => row.tokens.some((token) => token.text === 'Código de Baixa'));
    if (firstSlip >= 0) section = section.slice(0, firstSlip);
  }

  data.registrationNumber = valueBelowLabel(section, 'Cadastro');
  data.taxRegistration = valueBelowLabel(section, 'Inscrição');
  data.ownerName = valueBelowLabel(section, 'Proprietário');
  data.ownerDocument = fullDocument(valueBelowLabel(section, 'CPF/CNPJ'));

  const street = valueBelowLabel(section, 'Logradouro');
  data.street = street ? titleCase(street) : null;
  data.number = valueBelowLabel(section, 'Número');
  data.complement = valueBelowLabel(section, 'Complemento');
  const district = valueBelowLabel(section, 'Bairro');
  data.district = district ? titleCase(district) : null;
  data.zipCode = valueBelowLabel(section, 'Cep');
  data.sector = valueBelowLabel(section, 'Setor');
  data.block = valueBelowLabel(section, 'Quadra');
  data.unit = valueBelowLabel(section, 'Unidade');
  // No cabeçalho o lote vem cortado; só é confiável quando lido do demonstrativo.
  data.lot = hasStatement ? valueBelowLabel(section, 'Lote') : null;

  let statementTotal: number | null = null;
  if (hasStatement) {
    data.zoning = valueBelowLabel(section, 'Zoneamento');
    data.buildingType = valueBelowLabel(section, 'Tipo de Edificação');

    // Coluna "Valores Venais / Áreas": cabeçalho do bloco, depois rótulo e número.
    const headerRow = section.find((row) => row.tokens.some((token) => token.text === 'Valores Venais'));
    const left = headerRow?.tokens.find((token) => token.text === 'Valores Venais')?.x;
    const right = headerRow?.tokens.find((token) => token.text === 'Alíquotas')?.x;
    if (left !== undefined && right !== undefined) {
      const column = section.flatMap((row) => row.tokens.filter((token) => token.x >= left - 5 && token.x < right - 1).map((token) => token.text));
      const blocks: Record<string, Record<string, number>> = {};
      let block = '';
      let label = '';
      for (const text of column) {
        if (text === 'Valores Venais' || text === 'Áreas') { block = text; blocks[block] = {}; label = ''; continue; }
        const value = parseBrazilianNumber(text);
        if (value === null) { label = text; continue; }
        if (block && label) blocks[block][label] = value;
        label = '';
      }
      data.marketValue = blocks['Valores Venais']?.Total ?? null;
      data.landArea = blocks['Áreas']?.Terreno ?? null;
      data.builtArea = blocks['Áreas']?.Edificada ?? null;
      data.frontage = blocks['Áreas']?.Testada ?? null;
    }

    const totalsRow = section.find((row) => row.tokens.some((token) => token.text === 'Totais'));
    statementTotal = totalsRow ? parseBrazilianNumber(totalsRow.tokens.at(-1)?.text) : null;
  }

  // Boletos: "código de baixa  cadastro  parcela  vencimento  valor" numa linha.
  const slips = new Map<number, { dueDate: string; amount: number }>();
  for (const row of pages.flat()) {
    const match = row.tokens.map((token) => token.text).join(' ').match(INSTALLMENT_ROW);
    if (!match) continue;
    const dueDate = parseBrazilianDate(match[2]);
    const amount = parseBrazilianNumber(match[3]);
    if (dueDate && amount !== null) slips.set(Number(match[1]), { dueDate, amount });
  }

  const installments = [...slips.entries()]
    .filter(([number]) => number !== CASH_INSTALLMENT && number !== DISCOUNTED_INSTALLMENT)
    .map(([number, slip]) => ({ number, ...slip }))
    .sort((a, b) => a.number - b.number);

  if (data.year && (slips.size > 0 || statementTotal !== null)) {
    const installmentsTotal = installments.reduce((sum, installment) => sum + installment.amount, 0);
    data.iptu = {
      year: data.year,
      total: statementTotal ?? (installments.length ? Math.round(installmentsTotal * 100) / 100 : null),
      cash: slips.get(CASH_INSTALLMENT) ?? null,
      discounted: slips.get(DISCOUNTED_INSTALLMENT) ?? null,
      installments,
    };
  }

  return data;
}

interface MunicipalParser {
  matches: (tokens: string[]) => boolean;
  parse: (pages: PdfPageLayout[]) => MunicipalPropertyData;
}

const PARSERS: MunicipalParser[] = [
  { matches: (tokens) => isGarca(tokens) && tokens.some((text) => text.includes('Ficha Cadastral')), parse: parseGarcaFicha },
  { matches: (tokens) => isGarca(tokens) && tokens.some((text) => /^IPTU \d{4}$/.test(text)), parse: parseGarcaIptu },
];

/** Lê um documento. `null` = layout não reconhecido. */
export function parseMunicipalPropertyDocument(pages: PdfPageLayout[]): MunicipalPropertyData | null {
  const tokens = allTokens(pages);
  const parser = PARSERS.find((candidate) => candidate.matches(tokens));
  return parser ? parser.parse(pages) : null;
}

// ─── Junção dos documentos e preenchimento do formulário ─────────────────────

/**
 * Junta carnê e ficha do mesmo imóvel. A Ficha Cadastral prevalece nos dados
 * cadastrais (traz o CNPJ completo e os campos sem corte); o IPTU vem do carnê.
 */
export function mergeMunicipalDocuments(documents: MunicipalPropertyData[]): MunicipalPropertyData | null {
  if (documents.length === 0) return null;
  const ordered = [...documents].sort((a, b) => Number(b.kind === 'FICHA_CADASTRAL') - Number(a.kind === 'FICHA_CADASTRAL'));
  const merged = { ...ordered[0] };
  for (const document of ordered.slice(1)) {
    for (const key of Object.keys(document) as Array<keyof MunicipalPropertyData>) {
      if (merged[key] === null || merged[key] === undefined) (merged as Record<string, unknown>)[key] = document[key];
    }
  }
  merged.iptu = documents.find((document) => document.iptu)?.iptu ?? null;
  return merged;
}

/** Documentos de imóveis diferentes não podem preencher o mesmo cadastro. */
export function sameMunicipalProperty(documents: MunicipalPropertyData[]): boolean {
  const ids = new Set(documents.map((document) => document.registrationNumber).filter(Boolean));
  return ids.size <= 1;
}

export interface MunicipalPrefillField {
  /** Nome do campo no formulário do imóvel. */
  field: string;
  label: string;
  /** Valor como o usuário vê na prévia. */
  display: string;
  /** Valor gravado no formulário. */
  value: unknown;
}

export interface MunicipalPrefillContext {
  /** Proprietário já cadastrado com o CPF/CNPJ do documento. */
  owner?: { id: string; name: string } | null;
  /** Tipo de imóvel cadastrado que casa com o tipo arquitetônico. */
  propertyType?: { id: string; description: string } | null;
}

export interface MunicipalPrefill {
  fields: MunicipalPrefillField[];
  /** Avisos para o usuário conferir antes de aplicar. */
  warnings: string[];
}

const metric = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const currency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const displayDate = (iso: string) => iso.split('-').reverse().join('/');

/** Tamanho máximo de `Property.tax_registration` no banco. */
const TAX_REGISTRATION_MAX = 20;

/**
 * Traduz os dados lidos para os campos do formulário de imóvel, nos mesmos
 * formatos que `transformPropertyData` usa (áreas "200,00", valores "R$ 1,00").
 */
export function buildMunicipalPrefill(data: MunicipalPropertyData, context: MunicipalPrefillContext = {}): MunicipalPrefill {
  const fields: MunicipalPrefillField[] = [];
  const warnings: string[] = [];
  const text = (field: string, label: string, value: string | null) => {
    if (value && value.trim()) fields.push({ field, label, display: value.trim(), value: value.trim() });
  };

  if (data.street && data.number) text('title', 'Nome Fantasia', `${data.street}, ${data.number}`);
  text('registration_number', 'Nº Cadastro', data.registrationNumber);
  if (data.taxRegistration && data.taxRegistration.length > TAX_REGISTRATION_MAX) {
    warnings.push(`A inscrição "${data.taxRegistration}" passa de ${TAX_REGISTRATION_MAX} caracteres e não foi preenchida.`);
  } else {
    text('tax_registration', 'Registro Fiscal (Inscrição)', data.taxRegistration);
  }

  if (context.owner) {
    fields.push({ field: 'owner_id', label: 'Proprietário', display: context.owner.name, value: context.owner.id });
  } else if (data.ownerName) {
    warnings.push(data.ownerDocument
      ? `O proprietário "${data.ownerName}" não está cadastrado com esse CPF/CNPJ. Cadastre-o ou selecione o proprietário manualmente.`
      : `O documento não traz o CPF/CNPJ completo de "${data.ownerName}". Selecione o proprietário manualmente.`);
  }

  if (context.propertyType) {
    fields.push({ field: 'type_id', label: 'Tipo do imóvel', display: context.propertyType.description, value: context.propertyType.id });
  }

  if (data.landArea !== null) fields.push({ field: 'area_total', label: 'Área Total (m²) — área do terreno', display: metric(data.landArea), value: metric(data.landArea) });
  if (data.builtArea !== null) fields.push({ field: 'area_built', label: 'Área Edificada (m²)', display: metric(data.builtArea), value: metric(data.builtArea) });
  if (data.frontage !== null) fields.push({ field: 'frontage', label: 'Testada (m)', display: metric(data.frontage), value: metric(data.frontage) });

  text('zip_code', 'CEP', data.zipCode);
  text('street', 'Rua', data.street);
  text('number', 'Número', data.number);
  text('complement', 'Complemento', data.complement);
  text('district', 'Bairro', data.district);
  text('city', 'Cidade', data.municipality);
  text('state', 'Estado', data.state);
  if (data.zipCode) fields.push({ field: 'country', label: 'País', display: 'Brasil', value: 'Brasil' });
  text('block', 'Quadra', data.block);
  text('lot', 'Lote', data.lot);

  if (data.marketValue) fields.push({ field: 'market_value', label: 'Valor Venal', display: currency(data.marketValue), value: currency(data.marketValue) });

  const iptu = data.iptu;
  if (iptu?.total) fields.push({ field: 'property_tax', label: 'Valor IPTU (Base de Referência)', display: currency(iptu.total), value: currency(iptu.total) });
  if (iptu && iptu.installments.length > 0) {
    const options = [
      iptu.cash ? `cota única de ${currency(iptu.cash.amount)} até ${displayDate(iptu.cash.dueDate)}` : null,
      iptu.discounted ? `quitação com desconto de ${currency(iptu.discounted.amount)} até ${displayDate(iptu.discounted.dueDate)}` : null,
    ].filter(Boolean);
    fields.push({
      field: 'iptus',
      label: `IPTU ${iptu.year}`,
      display: `${iptu.installments.length} parcelas, de ${displayDate(iptu.installments[0].dueDate)} a ${displayDate(iptu.installments.at(-1)!.dueDate)}`,
      value: [{
        year: iptu.year,
        payment_condition: 'INSTALLMENTS',
        property_tax: iptu.total ?? iptu.installments.reduce((sum, installment) => sum + installment.amount, 0),
        property_tax_cash: '',
        property_tax_cash_due_date: '',
        property_tax_first_installment: '',
        property_tax_first_installment_due_date: '',
        property_tax_second_installment: '',
        property_tax_second_installment_due_date: '',
        iptu_installments_count: iptu.installments.length,
        iptu_installments: iptu.installments.map((installment) => ({ due_date: installment.dueDate, value: installment.amount })),
      }],
    });
    if (options.length) warnings.push(`O IPTU foi lançado como parcelado. O carnê também oferece: ${options.join('; ')}. Ajuste a condição de pagamento na aba IPTU se for o caso.`);
  }

  // Campos do documento sem lugar próprio no cadastro vão para as Observações.
  const extras = [
    data.sector ? `Setor: ${data.sector}` : null,
    data.unit ? `Unidade: ${data.unit}` : null,
    data.zoning ? `Zoneamento: ${data.zoning}` : null,
    data.linearMeasure ? `Medida linear: ${data.linearMeasure}` : null,
    data.buildingType ? `Tipo de edificação: ${data.buildingType}` : null,
    data.usage ? `Destinação: ${data.usage}` : null,
    !context.propertyType && data.architecturalType ? `Tipo arquitetônico: ${data.architecturalType}` : null,
  ].filter(Boolean) as string[];
  if (extras.length) {
    const source = `Dados da Prefeitura de ${data.municipality}${data.year ? ` (exercício ${data.year})` : ''}`;
    const notes = `${source}: ${extras.join('; ')}.`;
    fields.push({ field: 'notes', label: 'Observações', display: notes, value: notes });
  }

  return { fields, warnings };
}
