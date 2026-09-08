'use server';

import { companyUseCases } from '@/infra/factories/company-factory';
import { pickBrandingFields, switchCompanySchema } from '@/shared/validators/company';
import { type ActionResult, runAction } from '@/shared/actions/action-result';
import { requireSession, assertSuperAdmin, withTenant, setSessionCookie } from '@/infra/auth/session';
import { ValidationError } from '@/core/errors/domain-errors';
import type { UploadInput } from '@/core/storage/storage';
import type { BrandingAssetField, CompanyBranding, CompanyWithBranding } from '@/core/entities/company';
import type { SwitchCompanyOutput } from '@/core/use-cases/company/switch-company';
import { listCompaniesData, getCompanyFiltersData } from '@/server/queries/company';
import type { CompanyListResult } from '@/core/entities/company';

/**
 * Server Actions do módulo Company (mutações). Substituem os endpoints de
 * escrita de `/company/*` e `/companies/*` do Express.
 *
 * Camada: server (apresentação SSR).
 * Origem: api-nairim-v2/src/controllers/CompanyController.ts.
 */

/** Limite de tamanho por campo (OG image 10MB; demais 5MB) — como no backend. */
function maxSizeFor(field: BrandingAssetField): number {
  return field === 'og_image_url' ? 10 : 5;
}

/** Extrai o arquivo `file` do FormData como UploadInput (ou lança 400). */
async function extractFile(formData: FormData): Promise<UploadInput> {
  const file = formData.get('file');
  if (!(file instanceof File)) throw new ValidationError('Nenhum arquivo enviado');
  const buffer = Buffer.from(await file.arrayBuffer());
  return { buffer, filename: file.name, contentType: file.type, size: file.size };
}

// ─── Branding (empresa autenticada) ─────────────────────────────────────────

/**
 * Lê o branding da PRÓPRIA empresa (para Client Components que carregam o form).
 * Leitura exposta como action porque Client Components não podem importar queries
 * `server-only`. Origem: GET /company/branding/me.
 */
export async function getMyBrandingAction(): Promise<ActionResult<CompanyBranding | null>> {
  return runAction(() => withTenant((session) => companyUseCases.getMyBranding.execute(session.company_id)));
}

/** Atualiza o branding da PRÓPRIA empresa (admin). Origem: PUT /company/branding. */
export async function updateBrandingAction(input: Record<string, unknown>): Promise<ActionResult<CompanyBranding>> {
  return runAction(() =>
    withTenant((session) => companyUseCases.updateBranding.execute(session.company_id, pickBrandingFields(input)), {
      role: 'admin',
    }),
  );
}

/** Upload de asset da PRÓPRIA empresa (admin). Origem: POST /company/branding/{logo,...}. */
export async function uploadOwnBrandingAssetAction(
  formData: FormData,
  field: BrandingAssetField,
): Promise<ActionResult<{ url: string }>> {
  return runAction(async () => {
    const file = await extractFile(formData);
    return withTenant(
      (session) =>
        companyUseCases.uploadBrandingAsset.execute({ companyId: session.company_id, file, field, maxSizeMB: maxSizeFor(field) }),
      { role: 'admin' },
    );
  });
}

/** Upload de asset de OUTRA empresa (admin gerenciando). Origem: POST /companies/:id/branding/{...}. */
export async function uploadCompanyBrandingAssetAction(
  companyId: string,
  formData: FormData,
  field: BrandingAssetField,
): Promise<ActionResult<{ url: string }>> {
  return runAction(async () => {
    const session = await requireSession();
    assertSuperAdmin(session);
    const file = await extractFile(formData);
    return companyUseCases.uploadBrandingAsset.execute({ companyId, file, field, maxSizeMB: maxSizeFor(field) });
  });
}

// ─── Troca de empresa ───────────────────────────────────────────────────────

/** Emite novo JWT com a empresa destino e regrava o cookie. Origem: POST /company/switch. */
export async function switchCompanyAction(slug: string): Promise<ActionResult<SwitchCompanyOutput>> {
  return runAction(async () => {
    const session = await requireSession();
    const { slug: parsedSlug } = switchCompanySchema.parse({ slug });
    const result = await companyUseCases.switchCompany.execute(
      { id: session.id, name: session.name, email: session.email, role: session.role },
      parsedSlug,
    );
    await setSessionCookie(result.token, result.company.slug);
    return result;
  });
}

// ─── CRUD de Empresas (admin) ───────────────────────────────────────────────

/** Verifica disponibilidade de slug (super admin). Origem: GET /company/check-slug/:slug. */
export async function checkSlugAction(slug: string): Promise<ActionResult<{ available: boolean }>> {
  return runAction(async () => {
    const session = await requireSession();
    assertSuperAdmin(session);
    return companyUseCases.checkSlug.execute(slug);
  });
}

/**
 * Lê uma empresa por ID (para Client Components de edição). Origem: GET /companies/:id.
 */
export async function getCompanyByIdAction(id: string): Promise<ActionResult<CompanyWithBranding>> {
  return runAction(async () => {
    const session = await requireSession();
    assertSuperAdmin(session);
    return companyUseCases.getById.execute(id);
  });
}

/** Cria empresa. Origem: POST /company | POST /companies. */
export async function createCompanyAction(input: Record<string, unknown>): Promise<ActionResult<CompanyWithBranding>> {
  return runAction(async () => {
    const session = await requireSession();
    assertSuperAdmin(session);
    return companyUseCases.create.execute({
      name: input.name as string | undefined,
      slug: input.slug as string | undefined,
      db_quota_mb: input.db_quota_mb as number | null | undefined,
      ...pickBrandingFields(input),
    });
  });
}

/** Atualiza empresa. Origem: PUT /company/:id | PUT /companies/:id. */
export async function updateCompanyAction(id: string, input: Record<string, unknown>): Promise<ActionResult<CompanyWithBranding>> {
  return runAction(async () => {
    const session = await requireSession();
    assertSuperAdmin(session);
    return companyUseCases.update.execute(id, {
      name: input.name as string | undefined,
      slug: input.slug as string | undefined,
      is_active: input.is_active as boolean | undefined,
      db_quota_mb: input.db_quota_mb as number | null | undefined,
      ...pickBrandingFields(input),
    });
  });
}

/** Desativa (soft-delete) empresa. Origem: DELETE /company/:id | DELETE /companies/:id. */
export async function deleteCompanyAction(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const session = await requireSession();
    assertSuperAdmin(session);
    await companyUseCases.remove.execute(id);
    return null;
  });
}

/** Reativa empresa. Origem: PATCH /company/:id/restore | PATCH /companies/:id/restore. */
export async function restoreCompanyAction(id: string): Promise<ActionResult<CompanyWithBranding>> {
  return runAction(async () => {
    const session = await requireSession();
    assertSuperAdmin(session);
    return companyUseCases.restore.execute(id);
  });
}

// ─── Leituras expostas como action (para Client Components) ─────────────────

/** Lista paginada de empresas para o DataTable. Origem: GET /companies. */
export async function listCompaniesAction(raw: Record<string, unknown>): Promise<ActionResult<CompanyListResult>> {
  return runAction(() => listCompaniesData(raw));
}

/** Configuração de filtros do DataTable de empresas. Origem: GET /companies/filters. */
export async function getCompanyFiltersAction(_raw?: Record<string, unknown>): Promise<ActionResult<Record<string, unknown>>> {
  return runAction(() => getCompanyFiltersData());
}
