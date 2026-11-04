# Autenticação e sessão — Domínio

## Modelos Prisma (`prisma/schema.prisma`)
### User
- Campos: name: String; email: String; password: String; birth_date: DateTime; gender: Gender; role: Role; all_companies_access: Boolean; allowed_company_ids: String[]; user_group_id: String?; is_active: Boolean; photo_url: String?; phone_country_code: String?; phone_area_code: String?; phone: String?; phone_extension: String?; has_time_restriction: Boolean; created_by: String?; updated_by: String?
- Relações: documents[] → Document; favorites[] → Favorite; columnPreferences[] → UserColumnPreference; dashboardLayouts[] → UserDashboardLayout; company → Company; group → UserGroup; access_schedules[] → UserAccessSchedule; lease_expiry_reminders[] → LeaseExpiryReminder; lease_notifications[] → LeaseNotification; creator → User; updater → User; created_users[] → User; updated_users[] → User; created_user_groups[] → UserGroup; updated_user_groups[] → UserGroup
- Únicos compostos: company_id, email
- Padrão: id, company_id, created_at, updated_at, deleted_at (exclusão lógica)

### Company
- Campos: name: String; slug: String (único); is_active: Boolean; db_quota_mb: Int?
- Relações: branding → CompanyBranding; users[] → User; properties[] → Property; repairs[] → Repair; repair_media[] → RepairMedia; repair_professionals[] → RepairProfessional; repair_items[] → RepairItem; property_types[] → PropertyType; owners[] → Owner; agencies[] → Agency; tenants[] → Tenant; suppliers[] → Supplier; leases[] → Lease; financial_institutions[] → FinancialInstitution; cards[] → Card; transactions[] → Transaction; invoices[] → Invoice; categories[] → Category; subcategories[] → Subcategory; centers[] → Center; recurring_configs[] → RecurringConfig; plannings[] → Planning; investments[] → Investment; investment_settings → InvestmentSettings; adjustment_indexes[] → AdjustmentIndex; holidays[] → Holiday; lease_expiry_reminders[] → LeaseExpiryReminder; lease_notifications[] → LeaseNotification; documents[] → Document; favorites[] → Favorite; user_column_preferences[] → UserColumnPreference; user_dashboard_layouts[] → UserDashboardLayout; user_groups[] → UserGroup; user_group_permissions[] → UserGroupPermission; user_access_schedules[] → UserAccessSchedule; iptu_audit_settings → IptuAuditSettings; roi_settings → RoiSettings
- Padrão: id, created_at, updated_at, deleted_at (exclusão lógica)

## Entidades e tipos (`src/core/entities`)
`CompanyAccess`, `canAccessCompany`

## Validação (Zod, `src/shared/validators`)
- loginSchema: email, password — auth.ts
- verifyTokenSchema: token — auth.ts
- refreshTokenSchema: token — auth.ts
- requestPasswordResetSchema: email — auth.ts
- resetPasswordSchema: token, newPassword — auth.ts
- changePasswordSchema: oldPassword, newPassword — auth.ts

## Regras de negócio
- Sessão é um JWT (HS256) no cookie `authToken`, mais `company_slug`; `JWT_EXPIRES_IN` define a expiração absoluta (padrão 8 h) e a inatividade é tratada no front.
- Cada requisição valida conta, grupo e restrição de horário (`infra/auth/live-session.ts`); usuário excluído, grupo inválido ou fora do horário perde acesso.
- Limitador de login: 5 falhas por conta (`infra/security/login-rate-limiter.ts`), independente do IP informado pelo cliente; estado em memória do processo (várias réplicas exigiriam armazenamento compartilhado). As variáveis `RATE_LIMIT_*` não o configuram.
- `authToken` é legível por JavaScript (coexistência com `authFetch`/backend legado); tornar HttpOnly exige migrar os consumidores.
- O cliente só restaura a autenticação com documento ativo, aba autenticada que responda ou passagem imediata após login/troca de empresa; cookies sem prazo e expiração por inatividade continuam.
- `src/middleware.ts` protege `/dashboard` e `/<slug>/dashboard` e redireciona não autenticados para `/login`.

## Erros lançados nos use-cases
| Classe | Mensagem | Arquivo |
|---|---|---|
| NotFoundError | Usuário não encontrado | change-password.ts |
| ValidationError | Senha atual incorreta | change-password.ts |
| UnauthorizedError | Token expirado | get-current-user.ts |
| UnauthorizedError | Token inválido | get-current-user.ts |
| UnauthorizedError | Token expirado, faça login novamente | refresh-token.ts |
| ValidationError | Token de redefinição expirado | reset-password.ts |
| ValidationError | Token de redefinição inválido | reset-password.ts |
| ValidationError | Token inválido para redefinição de senha | reset-password.ts |
