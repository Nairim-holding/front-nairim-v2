# Usuários — Domínio

## Modelos Prisma (`prisma/schema.prisma`)
### User
- Campos: name: String; email: String; password: String; birth_date: DateTime; gender: Gender; role: Role; all_companies_access: Boolean; allowed_company_ids: String[]; user_group_id: String?; is_active: Boolean; photo_url: String?; phone_country_code: String?; phone_area_code: String?; phone: String?; phone_extension: String?; has_time_restriction: Boolean; created_by: String?; updated_by: String?
- Relações: documents[] → Document; favorites[] → Favorite; columnPreferences[] → UserColumnPreference; dashboardLayouts[] → UserDashboardLayout; company → Company; group → UserGroup; access_schedules[] → UserAccessSchedule; lease_expiry_reminders[] → LeaseExpiryReminder; lease_notifications[] → LeaseNotification; creator → User; updater → User; created_users[] → User; updated_users[] → User; created_user_groups[] → UserGroup; updated_user_groups[] → UserGroup
- Únicos compostos: company_id, email
- Padrão: id, company_id, created_at, updated_at, deleted_at (exclusão lógica)

### UserAccessSchedule
- Campos: user_id: String; day_of_week: Int; start_time: DateTime; end_time: DateTime
- Relações: user → User; company → Company
- Padrão: id, company_id, created_at, updated_at

## Entidades e tipos (`src/core/entities`)
`User`, `UserCredentials`, `GENDERS`, `Gender`, `ROLES`, `Role`, `UserProfile`, `AccessScheduleRow`, `CreateUserData`, `UpdateUserData`, `UserDetail`, `ListUsersParams`, `PaginatedUsers`

## Validação (Zod, `src/shared/validators`)
- createUserSchema: name, email, password, birth_date, gender, role?, user_group_id?, is_active?, photo_url?, has_time_restriction?, all_companies_access?, allowed_company_ids? — user.ts
- updateUserSchema: name?, email?, password?, birth_date?, gender?, role?, user_group_id?, is_active?, photo_url?, has_time_restriction?, all_companies_access?, allowed_company_ids? — user.ts
- changeUserPasswordSchema: oldPassword, newPassword — user.ts
- listUsersQuerySchema: limit?, page?, search?, includeInactive?, gender?, role? — user.ts

## Regras de negócio
- Papéis (`Role`): `DEFAULT`, `MANAGER`, `ADMIN`, `SUPER_ADMIN`. Só `SUPER_ADMIN` cria ou altera contas `SUPER_ADMIN` e altera credenciais de contas privilegiadas.
- Escritas exigem administrador **e** a permissão `users`. Usuário comum sem grupo não recebe acesso implícito; `ADMIN` sem grupo é irrestrito só na própria empresa.
- E-mail não pode se repetir (`ConflictError`). O login busca o usuário por e-mail sem contexto de empresa (`infra/repositories/prisma-users-repository.ts`).
- Restrição de horário: `UserAccessSchedule` (dia da semana, início, fim) é avaliada em `America/Sao_Paulo` na validação da sessão (`infra/auth/live-session.ts`, `access-schedule.ts`) quando `has_time_restriction` está ligado.
- Exclusão é lógica (`deleted_at`); restaurar só funciona em registro excluído.
- A transferência JSON de usuários exige administrador, remove acessos a outras empresas e só `SUPER_ADMIN` pode importar ou alterar `SUPER_ADMIN`.

## Erros lançados nos use-cases
| Classe | Mensagem | Arquivo |
|---|---|---|
| ValidationError | O ID é obrigatório | crud.ts |
| NotFoundError | Usuário não encontrado | crud.ts |
| ConflictError | E-mail já cadastrado | crud.ts |
| ConflictError | E-mail já cadastrado para outro usuário | crud.ts |
| NotFoundError | Usuário não encontrado ou já excluído | crud.ts |
| ValidationError | O usuário não está excluído | crud.ts |
| ValidationError | O usuário está excluído | crud.ts |
