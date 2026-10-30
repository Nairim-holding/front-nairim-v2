# Empresas — Domínio

## Modelos Prisma (`prisma/schema.prisma`)
### Company
- Campos: name: String; slug: String (único); is_active: Boolean; db_quota_mb: Int?
- Relações: branding → CompanyBranding; users[] → User; properties[] → Property; repairs[] → Repair; repair_media[] → RepairMedia; repair_professionals[] → RepairProfessional; repair_items[] → RepairItem; property_types[] → PropertyType; owners[] → Owner; agencies[] → Agency; tenants[] → Tenant; suppliers[] → Supplier; leases[] → Lease; financial_institutions[] → FinancialInstitution; cards[] → Card; transactions[] → Transaction; invoices[] → Invoice; categories[] → Category; subcategories[] → Subcategory; centers[] → Center; recurring_configs[] → RecurringConfig; plannings[] → Planning; investments[] → Investment; investment_settings → InvestmentSettings; adjustment_indexes[] → AdjustmentIndex; holidays[] → Holiday; lease_expiry_reminders[] → LeaseExpiryReminder; lease_notifications[] → LeaseNotification; documents[] → Document; favorites[] → Favorite; user_column_preferences[] → UserColumnPreference; user_dashboard_layouts[] → UserDashboardLayout; user_groups[] → UserGroup; user_group_permissions[] → UserGroupPermission; user_access_schedules[] → UserAccessSchedule; iptu_audit_settings → IptuAuditSettings; roi_settings → RoiSettings
- Padrão: id, created_at, updated_at, deleted_at (exclusão lógica)

### CompanyBranding
- Campos: logo_url: String?; favicon_url: String?; primary_color: String?; secondary_color: String?; company_name: String?; company_info: Json?; trade_name: String?; app_title: String?; app_description: String?; logo_sidebar_url: String?; logo_dark_url: String?; og_image_url: String?; legal_name: String?; cnpj: String?; phone: String?; email: String?; zip_code: String?; street: String?; number: String?; complement: String?; district: String?; city: String?; state: String?; accent_color: String?; success_color: String?; warning_color: String?; error_color: String?; info_color: String?; bg_color: String?; card_color: String?; border_color: String?; text_color: String?; primary_color_dark: String?; secondary_color_dark: String?; accent_color_dark: String?; success_color_dark: String?; warning_color_dark: String?; error_color_dark: String?; info_color_dark: String?; bg_color_dark: String?; card_color_dark: String?; border_color_dark: String?; text_color_dark: String?
- Relações: company → Company
- Padrão: id, company_id, created_at, updated_at

## Entidades e tipos (`src/core/entities`)
`BRANDING_FIELDS`, `BrandingField`, `BrandingData`, `BrandingAssetField`, `Company`, `CompanyBranding`, `CompanyWithBranding`, `PublicBranding`, `CompanyListResult`, `CompanyAccess`, `canAccessCompany`

## Validação (Zod, `src/shared/validators`)
- switchCompanySchema: slug — company.ts
- listCompaniesQuerySchema: page?, limit?, search?, name?, slug?, is_active, includeInactive — company.ts

## Regras de negócio
- Operações globais (listar, criar, editar, excluir empresas e trocar de empresa) exigem `SUPER_ADMIN` (`assertSuperAdmin`). Cada usuário edita só o branding da própria empresa.
- `slug` é único e aparece na URL (`/<slug>/dashboard`); `Company` e `CompanyBranding` **não** são tenant-scoped.
- Branding público por slug tem cache em memória de 60 s, invalidado em update e upload. Imagens: validação de tipo e tamanho (`ValidationError`). Cores aceitas por `isSafeBrandingColor`.
- Tema: cada cor, nos modos claro e escuro, tem botão **Desfazer**; campo originalmente vazio volta a herdar o padrão; só aplica ao salvar. Se só há cores claras, os escuros são derivados (`lib/colorUtils.ts`).
- `db_quota_mb` define a cota de banco mostrada no dashboard; nulo = sem limite.
- Exclusão é lógica (`deleted_at`); restaurar só funciona em registro excluído.

## Erros lançados nos use-cases
| Classe | Mensagem | Arquivo |
|---|---|---|
| ValidationError | Parâmetro "slug" é obrigatório | branding.ts |
| NotFoundError | Empresa não encontrada | branding.ts |
| ValidationError | Campo de imagem inválido | branding.ts |
| ValidationError | Arquivo deve ser uma imagem | branding.ts |
| ValidationError | Arquivo excede o limite de ${maxSizeMB}MB | branding.ts |
| ValidationError | Slug é obrigatório | crud.ts |
| ValidationError | name e slug são obrigatórios | crud.ts |
| ConflictError | Já existe uma empresa com este slug | crud.ts |
| ValidationError | "slug" é obrigatório | switch-company.ts |
| NotFoundError | Empresa não encontrada ou inativa | switch-company.ts |
| ForbiddenError | Você não tem acesso a esta empresa. | switch-company.ts |
