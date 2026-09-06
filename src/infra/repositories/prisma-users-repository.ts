import prisma from '@/infra/database/prisma';
import { getCurrentCompanyId } from '@/infra/database/tenant-context';
import type { UsersRepository } from '@/core/repositories/users-repository';
import type {
  AccessScheduleRow,
  CreateUserData,
  ListUsersParams,
  PaginatedUsers,
  UpdateUserData,
  User,
  UserCredentials,
  UserDetail,
  UserProfile,
} from '@/core/entities/user';
import { buildDateOnlyCondition, buildDateTimeCondition } from '@/shared/utils/date-utils';

/**
 * Implementação Prisma de {@link UsersRepository}.
 *
 * Multi-tenant:
 *  - Métodos de AUTENTICAÇÃO (login/reset) rodam SEM contexto de tenant → a
 *    extensão do Prisma não injeta `company_id` e o usuário é buscado
 *    globalmente por e-mail, como no backend.
 *  - Métodos do MÓDULO USERS rodam dentro de `withTenant` → `findMany`/
 *    `findFirst`/`count`/`aggregate` recebem o filtro de empresa automaticamente,
 *    e `create` recebe o `company_id` injetado.
 *
 * Camada: infra.
 * Origem: `prisma.user.*` em api-nairim-v2/src/services/AuthService.ts e
 * UserService.ts.
 */

/** Campos devolvidos ao cliente (nunca inclui `password`). */
const PROFILE_SELECT = {
  id: true,
  name: true,
  email: true,
  birth_date: true,
  gender: true,
  role: true,
  is_active: true,
  user_group_id: true,
  photo_url: true,
  group: { select: { id: true, description: true } },
  created_at: true,
  updated_at: true,
} as const;

/** Campos do detalhe (GET /users/:id) — perfil + foto, telefones, auditoria. */
const DETAIL_SELECT = {
  ...PROFILE_SELECT,
  photo_url: true,
  phone_country_code: true,
  phone_area_code: true,
  phone: true,
  phone_extension: true,
  has_time_restriction: true,
  access_schedules: {
    select: { day_of_week: true, start_time: true, end_time: true },
    orderBy: [{ day_of_week: 'asc' as const }, { start_time: 'asc' as const }],
  },
  creator: { select: { id: true, name: true } },
  updater: { select: { id: true, name: true } },
};

/** "HH:MM" → Date ancorado em 1970-01-01 UTC (coluna @db.Time). */
function timeStringToDate(value: string | null | undefined): Date {
  const [h, m = '0'] = String(value).split(':');
  const date = new Date(Date.UTC(1970, 0, 1, Number(h), Number(m), 0));
  return isNaN(date.getTime()) ? new Date(0) : date;
}

/** Coluna @db.Time → "HH:MM", para devolver ao formulário. */
function timeToString(value: Date | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/** Rótulos dos campos (porte de api-nairim-v2/src/types/user.ts → fieldLabels). */
const FIELD_LABELS: Record<string, string> = {
  id: 'ID',
  name: 'Nome',
  email: 'E-mail',
  birth_date: 'Data de Nascimento',
  gender: 'Gênero',
  role: 'Função',
  created_at: 'Criado em',
  updated_at: 'Atualizado em',
};

const GENDER_OPTIONS = ['MALE', 'FEMALE', 'OTHER'];
const ROLE_OPTIONS = ['ADMIN', 'DEFAULT', 'SUPER_ADMIN'];

/** Remove acentos/cedilha e normaliza para comparação de busca. */
function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[çÇ]/g, 'c')
    .replace(/[ñÑ]/g, 'n')
    .toLowerCase()
    .trim();
}

/** Busca em memória ignorando acentos, sobre name/email/gender/role/id. */
function filterUsersBySearch<T extends Record<string, unknown>>(users: T[], searchTerm: string): T[] {
  if (!searchTerm.trim()) return users;
  const normalized = normalizeText(searchTerm);
  return users.filter((user) => {
    const joined = [user.name, user.email, user.gender, user.role, user.id].filter(Boolean).join(' ');
    return normalizeText(joined).includes(normalized);
  });
}

/** Ordenação em memória por campo direto (locale pt-BR). */
function sortByDirectField<T>(items: T[], field: string, direction: 'asc' | 'desc'): T[] {
  return [...items].sort((a, b) => {
    const strA = normalizeText(String((a as Record<string, unknown>)[field] ?? ''));
    const strB = normalizeText(String((b as Record<string, unknown>)[field] ?? ''));
    return direction === 'asc'
      ? strA.localeCompare(strB, 'pt-BR', { sensitivity: 'base' })
      : strB.localeCompare(strA, 'pt-BR', { sensitivity: 'base' });
  });
}

/** Monta o ORDER BY do Prisma; default `created_at desc`. */
function buildOrderBy(sortOptions: Record<string, 'asc' | 'desc'>): Record<string, string>[] {
  const orderBy: Record<string, string>[] = [];
  const sortable = ['id', 'name', 'email', 'birth_date', 'gender', 'role', 'created_at', 'updated_at'];
  Object.entries(sortOptions).forEach(([field, value]) => {
    if (!value) return;
    if (sortable.includes(field)) orderBy.push({ [field]: value });
  });
  if (orderBy.length === 0) orderBy.push({ created_at: 'desc' });
  return orderBy;
}

/** Traduz os filtros do DataTable em condições Prisma. */
function buildFilterConditions(filters: Record<string, unknown>): Record<string, unknown> {
  const conditions: Record<string, unknown> = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;

    if (['name', 'email'].includes(key)) {
      conditions[key] = { contains: String(value), mode: 'insensitive' };
    } else if (['gender', 'role'].includes(key)) {
      conditions[key] = { equals: String(value).toUpperCase() };
    } else if (key === 'birth_date') {
      conditions[key] = buildDateOnlyCondition(value);
    } else if (key === 'created_at' || key === 'updated_at') {
      conditions[key] = buildDateTimeCondition(value);
    }
  });
  return conditions;
}

/** WHERE sem a busca global (a busca é feita em memória). */
function buildWhereClauseWithoutSearch(filters: Record<string, unknown>, includeInactive: boolean): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (!includeInactive) where.deleted_at = null;
  const conditions = buildFilterConditions(filters);
  if (Object.keys(conditions).length > 0) where.AND = [conditions];
  return where;
}

export class PrismaUsersRepository implements UsersRepository {
  // ─── Autenticação (sem contexto de tenant) ───────────────────────────────

  /** @inheritdoc */
  async findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    const user = await prisma.user.findFirst({
      where: { email, deleted_at: null },
      select: { id: true, name: true, email: true, password: true, role: true, company_id: true, created_at: true },
    });
    if (!user) return null;
    return { ...user, role: String(user.role) };
  }

  /** @inheritdoc */
  async findCredentialsById(id: string): Promise<UserCredentials | null> {
    const user = await prisma.user.findFirst({
      where: { id, deleted_at: null },
      select: { id: true, name: true, email: true, password: true, role: true, company_id: true, created_at: true },
    });
    if (!user) return null;
    return { ...user, role: String(user.role) };
  }

  /** @inheritdoc */
  async findById(id: string): Promise<User | null> {
    const user = await prisma.user.findFirst({
      where: { id, deleted_at: null },
      select: { ...PROFILE_SELECT, company_id: true },
    });
    if (!user) return null;
    return {
      ...user,
      role: String(user.role),
      gender: user.gender === null ? null : String(user.gender),
    };
  }

  /** @inheritdoc */
  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await prisma.user.update({ where: { id }, data: { password: passwordHash } });
  }

  // ─── Módulo Users (dentro do contexto de tenant) ──────────────────────────

  /** @inheritdoc */
  async list(params: ListUsersParams): Promise<PaginatedUsers> {
    const take = Math.max(1, Math.min(params.limit, 100));
    const skip = (Math.max(1, params.page) - 1) * take;
    const where = buildWhereClauseWithoutSearch(params.filters, params.includeInactive);

    // Normaliza `sort_<campo>=asc|desc` → `{ campo: 'asc'|'desc' }`.
    const normalizedSort: Record<string, 'asc' | 'desc'> = {};
    Object.entries(params.sortOptions).forEach(([key, value]) => {
      const dir = String(value).toLowerCase();
      if (dir === 'asc' || dir === 'desc') normalizedSort[key.replace('sort_', '')] = dir;
    });
    const sortField = Object.keys(normalizedSort)[0];
    const sortDirection = sortField ? normalizedSort[sortField] : undefined;

    let users: UserProfile[] = [];
    let total = 0;

    if (params.search && params.search.trim()) {
      // Com busca: traz tudo e processa em memória (acentos ignorados) — igual ao backend.
      const all = await prisma.user.findMany({ where: where as never, select: PROFILE_SELECT });
      const filtered = filterUsersBySearch(all as unknown as Record<string, unknown>[], params.search);
      total = filtered.length;

      const sorted =
        sortField && sortDirection
          ? sortByDirectField(filtered, sortField, sortDirection)
          : [...filtered].sort(
              (a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime(),
            );

      users = sorted.slice(skip, skip + take) as unknown as UserProfile[];
    } else {
      const orderBy = buildOrderBy(normalizedSort);
      const [data, count] = await Promise.all([
        prisma.user.findMany({ where: where as never, skip, take, orderBy: orderBy as never, select: PROFILE_SELECT }),
        prisma.user.count({ where: where as never }),
      ]);
      users = data as unknown as UserProfile[];
      total = count;
    }

    return {
      data: users,
      count: total,
      totalPages: total ? Math.ceil(total / take) : 0,
      currentPage: params.page,
    };
  }

  /** @inheritdoc */
  async getFilters(filters: Record<string, unknown>): Promise<Record<string, unknown>> {
    // WHERE contextual: só usuários ativos + filtros já aplicados.
    const where: Record<string, unknown> = { deleted_at: null };
    Object.entries(filters ?? {}).forEach(([key, value]) => {
      if (!value || value === '') return;
      if (key === 'name' || key === 'email') {
        where[key] = { contains: String(value), mode: 'insensitive' };
      } else if (key === 'gender' || key === 'role') {
        where[key] = value;
      } else if (['birth_date', 'created_at', 'updated_at'].includes(key)) {
        const condition = key === 'birth_date' ? buildDateOnlyCondition(value) : buildDateTimeCondition(value);
        if (Object.keys(condition).length > 0) where[key] = condition;
      }
    });

    const users = await prisma.user.findMany({
      where: where as never,
      select: { name: true, email: true, gender: true, role: true, birth_date: true, created_at: true, updated_at: true },
      orderBy: { name: 'asc' },
    });

    const dateRange = await prisma.user.aggregate({
      where: where as never,
      _min: { birth_date: true, created_at: true },
      _max: { birth_date: true, created_at: true },
    });

    const uniqueNames = Array.from(new Set(users.filter((u) => u.name).map((u) => u.name.trim()))).sort();
    const uniqueEmails = Array.from(new Set(users.filter((u) => u.email).map((u) => u.email.trim()))).sort();
    const uniqueGenders = Array.from(new Set(users.filter((u) => u.gender).map((u) => String(u.gender)))).sort();
    const uniqueRoles = Array.from(new Set(users.filter((u) => u.role).map((u) => String(u.role)))).sort();

    return {
      filters: [
        { field: 'name', type: 'string', label: FIELD_LABELS.name, description: 'Nome completo do usuário', values: uniqueNames, searchable: true, autocomplete: true },
        { field: 'email', type: 'string', label: FIELD_LABELS.email, description: 'Endereço de email', values: uniqueEmails, searchable: true, autocomplete: true, inputType: 'email' },
        { field: 'gender', type: 'enum', label: FIELD_LABELS.gender, description: 'Gênero', values: uniqueGenders, options: GENDER_OPTIONS, searchable: true, autocomplete: true },
        { field: 'role', type: 'enum', label: FIELD_LABELS.role, description: 'Papel/role do usuário', values: uniqueRoles, options: ROLE_OPTIONS, searchable: true, autocomplete: true },
        { field: 'birth_date', type: 'date', label: FIELD_LABELS.birth_date, description: 'Data de nascimento', min: dateRange._min.birth_date?.toISOString().split('T')[0], max: dateRange._max.birth_date?.toISOString().split('T')[0], dateRange: true },
        { field: 'created_at', type: 'date', label: FIELD_LABELS.created_at, description: 'Data de criação do cadastro', min: dateRange._min.created_at?.toISOString().split('T')[0], max: dateRange._max.created_at?.toISOString().split('T')[0], dateRange: true },
      ],
      operators: {
        string: ['contains', 'equals', 'startsWith', 'endsWith'],
        number: ['equals', 'gt', 'gte', 'lt', 'lte', 'between'],
        date: ['equals', 'gt', 'gte', 'lt', 'lte', 'between'],
        boolean: ['equals'],
        enum: ['equals', 'in'],
      },
      defaultSort: 'created_at:desc',
      searchFields: ['name', 'email', 'gender', 'role'],
    };
  }

  /** @inheritdoc */
  async findProfileById(id: string): Promise<UserProfile | null> {
    const user = await prisma.user.findFirst({ where: { id, deleted_at: null }, select: PROFILE_SELECT });
    if (!user) return null;
    return { ...user, role: String(user.role), gender: user.gender === null ? null : String(user.gender) };
  }

  /** @inheritdoc */
  async findDetailById(id: string): Promise<UserDetail | null> {
    const user = await prisma.user.findFirst({ where: { id, deleted_at: null }, select: DETAIL_SELECT });
    if (!user) return null;

    const { access_schedules, ...profile } = user;
    return {
      ...profile,
      role: String(profile.role),
      gender: profile.gender === null ? null : String(profile.gender),
      user_group_id: profile.user_group_id ?? null,
      is_active: profile.is_active ?? true,
      photo_url: profile.photo_url ?? null,
      phone_country_code: profile.phone_country_code ?? null,
      phone_area_code: profile.phone_area_code ?? null,
      phone: profile.phone ?? null,
      phone_extension: profile.phone_extension ?? null,
      has_time_restriction: profile.has_time_restriction ?? false,
      group: profile.group ?? null,
      creator: profile.creator ?? null,
      updater: profile.updater ?? null,
      access_schedules: (access_schedules ?? []).map((s) => ({
        day_of_week: s.day_of_week,
        start_time: timeToString(s.start_time) ?? '',
        end_time: timeToString(s.end_time) ?? '',
      })),
    };
  }

  /** @inheritdoc */
  async emailExists(email: string): Promise<boolean> {
    const user = await prisma.user.findFirst({ where: { email, deleted_at: null }, select: { id: true } });
    return !!user;
  }

  /** @inheritdoc */
  async emailExistsExcept(email: string, exceptId: string): Promise<boolean> {
    const user = await prisma.user.findFirst({
      where: { email, deleted_at: null, NOT: { id: exceptId } },
      select: { id: true },
    });
    return !!user;
  }

  /** @inheritdoc */
  async create(data: CreateUserData): Promise<UserProfile> {
    // `company_id` é injetado pela extensão multi-tenant a partir do contexto.
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: data.passwordHash,
        birth_date: data.birth_date,
        gender: data.gender as never,
        role: (data.role ?? 'DEFAULT') as never,
        user_group_id: data.user_group_id || null,
        is_active: data.is_active ?? true,
        photo_url: data.photo_url || null,
        phone_country_code: data.phone_country_code || null,
        phone_area_code: data.phone_area_code || null,
        phone: data.phone || null,
        phone_extension: data.phone_extension || null,
        has_time_restriction: data.has_time_restriction ?? false,
        created_by: data.created_by || null,
        updated_by: data.created_by || null,
      } as never,
      select: PROFILE_SELECT,
    });
    return { ...user, role: String(user.role), gender: user.gender === null ? null : String(user.gender) };
  }

  /** @inheritdoc */
  async update(id: string, data: UpdateUserData): Promise<UserProfile> {
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.birth_date !== undefined ? { birth_date: data.birth_date } : {}),
        ...(data.gender !== undefined ? { gender: data.gender } : {}),
        ...(data.role !== undefined ? { role: data.role } : {}),
        ...(data.passwordHash !== undefined ? { password: data.passwordHash } : {}),
        ...(data.user_group_id !== undefined ? { user_group_id: data.user_group_id || null } : {}),
        ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
        ...(data.photo_url !== undefined ? { photo_url: data.photo_url || null } : {}),
        ...(data.phone_country_code !== undefined ? { phone_country_code: data.phone_country_code || null } : {}),
        ...(data.phone_area_code !== undefined ? { phone_area_code: data.phone_area_code || null } : {}),
        ...(data.phone !== undefined ? { phone: data.phone || null } : {}),
        ...(data.phone_extension !== undefined ? { phone_extension: data.phone_extension || null } : {}),
        ...(data.has_time_restriction !== undefined ? { has_time_restriction: data.has_time_restriction } : {}),
        ...(data.updated_by !== undefined ? { updated_by: data.updated_by || null } : {}),
      } as never,
      select: PROFILE_SELECT,
    });
    return { ...user, role: String(user.role), gender: user.gender === null ? null : String(user.gender) };
  }

  /** @inheritdoc */
  async softDelete(id: string): Promise<{ name: string }> {
    const user = await prisma.user.findFirst({ where: { id, deleted_at: null }, select: { name: true, email: true } });
    if (!user) throw new Error('Usuário não encontrado ou já excluído');

    // Renomeia o e-mail para liberar o original para novo cadastro (igual ao backend).
    const deletedEmail = `ex_${new Date().getTime()}_${user.email}`;
    await prisma.user.update({ where: { id }, data: { deleted_at: new Date(), email: deletedEmail } });
    return { name: user.name };
  }

  /** @inheritdoc */
  async findDeletionState(id: string): Promise<{ name: string; deleted_at: Date | null } | null> {
    // Sem filtro `deleted_at` — precisamos justamente ler usuários excluídos.
    const user = await prisma.user.findFirst({ where: { id }, select: { name: true, deleted_at: true } });
    return user ?? null;
  }

  /** @inheritdoc */
  async restore(id: string): Promise<void> {
    // O e-mail permanece como `ex_...` para não conflitar caso o original tenha sido reusado.
    await prisma.user.update({ where: { id }, data: { deleted_at: null } });
  }

  /** @inheritdoc */
  async setActive(id: string, isActive: boolean, updatedBy?: string | null): Promise<UserProfile> {
    const user = await prisma.user.update({
      where: { id },
      data: { is_active: isActive, updated_by: updatedBy || null },
      select: PROFILE_SELECT,
    });
    return { ...user, role: String(user.role), gender: user.gender === null ? null : String(user.gender) };
  }

  /** @inheritdoc */
  async setPhoto(id: string, photoUrl: string, updatedBy?: string | null): Promise<UserProfile> {
    const user = await prisma.user.update({
      where: { id },
      data: { photo_url: photoUrl, updated_by: updatedBy || null },
      select: PROFILE_SELECT,
    });
    return { ...user, role: String(user.role), gender: user.gender === null ? null : String(user.gender) };
  }

  /** @inheritdoc */
  async getSchedule(userId: string): Promise<AccessScheduleRow[]> {
    // findFirst é escopado por empresa pela extensão do Prisma.
    const user = await prisma.user.findFirst({
      where: { id: userId, deleted_at: null },
      select: { id: true },
    });
    if (!user) throw new Error('User not found');

    const rows = await prisma.userAccessSchedule.findMany({
      where: { user_id: userId },
      orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }],
    });

    return rows.map((r) => ({
      day_of_week: r.day_of_week,
      start_time: timeToString(r.start_time) ?? '',
      end_time: timeToString(r.end_time) ?? '',
    }));
  }

  /** @inheritdoc */
  async setSchedule(userId: string, rows: AccessScheduleRow[]): Promise<AccessScheduleRow[]> {
    const companyId = getCurrentCompanyId();
    if (!companyId) throw new Error('Company context not found');

    const user = await prisma.user.findFirst({
      where: { id: userId, deleted_at: null },
      select: { id: true },
    });
    if (!user) throw new Error('User not found');

    // Troca atômica. deleteMany leva company_id explícito porque a extensão
    // do Prisma não intercepta deleteMany (só findMany/findFirst/count/
    // aggregate/groupBy/create/createMany — ver infra/database/prisma.ts).
    await prisma.$transaction(async (tx) => {
      await tx.userAccessSchedule.deleteMany({ where: { user_id: userId, company_id: companyId } });
      if (rows.length > 0) {
        await tx.userAccessSchedule.createMany({
          data: rows.map((r) => ({
            user_id: userId,
            company_id: companyId,
            day_of_week: r.day_of_week,
            start_time: timeStringToDate(r.start_time),
            end_time: timeStringToDate(r.end_time),
          })),
        });
      }
    });

    return this.getSchedule(userId);
  }
}
