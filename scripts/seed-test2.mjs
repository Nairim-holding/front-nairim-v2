import { Client } from 'pg';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const TEST_DATABASE = 'nairim_test2_db';
const TAG = '[DEMO TESTE2]';
const date = (year, month, day = 1) => new Date(Date.UTC(year, month - 1, day));
const iso = value => value.toISOString().slice(0, 10);
const money = value => Math.round((value + Number.EPSILON) * 100) / 100;
const quote = value => '"' + value.replaceAll('"', '""') + '"';

export function assertTest2Url(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('DATABASE_URL ausente ou inválida.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || decodeURIComponent(url.pathname) !== '/' + TEST_DATABASE) {
    throw new Error(`Seed permitido somente no banco ${TEST_DATABASE}. Produção, homologação e iholding são recusadas.`);
  }
}

/** UUID v5 estável por empresa, versão do seed e chave do registro. */
export function demoId(company, key) {
  const bytes = createHash('sha1').update(Buffer.from('f6ac41056b0d4f129f1c7dadca8a4d33', 'hex')).update(`test2-v1:${company}:${key}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 80; bytes[8] = (bytes[8] & 63) | 128;
  const h = bytes.toString('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

/** Somente INSERT, em uma transação. Não limpa, atualiza ou reativa dados existentes. */
export async function seedTest2(client, options = {}) {
  const today = options.today ?? new Date();
  const year = Number(options.year ?? today.getUTCFullYear());
  const explicitSlug = options.companySlug?.trim();
  let slug = explicitSlug || options.preferredSlug?.trim() || 'nairim';
  if (!Number.isInteger(year) || year < 2020 || year > 2100) throw new Error('SEED_YEAR deve ser um ano entre 2020 e 2100.');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('SEED_COMPANY_SLUG inválido.');
  const { rows: [target] } = await client.query('SELECT current_database() AS database');
  if (target.database !== TEST_DATABASE) throw new Error(`Conexão recusada: o banco conectado não é ${TEST_DATABASE}.`);
  const stats = {};
  let credentials = null;
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query("SET LOCAL statement_timeout = '60s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('seed-test2-v1'))");
    const { rows: companies } = await client.query('SELECT id,name,slug,is_active,deleted_at FROM "Company"');
    let company = companies.find(item => item.slug === slug);
    const activeCompanies = companies.filter(item => item.is_active && !item.deleted_at);
    if (!explicitSlug && !company && activeCompanies.length === 1) { company = activeCompanies[0]; slug = company.slug; }
    if (company && (!company.is_active || company.deleted_at)) throw new Error('A empresa selecionada está inativa ou excluída. Nenhuma reativação foi feita.');
    if (!company && companies.length) {
      const choices = companies.filter(item => item.is_active && !item.deleted_at).map(item => item.slug).join(', ');
      throw new Error(`Empresa ${slug} não encontrada. Execute com SEED_COMPANY_SLUG de uma empresa existente: ${choices || '(nenhuma ativa)'}.`);
    }
    const companyId = company?.id ?? demoId('company', slug);
    const id = key => demoId(companyId, key);
    const created = date(year - 1, 1);
    const put = async (table, key, data, timestamps = true) => {
      const row = { id: id(key), ...data, ...(timestamps ? {created_at:created, updated_at:today} : {}) };
      const columns = Object.keys(row);
      const result = await client.query(`INSERT INTO ${quote(table)} (${columns.map(quote).join(',')}) VALUES (${columns.map((_, index) => '$' + (index + 1)).join(',')}) ON CONFLICT DO NOTHING`, Object.values(row));
      stats[table] = (stats[table] ?? 0) + (result.rowCount ?? 0);
      return row.id;
    };
    if (!company) {
      await put('Company', 'company', {id:companyId, name:'Nairim — Demonstração Teste 2', slug});
      company = {id:companyId, slug, name:'Nairim — Demonstração Teste 2'};
    }
    await put('CompanyBranding', 'branding', {company_id:companyId, company_name:company.name, app_title:company.name});
    const { rows: users } = await client.query('SELECT id FROM "User" WHERE company_id=$1 AND deleted_at IS NULL AND is_active=true', [companyId]);
    if (!users.length) {
      const password = options.adminPassword || randomBytes(24).toString('base64url');
      if (password.length < 12 || Buffer.byteLength(password) > 72) throw new Error('SEED_ADMIN_PASSWORD deve ter entre 12 caracteres e 72 bytes.');
      const inserted = await put('User', 'admin', {company_id:companyId, name:'Administrador DEMO Teste 2', email:'demo-teste2@nairim.test', password:await bcrypt.hash(password,12), birth_date:'1990-01-01', gender:'OTHER', role:'ADMIN'});
      const {rows: [admin]} = await client.query('SELECT is_active,deleted_at FROM "User" WHERE id=$1', [inserted]);
      if (!stats.User || !admin?.is_active || admin.deleted_at) throw new Error('Usuário DEMO já existe sem acesso ativo; use um administrador existente. Senha não foi alterada.');
      credentials = {email:'demo-teste2@nairim.test', password};
    }

    const definitions = [
      ['rent','Receitas de Aluguel','Aluguéis','INCOME',null],
      ['iptuRefund','Restituição IPTU','Restituição IPTU','INCOME',null],
      ['condoRefund','Restituição Condomínio','Condomínio','INCOME',null],
      ['commission','Taxas de Administração','Comissões Imobiliárias','EXPENSE','FIXED_EXPENSE'],
      ['iptu','Impostos','IPTU','EXPENSE','TAXES'],
      ['condo','Despesas de Condomínio','Condomínio','EXPENSE','FIXED_EXPENSE'],
      ['maintenance','Despesas Variáveis','Manutenção de Imóveis','EXPENSE','VARIABLE_EXPENSE'],
      ['insurance','Seguros','Seguro de Imóveis','EXPENSE','FIXED_EXPENSE'],
      ['itbi','ITBI','ITBI','EXPENSE','TAXES'],
      ['registry','Cartório','Registro de Imóveis','EXPENSE','TAXES'],
      ['general','Despesas Administrativas','Serviços Administrativos','EXPENSE','FIXED_EXPENSE'],
      ['opening','Saldo Inicial','Saldo Inicial','INCOME',null],
    ];
    const categories = {};
    for (const [key,label,subLabel,type,group] of definitions) {
      const category = await put('Category',`category-${key}`,{company_id:companyId,name:`${label} ${TAG}`,type,dfc_group:group});
      const subcategory = await put('Subcategory',`subcategory-${key}`,{company_id:companyId,category_id:category,name:subLabel});
      categories[key] = {category_id:category,subcategory_id:subcategory};
    }
    const banks=[];
    for(let i=0;i<2;i++) banks.push(await put('FinancialInstitution',`bank-${i}`,{company_id:companyId,name:`Conta ${i+1} ${TAG}`,account_number:`DEMO-${i+1}`,bank_number:'000'}));
    const types=[];
    for(const name of ['Apartamento','Casa','Comercial']) types.push(await put('PropertyType',`type-${name}`,{company_id:companyId,description:`${name} ${TAG}`}));
    const owners=[];
    for(let i=0;i<3;i++) owners.push(await put('Owner',`owner-${i}`,{company_id:companyId,name:`Proprietário Fictício ${i+1} ${TAG}`,internal_code:`DEMO-T2-PROP-${i+1}`}));
    const agency=await put('Agency','agency',{company_id:companyId,trade_name:`Imobiliária Fictícia ${TAG}`,legal_name:`Imobiliária de Demonstração ${TAG}`,cnpj:'00.000.000/0000-00',commission_percentage:8,commission_category_id:categories.commission.category_id,commission_subcategory_id:categories.commission.subcategory_id});
    const suppliers=[];
    for(let i=0;i<2;i++) suppliers.push(await put('Supplier',`supplier-${i}`,{company_id:companyId,legal_name:`Prestador Fictício ${i+1} ${TAG}`,internal_code:`DEMO-T2-FORN-${i+1}`}));
    const shiftDays = days => new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),today.getUTCDate()+days));
    const properties=[];
    for(let i=0;i<6;i++) {
      const title=`Imóvel de Demonstração ${String(i+1).padStart(2,'0')} ${TAG}`;
      const center=await put('Center',`center-in-${i}`,{company_id:companyId,name:title+' (CR)',type:'INCOME'});
      const debit=await put('Center',`center-out-${i}`,{company_id:companyId,name:title+' (DB)',type:'EXPENSE'});
      const property=await put('Property',`property-${i}`,{company_id:companyId,owner_id:owners[i%3],agency_id:agency,type_id:types[i%3],center_id:center,debit_center_id:debit,...categories.rent,iptu_refund_category_id:categories.iptuRefund.category_id,iptu_refund_subcategory_id:categories.iptuRefund.subcategory_id,title,registration_number:`DEMO-T2-${i+1}`,bedrooms:i%3+1,bathrooms:2,half_bathrooms:0,garage_spaces:1,area_total:90+i*25,area_built:75+i*20,frontage:8,furnished:false,tax_registration:`DEMO-T2-${i+1}`,income_tax_withholding:i===1,notes:'Dados inteiramente fictícios para testes.'});
      const address=await put('Address',`address-${i}`,{zip_code:'13560-000',street:`Rua Fictícia de Demonstração ${i+1}`,number:String(100+i),district:'Centro (DEMO)',city:'São Carlos',state:'SP',country:'Brasil'});
      await put('PropertyAddress',`property-address-${i}`,{property_id:property,address_id:address});
      const rent=2500+i*450, tax=150+i*20, condo=350+i*30;
      await put('PropertyValue',`property-value-${i}`,{property_id:property,purchase_value:450000+i*100000,market_value:540000+i*120000,rental_value:rent,condo_fee:condo,property_tax:tax,status:i===5?'SOLD':i===4?'AVAILABLE':'OCCUPIED',purchase_date:iso(date(year-2,1)),vacancy_months_per_year:1,sale_value:i===5?1100000:null,sale_date:i===5?iso(date(year,2)):null});
      await put('PropertyIptu',`property-iptu-${year}-${i}`,{property_id:property,year,property_tax:tax*12,iptu_installments_count:12,payment_condition:'INSTALLMENTS'});
      properties.push({id:property,center,debit,rent,tax,condo});
    }
    const transaction = async (key,kind,amount,event,effective,extra={}) => put('Transaction',`tx-${year}-${key}`,{company_id:companyId,...categories[kind],financial_institution_id:banks[0],event_date:iso(event),effective_date:iso(effective),description:`${kind} ${TAG}`,amount:money(amount),status:effective<=today?'COMPLETED':'PENDING',...extra});
    for(let i=0;i<2;i++) await transaction(`opening-${i}`,'opening',i?15000:35000,date(year-1,12,31),date(year-1,12,31),{financial_institution_id:banks[i],description:`Saldo inicial ${TAG}`});
    for(let i=0;i<5;i++) {
      const p=properties[i];
      const tenant=await put('Tenant',`tenant-${i}`,{company_id:companyId,name:`Locatário Fictício ${i+1} ${TAG}`,internal_code:`DEMO-T2-LOC-${i+1}`});
      const end=i===2?shiftDays(20):i===3?shiftDays(-45):i===4?shiftDays(-60):date(Math.max(year,today.getUTCFullYear())+1,12,31);
      const contract=`DEMO-T2-${String(i+1).padStart(3,'0')}/${year}`;
      const lease=await put('Lease',`lease-${year}-${i}`,{company_id:companyId,property_id:p.id,type_id:types[i%3],owner_id:owners[i%3],tenant_id:tenant,agency_id:agency,financial_institution_id:banks[0],contract_number:contract,start_date:iso(date(Math.min(year,today.getUTCFullYear())-1,1)),end_date:iso(end),rent_amount:p.rent,condo_fee:p.condo,property_tax:p.tax,agency_commission:8,commission_amount:money(p.rent*.08),rent_due_day:10,tax_due_day:15,condo_due_day:10,status:i===4?'CANCELED':i===3?'EXPIRED':i===2?'EXPIRING':'ACTIVE',canceled_at:i===4?end:null,cancellation_justification:i===4?'Cancelamento fictício para demonstração':null});
      for(let month=1;month<=12;month++) {
        const effective=date(year,month,10);
        if(effective>end) continue;
        const event=date(year,month);
        const pending=i===1&&month===Math.max(1,today.getUTCMonth());
        const status=pending||effective>today?'PENDING':'COMPLETED';
        for(const [kind,amount,label,income] of [['rent',p.rent,'Aluguel',true],['commission',p.rent*.08,'Comissão',false],['iptuRefund',p.tax,'Restituição IPTU',true],['iptu',p.tax,'IPTU',false],['condoRefund',p.condo,'Condomínio',true],['condo',p.condo,'Pagamento condomínio',false]]) {
          await transaction(`lease-${i}-${month}-${kind}`,kind,amount,event,effective,{lease_id:lease,center_id:income?p.center:p.debit,status,description:`${label} - Contrato ${contract} ${TAG}`});
        }
      }
    }
    for(let i=0;i<properties.length;i++) {
      const p=properties[i];
      for(const [kind,amount] of [['itbi',12000+i*1000],['registry',3500+i*250],['insurance',600+i*50]]) await transaction(`property-${i}-${kind}`,kind,amount,date(year,1,5),date(year,1,5),{center_id:p.debit,description:`${kind} - Imóvel DEMO ${i+1} ${TAG}`});
      const repair=await put('Repair',`repair-${year}-${i}`,{company_id:companyId,property_id:p.id,event_date:iso(date(year,Math.min(12,i+1),15)),event_type:'REPAIR',problem_type:'ELECTRICAL',problem_types:['ELECTRICAL'],description:`Reparo elétrico fictício ${TAG}`,professional:`Prestador Fictício 1 ${TAG}`,supplier_id:suppliers[0],service_amount:600,materials_amount:250,payment_method:'PIX',payment_conditions:'À vista',status:i<4?'COMPLETED':'PLANNED'});
      await put('RepairProfessional',`repair-pro-${year}-${i}`,{company_id:companyId,repair_id:repair,supplier_id:suppliers[0]},false);
      for(const [position,kind,amount] of [[0,'LABOR',600],[1,'MATERIAL',250]]) await put('RepairItem',`repair-item-${year}-${i}-${position}`,{company_id:companyId,repair_id:repair,supplier_id:suppliers[0],description:`${kind} ${TAG}`,kind,professional:'Prestador Fictício 1',amount,position},false);
      await transaction(`maintenance-${i}`,'maintenance',850,date(year,Math.min(12,i+1),15),date(year,Math.min(12,i+1),15),{center_id:p.debit,supplier_id:suppliers[0],description:`Manutenção - Imóvel DEMO ${i+1} ${TAG}`});
    }
    for(let cardIndex=0;cardIndex<2;cardIndex++) {
      const card=await put('Card',`card-${cardIndex}`,{company_id:companyId,name:`Cartão ${cardIndex+1} ${TAG}`,limit:cardIndex?8000:15000,closing_day:1,due_day:10,brand:'Outro'});
      for(let month=1;month<=12;month++) {
        const due=date(year,month,10);
        const status=(cardIndex===1&&month===today.getUTCMonth()+1)||due>today?'PENDING':'COMPLETED';
        const amounts=[120+month*10,250+cardIndex*100,85.5];
        const invoice=await put('invoices',`invoice-${year}-${cardIndex}-${month}`,{company_id:companyId,card_id:card,year,month,total_amount:money(amounts.reduce((a,b)=>a+b,0)),status,closing_date:iso(date(year,month)),due_date:iso(due),paid_date:status==='COMPLETED'?iso(due):null,paid_amount:status==='COMPLETED'?money(amounts.reduce((a,b)=>a+b,0)):0,institution_id:banks[cardIndex]});
        for(const [index,amount] of amounts.entries()) await transaction(`card-${cardIndex}-${month}-${index}`,'general',amount,date(year,month,Math.min(index+2,28)),due,{card_id:card,invoice_id:invoice,financial_institution_id:banks[cardIndex],status,supplier_id:suppliers[index%2],description:`Compra fictícia ${index+1} no cartão ${cardIndex+1} ${TAG}`});
      }
    }
    for(const [kind,amount,type] of [['rent',18000,'FIXED'],['commission',1440,'VARIABLE'],['iptu',1200,'FIXED'],['maintenance',1500,'VARIABLE'],['general',2500,'FIXED']]) {
      const planning=await put('Planning',`planning-${kind}`,{company_id:companyId,...categories[kind],type,default_amount:amount});
      for(let month=1;month<=12;month++) await put('PlanningMonth',`planning-${kind}-${month}`,{planning_id:planning,month,amount},false);
    }
    const products=[['PGBL',1137238.76,1148951.94],['VGBL',707318.13,714603.27],['CDB',50000,50400]];
    for(const [index,[product,initial,january]] of products.entries()) {
      const investment=await put('Investment',`investment-${year}-${product}`,{company_id:companyId,financial_institution_id:banks[index%2],issuer:`Instituição Fictícia ${TAG}`,product:`${product} Demonstração ${year} ${TAG}`,product_type:product==='CDB'?'CDB':'PREVIDENCIA',application_date:iso(date(year-1,12,31)),invested_amount:initial,display_order:index,partition:'Demonstração',liquidity_days:1});
      for(let month=1;month<=12;month++) await put('InvestmentMonthBalance',`investment-balance-${year}-${product}-${month}`,{investment_id:investment,year,month,balance:money(january*Math.pow(1.007,month-1)+(month>=3?1000:0))},false);
      await put('InvestmentTransaction',`investment-contribution-${year}-${product}`,{investment_id:investment,type:'CONTRIBUTION',date:iso(date(year,3,10)),amount:1000});
    }
    await put('InvestmentSettings','investment-settings',{company_id:companyId,independence_reference_amount:20000});
    await put('IptuAuditSettings','iptu-settings',{company_id:companyId,income_category_id:categories.iptuRefund.category_id,income_subcategory_id:categories.iptuRefund.subcategory_id,expense_category_id:categories.iptu.category_id,expense_subcategory_id:categories.iptu.subcategory_id});
    const lines=Object.fromEntries(['itbi','registry','maintenance','rent','iptu','insurance','commission'].map(key=>[key,categories[key]]));
    await put('RoiSettings','roi-settings',{company_id:companyId,lines:JSON.stringify(lines)});
    await client.query('COMMIT');
    return {database:target.database,company:company.slug,year,created:stats,totalCreated:Object.values(stats).reduce((a,b)=>a+b,0),credentials};
  } catch(error) {
    await client.query('ROLLBACK').catch(()=>{});
    throw error;
  }
}

if (!process.argv[1] || import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let client;
  try {
    assertTest2Url(process.env.DATABASE_URL);
    client=new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000,query_timeout:70000,application_name:'nairim-seed-test2'});
    await client.connect();
    const result=await seedTest2(client,{companySlug:process.env.SEED_COMPANY_SLUG,preferredSlug:process.env.NEXT_PUBLIC_COMPANY_SLUG,year:process.env.SEED_YEAR,adminPassword:process.env.SEED_ADMIN_PASSWORD});
    const {credentials,...summary}=result;
    console.log(JSON.stringify(summary,null,2));
    if(credentials) console.log(`Usuário criado somente neste banco: ${credentials.email}\nSenha inicial (guarde agora, não será redefinida ao repetir): ${credentials.password}`);
    else console.log('Usuários e senhas existentes preservados. Entre com o acesso que já utiliza no teste 2.');
  } catch(error) {
    console.error(`Seed não concluído: ${error.message}`);
    process.exitCode=1;
  } finally { if(client) await client.end().catch(()=>{}); }
}
