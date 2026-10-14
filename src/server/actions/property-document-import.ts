'use server';

import prisma from '@/infra/database/prisma';
import { withPermission } from '@/infra/auth/session';
import { extractPdfLayout } from '@/infra/pdf/extract-text';
import { type ActionResult, runAction } from '@/shared/actions/action-result';
import { ValidationError } from '@/core/errors/domain-errors';
import {
  buildMunicipalPrefill,
  mergeMunicipalDocuments,
  parseMunicipalPropertyDocument,
  sameMunicipalProperty,
  type MunicipalDocumentKind,
  type MunicipalPrefillField,
  type MunicipalPropertyData,
} from '@/core/entities/municipal-property-document';

/**
 * Leitura do carnê de IPTU / Ficha Cadastral para preencher o cadastro do
 * imóvel. Só lê e devolve a prévia — nada é gravado aqui; os dados entram no
 * formulário e seguem o fluxo normal de criação do imóvel.
 *
 * Guarda: `withPermission('properties', 'create')`. Camada: server.
 */

const MAX_FILES = 2;
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED = 'Hoje são aceitos o carnê de IPTU e a Ficha Cadastral da Prefeitura de Garça/SP, em PDF com texto (não escaneado).';

export interface PropertyDocumentPreview {
  documents: Array<{ fileName: string; kind: MunicipalDocumentKind; year: number | null }>;
  fields: MunicipalPrefillField[];
  warnings: string[];
}

const onlyDigits = (value: string | null | undefined) => (value ?? '').replace(/\D/g, '');

const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

async function readPdf(file: File): Promise<MunicipalPropertyData> {
  if (!file.name.toLowerCase().endsWith('.pdf')) throw new ValidationError(`"${file.name}" não é um PDF.`);
  if (!file.size || file.size > MAX_BYTES) throw new ValidationError(`"${file.name}" deve ter até 10 MB.`);

  const buffer = new Uint8Array(await file.arrayBuffer());
  // Assinatura do formato: o nome e o tipo informados pelo navegador não bastam.
  if (new TextDecoder('latin1').decode(buffer.subarray(0, 5)) !== '%PDF-') throw new ValidationError(`"${file.name}" não é um PDF válido.`);

  let data: MunicipalPropertyData | null;
  try {
    data = parseMunicipalPropertyDocument(await extractPdfLayout(buffer));
  } catch {
    throw new ValidationError(`Não foi possível ler "${file.name}". Verifique se o arquivo não está corrompido ou protegido por senha.`);
  }
  if (!data) throw new ValidationError(`Documento não reconhecido: "${file.name}". ${ACCEPTED}`);
  return data;
}

export async function previewPropertyDocumentImportAction(formData: FormData): Promise<ActionResult<PropertyDocumentPreview>> {
  return runAction(() => withPermission('properties', 'create', async () => {
    const files = formData.getAll('files').filter((entry): entry is File => entry instanceof File);
    if (files.length === 0) throw new ValidationError('Selecione o PDF do IPTU ou da Ficha Cadastral.');
    if (files.length > MAX_FILES) throw new ValidationError(`Envie no máximo ${MAX_FILES} arquivos: o carnê de IPTU e a Ficha Cadastral do mesmo imóvel.`);

    const parsed: MunicipalPropertyData[] = [];
    for (const file of files) parsed.push(await readPdf(file));

    if (!sameMunicipalProperty(parsed)) {
      throw new ValidationError('Os arquivos são de imóveis diferentes (o número de cadastro não confere). Envie os documentos de um imóvel por vez.');
    }
    const merged = mergeMunicipalDocuments(parsed);
    if (!merged) throw new ValidationError(ACCEPTED);

    // Proprietário pelo CPF/CNPJ — o cadastro guarda o número com ou sem máscara.
    let owner: { id: string; name: string } | null = null;
    if (merged.ownerDocument) {
      const owners = await prisma.owner.findMany({
        where: { deleted_at: null, OR: [{ cpf: { not: null } }, { cnpj: { not: null } }] },
        select: { id: true, name: true, cpf: true, cnpj: true },
      });
      const matches = owners.filter((candidate) => [candidate.cpf, candidate.cnpj].some((document) => onlyDigits(document) === merged.ownerDocument));
      if (matches.length === 1) owner = { id: matches[0].id, name: matches[0].name };
    }

    let propertyType: { id: string; description: string } | null = null;
    if (merged.architecturalType) {
      const wanted = normalize(merged.architecturalType);
      const types = await prisma.propertyType.findMany({ where: { deleted_at: null }, select: { id: true, description: true } });
      const matches = types.filter((type) => normalize(type.description) === wanted);
      if (matches.length === 1) propertyType = matches[0];
    }

    const { fields, warnings } = buildMunicipalPrefill(merged, { owner, propertyType });
    if (parsed.length === 1 && parsed[0].kind === 'IPTU') {
      warnings.push('Só o carnê de IPTU foi enviado. A Ficha Cadastral traz o CPF/CNPJ completo do proprietário, o tipo e a destinação do imóvel.');
    }
    if (parsed.length === 1 && parsed[0].kind === 'FICHA_CADASTRAL') {
      warnings.push('Só a Ficha Cadastral foi enviada. O carnê de IPTU traz o valor do imposto e as parcelas.');
    }

    return {
      documents: parsed.map((document, index) => ({ fileName: files[index].name, kind: document.kind, year: document.year })),
      fields,
      warnings,
    };
  }));
}
