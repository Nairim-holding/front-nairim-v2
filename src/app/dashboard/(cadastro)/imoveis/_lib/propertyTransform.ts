/* eslint-disable @typescript-eslint/no-explicit-any */
// Pure utilities — no JSX, safe to import from both Server and Client Components

// Lê a env dentro de uma função (não no top-level). No Turbopack, NEXT_PUBLIC_*
// no top-level de módulo compartilhado server/client pode ficar undefined no
// server build, causando "Failed to parse URL" nos fetches SSR.
function getApiUrl(): string {
  return process.env.NEXT_PUBLIC_URL_API ?? '';
}

// ─── Parsers ─────────────────────────────────────────────────────────────────

export function parseMetric(value: string | number): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  const cleaned = value
    .toString()
    .replace(/ m²| m/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

export function parseMoney(value: string | number): number {
  if (value === null || value === undefined || value === '') return 0;
  const digits = value.toString().replace(/\D/g, '');
  if (!digits) return 0;
  return parseFloat(digits) / 100;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

export function formatMoney(value: number | string): string {
  if (value === null || value === undefined || value === '') return '';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(n) || n === 0) return '';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatMetricValue(value: number | string): string {
  if (value === null || value === undefined || value === '') return '';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(n)) return '';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function extractFileName(filePath: string): string {
  if (!filePath) return 'Arquivo';
  const parts = filePath.split('/');
  return decodeURIComponent(parts[parts.length - 1].replace(/^\d+-/, ''));
}

// ─── Select option builders ───────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildOwnerOptions(owners: any[]) {
  return owners.map((o) => ({
    label: o.name || o.trade_name || o.legal_name || 'Sem nome',
    value: o.id as string,
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildTypeOptions(types: any[]) {
  return types.map((t) => ({
    label: t.description || t.name || 'Sem descrição',
    value: t.id as string,
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildAgencyOptions(agencies: any[]) {
  const options = agencies.map((a) => ({
    label: a.trade_name || a.legal_name || a.name || 'Sem nome',
    value: a.id as string,
  }));
  // Add "Nenhuma" option at the beginning to allow clearing the selection
  return [{ label: 'Nenhuma', value: '' }, ...options];
}

// ─── API fetchers (server-side) ───────────────────────────────────────────────

export interface PropertySelectOptions {
  ownerOptions: { label: string; value: string }[];
  typeOptions: { label: string; value: string }[];
  agencyOptions: { label: string; value: string }[];
}

function authHeaders(token?: string): HeadersInit | undefined {
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

export async function fetchPropertySelectOptions(token?: string): Promise<PropertySelectOptions> {
  const API_URL = getApiUrl();
  const headers = authHeaders(token);
  const [ownersRes, typesRes, agenciesRes] = await Promise.all([
    fetch(`${API_URL}/owners`, { cache: 'no-store', headers }),
    fetch(`${API_URL}/property-types`, { cache: 'no-store', headers }),
    fetch(`${API_URL}/agencies`, { cache: 'no-store', headers }),
  ]);

  const [owners, types, agencies] = await Promise.all([
    ownersRes.json(),
    typesRes.json(),
    agenciesRes.json(),
  ]);

  return {
    ownerOptions: buildOwnerOptions(owners.data || []),
    typeOptions: buildTypeOptions(types.data || []),
    agencyOptions: buildAgencyOptions(agencies.data || []),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchProperty(id: string, token?: string): Promise<any> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/properties/${id}`, { cache: 'no-store', headers: authHeaders(token) });
  if (!res.ok) throw new Error(`Erro ${res.status} ao buscar imóvel`);
  const json = await res.json();
  if (!json.success || !json.data) throw new Error(json.message || 'Erro ao carregar imóvel');
  return json.data;
}

// ─── Data transformer ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDocument(doc: any) {
  return {
    id: doc.id,
    file_name: doc.description || extractFileName(doc.file_path),
    file_url: doc.file_path,
    type: doc.type,
    mime_type: doc.file_type,
    is_featured: doc.is_featured ?? false,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformPropertyData(apiResponse: any): Record<string, any> {
  const data = apiResponse?.data ?? apiResponse;
  if (!data) return {};

  const address = data.addresses?.[0]?.address ?? {};
  const values = data.values?.[0] ?? {};

  return {
    title:            data.title ?? '',
    bedrooms:         data.bedrooms?.toString() ?? '',
    bathrooms:        data.bathrooms?.toString() ?? '',
    half_bathrooms:   data.half_bathrooms?.toString() ?? '',
    garage_spaces:    data.garage_spaces?.toString() ?? '',
    area_total:       formatMetricValue(data.area_total ?? ''),
    area_built:       formatMetricValue(data.area_built ?? ''),
    frontage:         formatMetricValue(data.frontage ?? ''),
    floor_number:     data.floor_number?.toString() ?? '',
    tax_registration: data.tax_registration ?? '',
    owner_id:         data.owner_id ?? '',
    type_id:          data.type_id ?? '',
    agency_id:        data.agency_id ?? '',
    furnished:        data.furnished?.toString() ?? 'false',
    registration_number: data.registration_number ?? '',
    notes:            data.notes ?? '',

    zip_code:   address.zip_code ?? '',
    street:     address.street ?? '',
    number:     address.number ?? '',
    complement: address.complement ?? '',
    block:      address.block ?? '',
    lot:        address.lot ?? '',
    district:   address.district ?? '',
    city:       address.city ?? '',
    state:      address.state ?? '',
    country:    address.country ?? 'Brasil',
    latitude:   address.latitude ?? '',
    longitude:  address.longitude ?? '',

    purchase_date:  values.purchase_date ? values.purchase_date.split('T')[0] : '',
    purchase_value: formatMoney(values.purchase_value ?? ''),
    rental_value:   formatMoney(values.rental_value ?? ''),
    condo_fee:      formatMoney(values.condo_fee ?? ''),
    property_tax:   formatMoney(values.property_tax ?? ''),
    status:         values.status ?? 'AVAILABLE',
    sale_date:      values.sale_date ? values.sale_date.split('T')[0] : '',
    values_notes:   values.notes ?? '',
    sale_value:     formatMoney(values.sale_value ?? ''),
    extra_charges:  formatMoney(values.extra_charges ?? ''),
    market_value:   formatMoney(values.market_value ?? ''),

    iptus: data.iptus ?? [],

    arquivosImagens:   data.documents?.filter((d: any) => d.type === 'IMAGE').map(mapDocument) ?? [],
    arquivosMatricula: data.documents?.filter((d: any) => d.type === 'REGISTRATION').map(mapDocument) ?? [],
    arquivosRegistro:  data.documents?.filter((d: any) => d.type === 'PROPERTY_RECORD').map(mapDocument) ?? [],
    arquivosEscritura: data.documents?.filter((d: any) => d.type === 'TITLE_DEED').map(mapDocument) ?? [],
    arquivosOutros:    data.documents?.filter((d: any) => !['IMAGE', 'REGISTRATION', 'PROPERTY_RECORD', 'TITLE_DEED'].includes(d.type)).map(mapDocument) ?? [],
  };
}

// ─── FormData builder ─────────────────────────────────────────────────────────

const DOCUMENT_TYPES = [
  { field: 'arquivosImagens',   type: 'IMAGE' },
  { field: 'arquivosMatricula', type: 'REGISTRATION' },
  { field: 'arquivosRegistro',  type: 'PROPERTY_RECORD' },
  { field: 'arquivosEscritura', type: 'TITLE_DEED' },
  { field: 'arquivosOutros',    type: 'OTHER' },
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isNewFile(item: any): item is File {
  return item instanceof File;
}

export function buildPropertyFormData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  originalDocuments: any[] = [],
): FormData {
  const fd = new FormData();

  fd.append('propertyData', JSON.stringify({
    title:            data.title,
    bedrooms:         parseInt(data.bedrooms) || 0,
    bathrooms:        parseInt(data.bathrooms) || 0,
    half_bathrooms:   parseInt(data.half_bathrooms) || 0,
    garage_spaces:    parseInt(data.garage_spaces) || 0,
    area_total:       parseMetric(data.area_total),
    area_built:       parseMetric(data.area_built),
    frontage:         parseMetric(data.frontage),
    furnished:        data.furnished === 'true',
    floor_number:     parseInt(data.floor_number) || 0,
    tax_registration: data.tax_registration,
    notes:            data.notes,
    owner_id:         data.owner_id,
    type_id:          data.type_id,
    agency_id:        data.agency_id || null,
    registration_number: data.registration_number || null,
  }));

  fd.append('addressData', JSON.stringify({
    zip_code:   data.zip_code,
    street:     data.street,
    number:     data.number,
    complement: data.complement || null,
    block:      data.block || null,
    lot:        data.lot || null,
    district:   data.district,
    city:       data.city,
    state:      data.state,
    country:    data.country || 'Brasil',
    latitude:   data.latitude || null,
    longitude:  data.longitude || null,
  }));

  fd.append('valuesData', JSON.stringify({
    purchase_date:  data.purchase_date || null,
    purchase_value: parseMoney(data.purchase_value) || null,
    rental_value:   parseMoney(data.rental_value),
    condo_fee:      parseMoney(data.condo_fee),
    property_tax:   parseMoney(data.property_tax),
    status:         data.status,
    notes:          data.values_notes,
    sale_date:      data.sale_date || null,
    sale_value:     parseMoney(data.sale_value) || 0,
    extra_charges:  parseMoney(data.extra_charges) || 0,
    market_value:   parseMoney(data.market_value) || null,
  }));

  fd.append('iptusData', JSON.stringify(data.iptus || []));
  fd.append('userId', userId);

  // Removed documents (edit mode only)
  if (originalDocuments.length > 0) {
    const removedIds: string[] = [];
    DOCUMENT_TYPES.forEach(({ field, type }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currentIds = (data[field] || []).filter((i: any) => i && 'id' in i && 'file_url' in i).map((d: any) => d.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      originalDocuments.filter((d: any) => d.type === type).forEach((d: any) => {
        if (!currentIds.includes(d.id)) removedIds.push(d.id);
      });
    });
    if (removedIds.length > 0) fd.append('removedDocuments', JSON.stringify(removedIds));
  }

  // Featured image identifier
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const featured = (data.arquivosImagens || []).find((f: any) => f.is_featured);
  if (featured) fd.append('featuredImageIdentifier', featured.id || featured.name);

  // New files only
  DOCUMENT_TYPES.forEach(({ field }) => {
    (data[field] || []).filter(isNewFile).forEach((file: File) => {
      // Ensure filename is properly UTF-8 encoded
      const encoder = new TextEncoder();
      const filenameBytes = encoder.encode(file.name);
      const decodedFilename = new TextDecoder('utf-8').decode(filenameBytes);
      
      // Convert File to Blob and append with properly encoded filename
      const blob = new Blob([file], { type: file.type });
      fd.append(field, blob, decodedFilename);
    });
  });

  return fd;
}
