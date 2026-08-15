import type { PropertiesRepository } from '@/core/repositories/properties-repository';
import type { Storage } from '@/core/storage/storage';
import type { Property, PropertyUploadFiles, UpdateUnifiedPropertyData } from '@/core/entities/property';
import { NotFoundError, ValidationError } from '@/core/errors/domain-errors';

const FILE_TYPE_BY_FIELD: Record<keyof PropertyUploadFiles, string> = {
  arquivosImagens: 'IMAGE',
  arquivosMatricula: 'REGISTRATION',
  arquivosRegistro: 'PROPERTY_RECORD',
  arquivosEscritura: 'TITLE_DEED',
  arquivosOutros: 'OTHER',
};

export interface UpdateUnifiedPropertyInput {
  data: UpdateUnifiedPropertyData;
  files: PropertyUploadFiles;
  userId: string;
  removedDocuments?: string[];
  featuredImageIdentifier?: string;
}

/**
 * Caso de uso: atualização unificada de imóvel (dados + upload de novos
 * documentos + remoção de documentos existentes numa única operação).
 * Substitui `PropertyController.updateUnifiedProperty` +
 * `PropertyService.updatePropertyTransaction` + `processUploadedTempFiles`.
 *
 * Mesma decisão de síncrono do create — ver nota em create-unified.ts.
 *
 * Camada: core. Roda dentro do contexto de tenant (withTenant).
 * Origem: api-nairim-v2/src/services/PropertyService.ts →
 * `updatePropertyTransaction` + `processUploadedTempFiles`.
 */
export class UpdateUnifiedPropertyUseCase {
  constructor(
    private readonly properties: PropertiesRepository,
    private readonly storage: Storage,
  ) {}

  async execute(id: string, input: UpdateUnifiedPropertyInput): Promise<Property> {
    const { data, files, userId, removedDocuments = [], featuredImageIdentifier } = input;
    if (!id) throw new ValidationError('ID da propriedade é obrigatório');

    const existing = await this.properties.findById(id);
    if (!existing) throw new NotFoundError('Propriedade não encontrada');

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

    // 1. Atualiza imóvel + endereço (upsert) + values (upsert) + iptus (upsert/remove) + remove documentos marcados.
    await this.properties.update(id, data, removedDocuments);

    // 2. Sobe os novos arquivos (com conversão AVIF síncrona) e cria os Documents.
    const uploaded: Array<{ url: string; mimetype: string; type: string; description: string; createdBy: string | null; matchKeys: string[] }> = [];

    for (const [field, docType] of Object.entries(FILE_TYPE_BY_FIELD) as [keyof PropertyUploadFiles, string][]) {
      for (const file of files[field] ?? []) {
        const { url, contentType } = await this.storage.uploadMedia(
          { buffer: file.buffer, filename: file.filename, contentType: file.contentType, size: file.buffer.length },
          `properties/${id}`,
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
        id,
        uploaded.map(({ matchKeys: _matchKeys, ...doc }) => doc),
        featuredMatch ? featuredMatch.matchKeys[0] : undefined,
      );
    }

    return (await this.properties.findById(id))!;
  }
}
