import type { PropertiesRepository } from '@/core/repositories/properties-repository';
import type { Storage } from '@/core/storage/storage';
import type { CreateUnifiedPropertyData, Property, PropertyUploadFiles } from '@/core/entities/property';
import { NotFoundError, ValidationError } from '@/core/errors/domain-errors';

/** Mapa campo-do-form → tipo de documento (idêntico ao backend). */
const FILE_TYPE_BY_FIELD: Record<keyof PropertyUploadFiles, string> = {
  arquivosImagens: 'IMAGE',
  arquivosMatricula: 'REGISTRATION',
  arquivosRegistro: 'PROPERTY_RECORD',
  arquivosEscritura: 'TITLE_DEED',
  arquivosOutros: 'OTHER',
};

export interface CreateUnifiedPropertyInput {
  data: CreateUnifiedPropertyData;
  files: PropertyUploadFiles;
  userId: string;
  /** Nome ou id do arquivo (dentre os enviados) que deve virar a imagem destacada. */
  featuredImageIdentifier?: string;
}

/**
 * Caso de uso: criação unificada de imóvel (dados + upload de documentos numa
 * única operação). Substitui `PropertyController.createUnifiedProperty` +
 * `PropertyService.createPropertyTransaction` + `processUploadedTempFiles`.
 *
 * ⚠️ MUDANÇA DE COMPORTAMENTO (decisão aprovada — Módulo 7): o backend
 * respondia ANTES do upload terminar (busboy streaming + `res.json` antecipado)
 * e processava os arquivos (incluindo conversão AVIF) em background depois da
 * resposta HTTP. Server Actions não suportam esse padrão — aqui a action só
 * retorna quando TUDO (imóvel + endereço + valores + IPTUs + upload + AVIF)
 * está concluído. Mais lento para uploads grandes, porém correto no modelo SSR.
 *
 * Camada: core. Roda dentro do contexto de tenant (withTenant).
 * Origem: api-nairim-v2/src/services/PropertyService.ts →
 * `createPropertyTransaction` + `processUploadedTempFiles`.
 */
export class CreateUnifiedPropertyUseCase {
  constructor(
    private readonly properties: PropertiesRepository,
    private readonly storage: Storage,
  ) {}

  async execute(input: CreateUnifiedPropertyInput): Promise<Property> {
    const { data, files, userId, featuredImageIdentifier } = input;

    if (!(await this.properties.ownerExists(data.owner_id))) {
      throw new NotFoundError('Proprietário não encontrado');
    }
    if (!(await this.properties.propertyTypeExists(data.type_id))) {
      throw new NotFoundError('Tipo de propriedade não encontrado');
    }
    if (data.agency_id && !(await this.properties.agencyExists(data.agency_id))) {
      throw new NotFoundError('Agência não encontrada');
    }
    if (!userId) throw new ValidationError('Campos obrigatórios ausentes');

    // 1. Cria o imóvel + endereço + values + iptus numa transação.
    const property = await this.properties.create(data);

    // 2. Sobe os arquivos (com conversão AVIF síncrona para imagens) e cria os Documents.
    const uploaded: Array<{ url: string; mimetype: string; type: string; description: string; createdBy: string | null; matchKeys: string[] }> = [];

    for (const [field, docType] of Object.entries(FILE_TYPE_BY_FIELD) as [keyof PropertyUploadFiles, string][]) {
      for (const file of files[field] ?? []) {
        const { url, contentType } = await this.storage.uploadMedia(
          { buffer: file.buffer, filename: file.filename, contentType: file.contentType, size: file.buffer.length },
          `properties/${property.id}`,
        );
        const nameWithoutExt = file.filename.replace(/\.[^/.]+$/, '');
        uploaded.push({
          url,
          mimetype: contentType,
          type: docType,
          description: nameWithoutExt.substring(0, 250),
          createdBy: userId.trim() || null,
          matchKeys: [file.filename, nameWithoutExt],
        });
      }
    }

    if (uploaded.length > 0) {
      const featuredMatch = featuredImageIdentifier
        ? uploaded.find((u) => u.matchKeys.includes(featuredImageIdentifier))
        : undefined;

      await this.properties.createDocuments(
        property.id,
        uploaded.map(({ matchKeys: _matchKeys, ...doc }) => doc),
        featuredMatch ? featuredMatch.matchKeys[0] : undefined,
      );
    }

    return (await this.properties.findById(property.id))!;
  }
}
