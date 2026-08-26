/**
 * Seed do Relatório de Locações (menu Locações > Relatórios).
 *
 * Reproduz a planilha que veio com a especificação de 23-08-26, para conferir
 * o relatório contra números conhecidos:
 *
 *  - Referência SET/2025  → tabela idêntica ao print do documento:
 *      Receita Bruta total  R$ 34.184,88
 *      IPTU total           R$    308,24
 *      Retenções (IRRF)     R$  2.037,61  (só AV. DR. RAFAEL PAES DE BARROS, 55)
 *      DARF PIS a pagar     R$     82,05
 *      DARF COFINS a pagar  R$    378,69  (o doc arredonda para 378,68)
 *
 *  - Referências JUL + AGO + SET/2025 (3º trimestre) → quadro trimestral:
 *      Faturamento          R$ 102.477,09
 *      DARF CSLL a pagar    R$   2.304,48
 *      DARF IRPJ a pagar    R$   1.813,96
 *
 *  - Referência OUT/2025 → cenários que o documento mostra zerados:
 *      desconto/despesa, multa de cancelamento, restituição de IPTU sem
 *      aluguel, e uma parcela PENDENTE (Receita Bruta > Valor Recebido).
 *
 * Lembrete de leitura: o aluguel do mês de referência é creditado no mês
 * SEGUINTE — a referência SET/2025 lê lançamentos efetivados em OUT/2025.
 *
 * Escreve SQL direto (via `pg`) e não pelo client Prisma porque o client
 * gerado deste projeto é TypeScript puro, sem build JS para rodar em script
 * avulso. Por isso `id` e `updated_at` são preenchidos à mão: são gerados pelo
 * Prisma, não pelo banco.
 *
 * Uso:  node --env-file=.env prisma/seed-lease-report.mjs
 *       node --env-file=.env prisma/seed-lease-report.mjs --clean   (só remove)
 *
 * É idempotente: cada execução remove o que semeou antes (marcador RELLOC) e
 * insere de novo. Não toca em nenhum dado que não tenha esse marcador.
 */

import pg from 'pg';
import { randomUUID as uuid } from 'node:crypto';

// ─── Alvo ────────────────────────────────────────────────────────────────────

/** Empresa "Teste Financeiro" — a única com imóveis/locações cadastrados. */
const COMPANY_ID = '7a1dbc14-69aa-4dc0-aa63-5ae58d8dac10';

/** Marcador que identifica tudo que este seed criou, para poder remover. */
const TAG = 'RELLOC';

/** Registros já existentes reaproveitados (não são criados nem apagados aqui). */
const REF = {
  owner: 'f134d5da-c246-43d9-8e9c-ba77328d1953', // Proprietário Mock
  propertyType: '36899628-ccc2-43da-819e-1ae373a2c18f', // Apartamento
  rentCategory: '80d30f1b-3a16-4500-bfe4-862a5917b4ab', // Aluguéis Recebidos (INCOME)
  commissionCategory: 'b153336f-423b-47fd-bd6b-9371d4758d75', // Taxas de Administração (INCOME)
  center: '15aad9b0-a286-479f-90f3-5717f93070c9', // Imobiliário
  institution: '38194638-a966-4f8d-a4ac-e472a5561aca', // Banco do Brasil
};

// ─── Cenário ─────────────────────────────────────────────────────────────────

const AGENCIES = [
  { key: 'residencia', trade: 'RESIDÊNCIA', legal: 'Residência Administração de Imóveis Ltda', cnpj: '11.222.333/0001-44' },
  { key: 'adiplan', trade: 'ADIPLAN', legal: 'Adiplan Administração e Planejamento Ltda', cnpj: '55.666.777/0001-88' },
];

/**
 * Os 11 imóveis do print. `rent` e `iptu` são os valores de SET/2025;
 * `julAdjust`/`agoAdjust` corrigem o aluguel nos outros dois meses do
 * trimestre para o faturamento trimestral fechar em R$ 102.477,09 (o
 * documento mostra que o trimestre NÃO é três vezes o mês).
 */
const PROPERTIES = [
  { key: 'p01', agency: 'residencia', title: 'AV. DR. RAFAEL PAES DE BARROS, 55', rent: 21562.06, iptu: 0, irrf: true,
    street: 'Av. Dr. Rafael Paes de Barros', number: '55' },
  { key: 'p02', agency: 'residencia', title: 'RUA BARÃO DO RIO BRANCO, 246', rent: 3618.02, iptu: 162.79,
    street: 'Rua Barão do Rio Branco', number: '246' },
  { key: 'p03', agency: 'residencia', title: 'RUA ALEMANHA, 284', rent: 940.00, iptu: 43.38,
    street: 'Rua Alemanha', number: '284' },
  { key: 'p04', agency: 'residencia', title: 'RUA MACEIÓ, 309', rent: 1987.25, iptu: 0,
    street: 'Rua Maceió', number: '309' },
  { key: 'p05', agency: 'residencia', title: 'RUA ALCIDES ANGELO GAMBA, 61', rent: 1577.55, iptu: 58.69,
    street: 'Rua Alcides Angelo Gamba', number: '61' },
  { key: 'p06', agency: 'residencia', title: 'RUA MINAS GERAIS, 101', rent: 950.00, iptu: 0,
    street: 'Rua Minas Gerais', number: '101' },
  { key: 'p07', agency: 'residencia', title: 'RUA CORONEL JOAQUIM PIZA, 140 - SALA 12', rent: 900.00, iptu: 0,
    street: 'Rua Coronel Joaquim Piza', number: '140', complement: 'Sala 12' },
  { key: 'p08', agency: 'residencia', title: 'RUA ALEMANHA, 280', rent: 950.00, iptu: 43.38,
    street: 'Rua Alemanha', number: '280' },
  // Ajuste do trimestre concentrado neste imóvel (ver comentário acima).
  { key: 'p09', agency: 'adiplan', title: 'RUA AMÉRICA, 389', rent: 1700.00, iptu: 0, julRent: 1661.23, agoRent: 1661.22,
    street: 'Rua América', number: '389' },
  // Os dois imóveis que aparecem com "R$ -" no print: sem aluguel no trimestre.
  // Servem ao mês extra de OUT/2025, com desconto e multa.
  { key: 'p10', agency: 'residencia', title: 'RUA CEL. JOAQ. PIZA, 140 SALA 12', rent: 0, iptu: 0,
    street: 'Rua Cel. Joaquim Piza', number: '140', complement: 'Sala 12' },
];

const TENANTS = [
  { key: 't01', name: 'Construtora Paes de Barros S/A', cnpj: '28.417.766/0001-95' },
  { key: 't02', name: 'Maria Aparecida Ferreira', cpf: '312.457.890-11' },
  { key: 't03', name: 'João Batista de Oliveira', cpf: '458.221.336-72' },
  { key: 't04', name: 'Ana Cláudia Mendes', cpf: '227.884.019-53' },
  { key: 't05', name: 'Comercial Gamba Ltda', cnpj: '19.334.208/0001-60' },
  { key: 't06', name: 'Roberto Carlos Nogueira', cpf: '661.209.447-08' },
  { key: 't07', name: 'Escritório Piza Advogados', cnpj: '33.902.115/0001-27' },
  { key: 't08', name: 'Fernanda Lima Souza', cpf: '905.113.664-30' },
  { key: 't09', name: 'Adiplan Serviços Ltda', cnpj: '47.006.882/0001-14' },
  { key: 't10', name: 'Paulo Henrique Duarte', cpf: '154.776.302-89' },
  { key: 't11', name: 'Sandra Regina Alves', cpf: '780.443.921-06' },
];

/**
 * Locações. Uma por imóvel, exceto RUA ALEMANHA, 280, que tem duas (é assim
 * no print: o mesmo endereço aparece duas vezes, uma zerada e uma com valor) —
 * exercita duas locações do mesmo imóvel na mesma linha do relatório.
 */
const LEASES = [
  { key: 'l01', property: 'p01', tenant: 't01' },
  { key: 'l02', property: 'p02', tenant: 't02' },
  { key: 'l03', property: 'p03', tenant: 't03' },
  { key: 'l04', property: 'p04', tenant: 't04' },
  { key: 'l05', property: 'p05', tenant: 't05' },
  { key: 'l06', property: 'p06', tenant: 't06' },
  { key: 'l07', property: 'p07', tenant: 't07' },
  { key: 'l08', property: 'p08', tenant: 't08' },
  { key: 'l09', property: 'p09', tenant: 't09' },
  // Sem movimento no trimestre; carrega o desconto exercitado em OUT/2025.
  { key: 'l10', property: 'p08', tenant: 't10', discount: 120.50 },
  // Cancelada: gera a multa de encerramento de OUT/2025.
  { key: 'l11', property: 'p10', tenant: 't11', status: 'CANCELED' },
];

const COMMISSION_RATE = 0.05;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const money = (v) => Number(v.toFixed(2));

/** Data (meia-noite UTC) — colunas @db.Date não devem sofrer fuso. */
const date = (year, month, day) => new Date(Date.UTC(year, month - 1, day));

/** Mês em que o aluguel do mês de referência entra na conta (referência + 1). */
const creditMonth = ({ year, month }) => (month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 });

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const cleanOnly = process.argv.includes('--clean');

  try {
    await client.query('BEGIN');
    const removed = await clean(client);
    console.log(`Limpeza: ${removed} registros anteriores do seed removidos.`);

    if (!cleanOnly) {
      await seed(client);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

/** Remove tudo que carrega o marcador, na ordem das FKs. */
async function clean(client) {
  const leaseIds = `select id from "Lease" where company_id=$1 and contract_number like '${TAG}-%'`;
  const propertyIds = `select id from "Property" where company_id=$1 and registration_number like '${TAG}-%'`;

  const steps = [
    [`delete from "Transaction" where company_id=$1 and lease_id in (${leaseIds})`],
    [`delete from "Lease" where company_id=$1 and contract_number like '${TAG}-%'`],
    [`delete from "PropertyValue" where property_id in (${propertyIds})`],
    [`delete from "PropertyAddress" where property_id in (${propertyIds})`],
    [`delete from "Address" where id not in (select address_id from "PropertyAddress")
        and id in (select address_id from "PropertyAddress" where 1=0)`], // no-op seguro
    [`delete from "Property" where company_id=$1 and registration_number like '${TAG}-%'`],
    [`delete from "Tenant" where company_id=$1 and internal_code like '${TAG}-%'`],
    [`delete from "Agency" where company_id=$1 and license_number = '${TAG}'`],
  ];

  let total = 0;
  for (const [sql] of steps) {
    const result = await client.query(sql, [COMPANY_ID]);
    total += result.rowCount ?? 0;
  }
  return total;
}

async function seed(client) {
  const now = new Date();
  const ids = { agency: {}, property: {}, tenant: {}, lease: {} };

  // ── Imobiliárias ───────────────────────────────────────────────────────────
  for (const agency of AGENCIES) {
    const id = uuid();
    ids.agency[agency.key] = id;
    await client.query(
      `insert into "Agency" (id, company_id, trade_name, legal_name, cnpj, license_number, commission_category_id, commission_percentage, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)`,
      [id, COMPANY_ID, agency.trade, agency.legal, agency.cnpj, TAG, REF.commissionCategory, COMMISSION_RATE * 100, now],
    );
  }

  // ── Inquilinos ─────────────────────────────────────────────────────────────
  for (const [index, tenant] of TENANTS.entries()) {
    const id = uuid();
    ids.tenant[tenant.key] = id;
    await client.query(
      `insert into "Tenant" (id, company_id, name, internal_code, cpf, cnpj, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$7)`,
      [id, COMPANY_ID, tenant.name, `${TAG}-T${String(index + 1).padStart(2, '0')}`, tenant.cpf ?? null, tenant.cnpj ?? null, now],
    );
  }

  // ── Imóveis (+ endereço e valores, para as outras telas) ───────────────────
  for (const [index, property] of PROPERTIES.entries()) {
    const id = uuid();
    ids.property[property.key] = id;
    const code = `${TAG}-${String(index + 1).padStart(2, '0')}`;

    await client.query(
      `insert into "Property" (id, company_id, owner_id, agency_id, type_id, center_id, debit_center_id,
                               category_id, iptu_refund_category_id, title, registration_number,
                               bedrooms, bathrooms, half_bathrooms, garage_spaces,
                               area_total, area_built, frontage, furnished, income_tax_withholding,
                               tax_registration, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$6,$7,$7,$8,$9,2,1,0,1,120,90,8,false,$10,$11,$12,$12)`,
      [id, COMPANY_ID, REF.owner, ids.agency[property.agency], REF.propertyType, REF.center,
       REF.rentCategory, property.title, code, property.irrf === true, `INSC-${code}`, now],
    );

    const addressId = uuid();
    await client.query(
      `insert into "Address" (id, zip_code, street, number, complement, district, city, state, country, created_at, updated_at)
       values ($1,'13560-000',$2,$3,$4,'Centro','São Carlos','SP','Brasil',$5,$5)`,
      [addressId, property.street, property.number, property.complement ?? null, now],
    );
    await client.query(
      `insert into "PropertyAddress" (id, property_id, address_id, created_at, updated_at) values ($1,$2,$3,$4,$4)`,
      [uuid(), id, addressId, now],
    );
    await client.query(
      `insert into "PropertyValue" (id, property_id, rental_value, condo_fee, property_tax, status, created_at, updated_at)
       values ($1,$2,$3,0,$4,'OCCUPIED',$5,$5)`,
      [uuid(), id, property.rent || null, property.iptu * 12, now],
    );
  }

  // ── Locações ───────────────────────────────────────────────────────────────
  for (const [index, lease] of LEASES.entries()) {
    const id = uuid();
    ids.lease[lease.key] = id;
    const property = PROPERTIES.find((p) => p.key === lease.property);

    await client.query(
      `insert into "Lease" (id, company_id, property_id, type_id, owner_id, tenant_id, agency_id,
                            financial_institution_id, contract_number, start_date, end_date,
                            rent_amount, property_tax, discount_amount, commission_amount, agency_commission,
                            rent_due_day, tax_due_day, status, canceled_at, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,10,10,$17,$18,$19,$19)`,
      [id, COMPANY_ID, ids.property[lease.property], REF.propertyType, REF.owner, ids.tenant[lease.tenant],
       ids.agency[property.agency], REF.institution, `${TAG}-${String(index + 1).padStart(2, '0')}`,
       date(2025, 1, 15), date(2026, 12, 31),
       property.rent || 0, property.iptu * 12, lease.discount ?? null,
       money((property.rent || 0) * COMMISSION_RATE), COMMISSION_RATE * 100,
       lease.status ?? 'ACTIVE', lease.status === 'CANCELED' ? date(2025, 10, 20) : null, now],
    );
  }

  // ── Lançamentos ────────────────────────────────────────────────────────────
  let created = 0;

  /**
   * As descrições seguem exatamente o formato que `PrismaLeaseFinanceRepository`
   * gera ("Aluguel do imóvel ...", "Comissão ...", "Restituição IPTU ..."): é
   * pela primeira palavra que o relatório classifica a coluna.
   */
  const addTransaction = async ({ lease, reference, description, amount, status, category, cancellation = false }) => {
    if (!amount) return;
    const credit = creditMonth(reference);
    const effective = date(credit.year, credit.month, 10);
    await client.query(
      `insert into "Transaction" (id, company_id, event_date, effective_date, description, amount, status,
                                  category_id, financial_institution_id, center_id, lease_id,
                                  is_cancellation_charge, created_at, updated_at)
       values ($1,$2,$3,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)`,
      [uuid(), COMPANY_ID, effective, description, amount, status, category,
       REF.institution, REF.center, lease, cancellation, now],
    );
    created += 1;
  };

  // 3º trimestre de 2025 — o cenário do documento.
  const QUARTER = [
    { reference: { year: 2025, month: 7 }, rentOf: (p) => p.julRent ?? p.rent },
    { reference: { year: 2025, month: 8 }, rentOf: (p) => p.agoRent ?? p.rent },
    { reference: { year: 2025, month: 9 }, rentOf: (p) => p.rent },
  ];

  for (const { reference, rentOf } of QUARTER) {
    for (const lease of LEASES) {
      // l10 e l11 são as linhas "R$ -" do print: sem movimento no trimestre.
      if (lease.key === 'l10' || lease.key === 'l11') continue;
      const property = PROPERTIES.find((p) => p.key === lease.property);
      const rent = money(rentOf(property));

      await addTransaction({
        lease: ids.lease[lease.key], reference, amount: rent, status: 'COMPLETED',
        category: REF.rentCategory,
        description: `Aluguel do imóvel 1/12 – ${TENANTS.find((t) => t.key === lease.tenant).name} – Contrato ${TAG}`,
      });
      await addTransaction({
        lease: ids.lease[lease.key], reference, amount: money(rent * COMMISSION_RATE), status: 'COMPLETED',
        category: REF.commissionCategory,
        description: `Comissão 1/12 - Contrato ${TAG}`,
      });
      await addTransaction({
        lease: ids.lease[lease.key], reference, amount: property.iptu, status: 'COMPLETED',
        category: REF.rentCategory,
        description: `Restituição IPTU 1/1 - Contrato ${TAG}`,
      });
    }
  }

  // OUT/2025 — mês extra, com os casos que o documento mostra zerados.
  const october = { year: 2025, month: 10 };

  // Desconto/despesa informado na locação (l10, RUA ALEMANHA, 280).
  await addTransaction({
    lease: ids.lease.l10, reference: october, amount: 950.00, status: 'COMPLETED', category: REF.rentCategory,
    description: `Aluguel do imóvel 1/12 – ${TENANTS.find((t) => t.key === 't10').name} – Contrato ${TAG}`,
  });
  await addTransaction({
    lease: ids.lease.l10, reference: october, amount: 47.50, status: 'COMPLETED', category: REF.commissionCategory,
    description: `Comissão 1/12 - Contrato ${TAG}`,
  });

  // Multa de encerramento + restituição de IPTU, sem aluguel (l11, cancelada).
  await addTransaction({
    lease: ids.lease.l11, reference: october, amount: 1800.00, status: 'COMPLETED', category: REF.rentCategory,
    description: 'Encargo de cancelamento - multa rescisória', cancellation: true,
  });
  await addTransaction({
    lease: ids.lease.l11, reference: october, amount: 75.40, status: 'COMPLETED', category: REF.rentCategory,
    description: `Restituição IPTU 1/1 - Contrato ${TAG}`,
  });

  // Parcela PENDENTE: Receita Bruta > Valor Recebido (l06, RUA MINAS GERAIS, 101).
  await addTransaction({
    lease: ids.lease.l06, reference: october, amount: 950.00, status: 'PENDING', category: REF.rentCategory,
    description: `Aluguel do imóvel 1/12 – ${TENANTS.find((t) => t.key === 't06').name} – Contrato ${TAG}`,
  });

  console.log(`Criados: ${AGENCIES.length} imobiliárias, ${TENANTS.length} inquilinos, ` +
    `${PROPERTIES.length} imóveis, ${LEASES.length} locações, ${created} lançamentos.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
