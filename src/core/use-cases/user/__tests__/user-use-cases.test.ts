import { describe, it, expect, beforeEach } from 'vitest';
import type { UsersRepository } from '@/core/repositories/users-repository';
import type { Hasher } from '@/core/cryptography/hasher';
import type { Storage } from '@/core/storage/storage';
import type {
  AccessScheduleRow, CreateUserData, ListUsersParams, PaginatedUsers, UpdateUserData, User, UserCredentials, UserDetail, UserProfile,
} from '@/core/entities/user';
import {
  CreateUserUseCase, UpdateUserUseCase, DeleteUserUseCase, RestoreUserUseCase, GetUserByIdUseCase,
  SetActiveUserUseCase, UploadUserPhotoUseCase, GetUserScheduleUseCase, SetUserScheduleUseCase,
} from '@/core/use-cases/user/crud';
import { ConflictError, NotFoundError, ValidationError } from '@/core/errors/domain-errors';

/** Repositório de usuários em memória (contrato completo do módulo Users). */
class InMemoryUsersRepository implements UsersRepository {
  items: (UserProfile & {
    password: string;
    company_id: string;
    deleted_at: Date | null;
    is_active: boolean;
    user_group_id: string | null;
    photo_url: string | null;
    has_time_restriction: boolean;
    schedules: AccessScheduleRow[];
  })[] = [];

  private profile(u: (typeof this.items)[number]): UserProfile {
    return {
      id: u.id, name: u.name, email: u.email, birth_date: u.birth_date,
      gender: u.gender, role: u.role, is_active: u.is_active,
      user_group_id: u.user_group_id, photo_url: u.photo_url,
      created_at: u.created_at, updated_at: u.updated_at,
    };
  }

  // ─── Auth ───
  async findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    const u = this.items.find((x) => x.email === email && !x.deleted_at);
    return u ? { id: u.id, name: u.name, email: u.email, role: u.role, company_id: u.company_id, created_at: u.created_at, password: u.password } : null;
  }
  async findCredentialsById(id: string): Promise<UserCredentials | null> {
    const u = this.items.find((x) => x.id === id && !x.deleted_at);
    return u ? { id: u.id, name: u.name, email: u.email, role: u.role, company_id: u.company_id, created_at: u.created_at, password: u.password } : null;
  }
  async findById(id: string): Promise<User | null> {
    const u = this.items.find((x) => x.id === id && !x.deleted_at);
    return u ? { ...this.profile(u), company_id: u.company_id } : null;
  }
  async updatePassword(id: string, passwordHash: string): Promise<void> {
    const u = this.items.find((x) => x.id === id);
    if (u) u.password = passwordHash;
  }

  // ─── Users ───
  async list(params: ListUsersParams): Promise<PaginatedUsers> {
    const active = this.items.filter((u) => params.includeInactive || !u.deleted_at);
    return { data: active.map((u) => this.profile(u)), count: active.length, totalPages: 1, currentPage: params.page };
  }
  async getFilters(): Promise<Record<string, unknown>> {
    return { filters: [], operators: {}, defaultSort: 'created_at:desc', searchFields: [] };
  }
  async findProfileById(id: string): Promise<UserProfile | null> {
    const u = this.items.find((x) => x.id === id && !x.deleted_at);
    return u ? this.profile(u) : null;
  }
  async findDetailById(id: string): Promise<UserDetail | null> {
    const u = this.items.find((x) => x.id === id && !x.deleted_at);
    if (!u) return null;
    return {
      ...this.profile(u),
      is_active: u.is_active,
      user_group_id: u.user_group_id,
      photo_url: u.photo_url,
      phone_country_code: null,
      phone_area_code: null,
      phone: null,
      phone_extension: null,
      has_time_restriction: u.has_time_restriction,
      group: null,
      creator: null,
      updater: null,
      access_schedules: u.schedules ?? [],
    };
  }
  async emailExists(email: string): Promise<boolean> {
    return this.items.some((u) => u.email === email && !u.deleted_at);
  }
  async emailExistsExcept(email: string, exceptId: string): Promise<boolean> {
    return this.items.some((u) => u.email === email && !u.deleted_at && u.id !== exceptId);
  }
  async create(data: CreateUserData): Promise<UserProfile> {
    const now = new Date();
    const u = {
      id: `u-${this.items.length + 1}`, name: data.name, email: data.email, password: data.passwordHash,
      birth_date: data.birth_date, gender: data.gender, role: data.role ?? 'DEFAULT',
      company_id: 'c1', created_at: now, updated_at: now, deleted_at: null,
      is_active: data.is_active ?? true, user_group_id: data.user_group_id ?? null,
      photo_url: data.photo_url ?? null, has_time_restriction: data.has_time_restriction ?? false, schedules: [],
    };
    this.items.push(u);
    return this.profile(u);
  }
  async update(id: string, data: UpdateUserData): Promise<UserProfile> {
    const u = this.items.find((x) => x.id === id)!;
    if (data.name !== undefined) u.name = data.name;
    if (data.email !== undefined) u.email = data.email;
    if (data.birth_date !== undefined) u.birth_date = data.birth_date;
    if (data.gender !== undefined) u.gender = data.gender;
    if (data.role !== undefined) u.role = data.role;
    if (data.passwordHash !== undefined) u.password = data.passwordHash;
    return this.profile(u);
  }
  async softDelete(id: string): Promise<{ name: string }> {
    const u = this.items.find((x) => x.id === id)!;
    u.deleted_at = new Date();
    u.email = `ex_${Date.now()}_${u.email}`;
    return { name: u.name };
  }
  async findDeletionState(id: string) {
    const u = this.items.find((x) => x.id === id);
    return u ? { name: u.name, deleted_at: u.deleted_at } : null;
  }
  async restore(id: string): Promise<void> {
    const u = this.items.find((x) => x.id === id);
    if (u) u.deleted_at = null;
  }
  async setActive(id: string, isActive: boolean): Promise<UserProfile> {
    const u = this.items.find((x) => x.id === id)!;
    u.is_active = isActive;
    return this.profile(u);
  }
  async setPhoto(id: string, photoUrl: string): Promise<UserProfile> {
    const u = this.items.find((x) => x.id === id)!;
    u.photo_url = photoUrl;
    return this.profile(u);
  }
  async getSchedule(userId: string): Promise<AccessScheduleRow[]> {
    const u = this.items.find((x) => x.id === userId && !x.deleted_at);
    if (!u) throw new Error('User not found');
    return u.schedules ?? [];
  }
  async setSchedule(userId: string, rows: AccessScheduleRow[]): Promise<AccessScheduleRow[]> {
    const u = this.items.find((x) => x.id === userId && !x.deleted_at);
    if (!u) throw new Error('User not found');
    u.schedules = rows;
    return rows;
  }
}

class FakeHasher implements Hasher {
  async hash(plain: string) { return `hashed:${plain}`; }
  async compare(plain: string, hash: string) { return hash === `hashed:${plain}`; }
}

function seed(repo: InMemoryUsersRepository, over: Partial<(typeof repo.items)[number]> = {}) {
  const now = new Date();
  repo.items.push({
    id: 'u-1', name: 'Maria', email: 'maria@nairim.com', password: 'hashed:secret',
    birth_date: new Date('1990-01-01'), gender: 'FEMALE', role: 'DEFAULT',
    company_id: 'c1', created_at: now, updated_at: now, deleted_at: null,
    is_active: true, user_group_id: null, photo_url: null, has_time_restriction: false, schedules: [],
    ...over,
  });
}

class FakeStorage implements Storage {
  urls: string[] = [];
  async upload(input: { buffer: Buffer; filename: string; contentType: string; size: number }, folder: string): Promise<string> {
    const url = `https://storage.test/${folder}/${input.filename}`;
    this.urls.push(url);
    return url;
  }
  async delete(url: string): Promise<void> {
    this.urls = this.urls.filter((u) => u !== url);
  }
  async uploadMedia(input: { buffer: Buffer; filename: string; contentType: string; size: number }, folder: string) {
    const url = await this.upload(input, folder);
    return { url, contentType: input.contentType };
  }
}

describe('User use-cases', () => {
  let repo: InMemoryUsersRepository;
  let hasher: FakeHasher;

  beforeEach(() => {
    repo = new InMemoryUsersRepository();
    hasher = new FakeHasher();
  });

  describe('CreateUserUseCase', () => {
    it('cria usuário com senha hasheada e role padrão DEFAULT', async () => {
      const uc = new CreateUserUseCase(repo, hasher);
      const user = await uc.execute({
        name: 'João', email: 'joao@x.com', password: 'segredo1',
        birth_date: '1990-05-05', gender: 'MALE',
      });
      expect(user.role).toBe('DEFAULT');
      expect(repo.items[0].password).toBe('hashed:segredo1');
    });

    it('rejeita e-mail já cadastrado (409)', async () => {
      seed(repo);
      const uc = new CreateUserUseCase(repo, hasher);
      await expect(
        uc.execute({ name: 'X', email: 'maria@nairim.com', password: 'segredo1', birth_date: '1990-01-01', gender: 'OTHER' }),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('UpdateUserUseCase', () => {
    it('lança NotFound se o usuário não existe', async () => {
      const uc = new UpdateUserUseCase(repo, hasher);
      await expect(uc.execute('ghost', { name: 'X' })).rejects.toBeInstanceOf(NotFoundError);
    });

    it('rejeita e-mail já usado por outro usuário (409)', async () => {
      seed(repo, { id: 'u-1', email: 'a@x.com' });
      seed(repo, { id: 'u-2', email: 'b@x.com' });
      const uc = new UpdateUserUseCase(repo, hasher);
      await expect(uc.execute('u-2', { email: 'a@x.com' })).rejects.toBeInstanceOf(ConflictError);
    });

    it('re-hasheia a senha quando enviada', async () => {
      seed(repo);
      const uc = new UpdateUserUseCase(repo, hasher);
      await uc.execute('u-1', { password: 'novaSenha' });
      expect(repo.items[0].password).toBe('hashed:novaSenha');
    });

    it('mantém o mesmo e-mail sem acusar conflito', async () => {
      seed(repo);
      const uc = new UpdateUserUseCase(repo, hasher);
      const out = await uc.execute('u-1', { email: 'maria@nairim.com', name: 'Maria S.' });
      expect(out.name).toBe('Maria S.');
    });
  });

  describe('DeleteUserUseCase', () => {
    it('faz soft-delete e libera o e-mail original', async () => {
      seed(repo);
      const out = await new DeleteUserUseCase(repo).execute('u-1');
      expect(out.name).toBe('Maria');
      expect(repo.items[0].deleted_at).not.toBeNull();
      expect(repo.items[0].email).toContain('ex_');
    });

    it('lança NotFound se não existe', async () => {
      await expect(new DeleteUserUseCase(repo).execute('ghost')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('RestoreUserUseCase', () => {
    it('restaura usuário excluído', async () => {
      seed(repo, { deleted_at: new Date() });
      const out = await new RestoreUserUseCase(repo).execute('u-1');
      expect(out.name).toBe('Maria');
      expect(repo.items[0].deleted_at).toBeNull();
    });

    it('lança ValidationError se o usuário não está excluído', async () => {
      seed(repo);
      await expect(new RestoreUserUseCase(repo).execute('u-1')).rejects.toBeInstanceOf(ValidationError);
    });

    it('lança NotFound se não existe', async () => {
      await expect(new RestoreUserUseCase(repo).execute('ghost')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('GetUserByIdUseCase', () => {
    it('lança NotFound para usuário inexistente', async () => {
      await expect(new GetUserByIdUseCase(repo).execute('ghost')).rejects.toBeInstanceOf(NotFoundError);
    });

    it('exige ID', async () => {
      await expect(new GetUserByIdUseCase(repo).execute('')).rejects.toBeInstanceOf(ValidationError);
    });

    it('retorna detalhe com is_active e agenda', async () => {
      seed(repo, { is_active: false, schedules: [{ day_of_week: 1, start_time: '09:00', end_time: '18:00' }] });
      const detail = await new GetUserByIdUseCase(repo).execute('u-1');
      expect(detail.is_active).toBe(false);
      expect(detail.access_schedules).toHaveLength(1);
    });
  });

  describe('SetActiveUserUseCase', () => {
    it('liga/desliga usuário ativo', async () => {
      seed(repo, { is_active: true });
      const uc = new SetActiveUserUseCase(repo);
      const out = await uc.execute('u-1', false, 'u-1');
      expect(out.is_active).toBe(false);
      expect(repo.items[0].is_active).toBe(false);
    });

    it('lança ValidationError para usuário excluído', async () => {
      seed(repo, { deleted_at: new Date() });
      await expect(new SetActiveUserUseCase(repo).execute('u-1', true)).rejects.toBeInstanceOf(ValidationError);
    });

    it('lança NotFound para usuário inexistente', async () => {
      await expect(new SetActiveUserUseCase(repo).execute('ghost', true)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('UploadUserPhotoUseCase', () => {
    const input = { buffer: Buffer.from('x'), filename: 'foto.jpg', contentType: 'image/jpeg', size: 10 };

    it('sobe a foto e persiste a URL', async () => {
      seed(repo, { photo_url: null });
      const storage = new FakeStorage();
      const out = await new UploadUserPhotoUseCase(repo, storage).execute('u-1', input, 'u-1');
      expect(out.photo_url).toContain('users/u-1/photo');
      expect(repo.items[0].photo_url).toBe(out.photo_url);
    });

    it('remove a foto anterior do bucket', async () => {
      seed(repo, { photo_url: 'https://storage.test/users/u-1/photo/old.jpg' });
      const storage = new FakeStorage();
      storage.urls = ['https://storage.test/users/u-1/photo/old.jpg'];
      await new UploadUserPhotoUseCase(repo, storage).execute('u-1', input, 'u-1');
      expect(storage.urls).not.toContain('https://storage.test/users/u-1/photo/old.jpg');
    });

    it('lança NotFound se o usuário não existe', async () => {
      const storage = new FakeStorage();
      await expect(new UploadUserPhotoUseCase(repo, storage).execute('ghost', input)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('User schedule use-cases', () => {
    it('retorna a agenda do usuário', async () => {
      seed(repo, { schedules: [{ day_of_week: 1, start_time: '09:00', end_time: '12:00' }] });
      const rows = await new GetUserScheduleUseCase(repo).execute('u-1');
      expect(rows).toHaveLength(1);
    });

    it('substitui a agenda inteira', async () => {
      seed(repo);
      const rows: AccessScheduleRow[] = [{ day_of_week: 2, start_time: '08:00', end_time: '17:00' }];
      const saved = await new SetUserScheduleUseCase(repo).execute('u-1', rows);
      expect(saved).toEqual(rows);
      expect(repo.items[0].schedules).toEqual(rows);
    });

    it('lança ValidationError sem ID', async () => {
      await expect(new SetUserScheduleUseCase(repo).execute('', [])).rejects.toBeInstanceOf(ValidationError);
    });
  });
});
