import type { AdjustmentIndexesRepository } from '@/core/repositories/adjustment-indexes-repository';
import { ValidationError } from '@/core/errors/domain-errors';
import {
  AUTO_UPDATABLE_CODES,
  type AdjustmentIndex,
  type AdjustmentIndexCode,
  type CreateAdjustmentIndexData,
  type ListAdjustmentIndexesParams,
  type PaginatedAdjustmentIndexes,
  type SyncResult,
  type UpdateAdjustmentIndexData,
  type UpsertAdjustmentIndexValueData,
} from '@/core/entities/adjustment-index';

/**
 * Casos de uso dos Índices de Reajuste (Etapa 4).
 * Camada: core.
 */

/** Assinatura do cliente do BCB, injetada para o core não depender de infra. */
export type FetchSeries = (
  code: AdjustmentIndexCode,
  range?: { from: Date; to: Date },
) => Promise<Array<{ reference_year: number; reference_month: number; monthly_rate: number; accumulated_12m: number | null }>>;

export class ListAdjustmentIndexesUseCase {
  constructor(private readonly repository: AdjustmentIndexesRepository) {}

  execute(params: ListAdjustmentIndexesParams): Promise<PaginatedAdjustmentIndexes> {
    return this.repository.list(params);
  }
}

export class GetAdjustmentIndexByIdUseCase {
  constructor(private readonly repository: AdjustmentIndexesRepository) {}

  async execute(id: string): Promise<AdjustmentIndex | null> {
    return this.repository.findById(id);
  }
}

export class ListAdjustmentIndexOptionsUseCase {
  constructor(private readonly repository: AdjustmentIndexesRepository) {}

  /**
   * Opções do ComboBox da locação. Semeia os padrões na primeira chamada, para
   * o campo não aparecer vazio numa empresa que nunca abriu o cadastro.
   */
  async execute(): Promise<Array<{ label: string; value: string }>> {
    const options = await this.repository.listOptions();
    if (options.length > 0) return options;
    await this.repository.seedDefaults();
    return this.repository.listOptions();
  }
}

export class CreateAdjustmentIndexUseCase {
  constructor(private readonly repository: AdjustmentIndexesRepository) {}

  execute(data: CreateAdjustmentIndexData): Promise<AdjustmentIndex> {
    if (!data.code?.trim()) throw new ValidationError('A sigla do indexador é obrigatória.');
    if (!data.description?.trim()) throw new ValidationError('A descrição é obrigatória.');
    return this.repository.create(data);
  }
}

export class UpdateAdjustmentIndexUseCase {
  constructor(private readonly repository: AdjustmentIndexesRepository) {}

  execute(id: string, data: UpdateAdjustmentIndexData): Promise<AdjustmentIndex> {
    if (data.code !== undefined && !data.code.trim()) {
      throw new ValidationError('A sigla do indexador é obrigatória.');
    }
    if (data.description !== undefined && !data.description.trim()) {
      throw new ValidationError('A descrição é obrigatória.');
    }
    return this.repository.update(id, data);
  }
}

export class DeleteAdjustmentIndexUseCase {
  constructor(private readonly repository: AdjustmentIndexesRepository) {}

  execute(id: string): Promise<AdjustmentIndex> {
    return this.repository.softDelete(id);
  }
}

export class SeedAdjustmentIndexesUseCase {
  constructor(private readonly repository: AdjustmentIndexesRepository) {}

  execute(): Promise<number> {
    return this.repository.seedDefaults();
  }
}

/** Valor mensal digitado na tela (indexador sem série no BCB, ou correção). */
export class UpsertAdjustmentIndexValueUseCase {
  constructor(private readonly repository: AdjustmentIndexesRepository) {}

  async execute(data: UpsertAdjustmentIndexValueData): Promise<void> {
    const { reference_month: month, reference_year: year } = data;
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new ValidationError('Mês de referência inválido.');
    }
    if (!Number.isInteger(year) || year < 1990 || year > 2200) {
      throw new ValidationError('Ano de referência inválido.');
    }
    if (!Number.isFinite(data.monthly_rate)) {
      throw new ValidationError('Percentual do mês inválido.');
    }
    await this.repository.upsertValue({ ...data, from_api: data.from_api ?? false });
  }
}

export class DeleteAdjustmentIndexValueUseCase {
  constructor(private readonly repository: AdjustmentIndexesRepository) {}

  execute(id: string): Promise<void> {
    return this.repository.deleteValue(id);
  }
}

/**
 * Sincroniza os índices com o SGS do Banco Central.
 *
 * Serve tanto o botão "Atualizar agora" quanto a rotina mensal — é o mesmo
 * caminho, então não há como as duas divergirem. Um indexador que falha não
 * derruba os outros: entra em `skipped` com o motivo e a rodada continua, que
 * é o comportamento esperado quando o BCB está fora do ar.
 */
export class SyncAdjustmentIndexesUseCase {
  constructor(
    private readonly repository: AdjustmentIndexesRepository,
    private readonly fetchSeries: FetchSeries,
  ) {}

  async execute(options: { months?: number } = {}): Promise<SyncResult> {
    // 24 meses por padrão: cobre o acumulado de 12 meses com folga para o
    // cálculo composto ter janela completa.
    const months = options.months ?? 24;
    // A janela termina no ÚLTIMO DIA DO MÊS ANTERIOR: índice do mês corrente
    // ainda não foi publicado, e pedir data futura faz o SGS devolver
    // `{"erro":{}}` em algumas séries (verificado na 189/IGP-M) em vez de
    // simplesmente ignorar o excedente.
    const today = new Date();
    const to = new Date(today.getFullYear(), today.getMonth(), 0);
    const from = new Date(to.getFullYear(), to.getMonth() - months + 1, 1);

    await this.repository.seedDefaults();

    const synced: SyncResult['synced'] = [];
    const skipped: SyncResult['skipped'] = [];

    for (const code of AUTO_UPDATABLE_CODES) {
      const index = await this.repository.findByCode(code);
      if (!index) {
        skipped.push({ code, reason: 'Indexador não cadastrado.' });
        continue;
      }

      try {
        const points = await this.fetchSeries(code, { from, to });
        if (points.length === 0) {
          skipped.push({ code, reason: 'O Banco Central não retornou dados no período.' });
          continue;
        }
        const imported = await this.repository.upsertValues(
          points.map((point) => ({
            adjustment_index_id: index.id,
            reference_month: point.reference_month,
            reference_year: point.reference_year,
            monthly_rate: point.monthly_rate,
            accumulated_12m: point.accumulated_12m,
            from_api: true,
          })),
        );
        synced.push({ code, imported });
      } catch (error) {
        skipped.push({
          code,
          reason: error instanceof Error ? error.message : 'Falha ao consultar o Banco Central.',
        });
      }
    }

    return { synced, skipped };
  }
}
