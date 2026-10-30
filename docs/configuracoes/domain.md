# Configurações — Domínio

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
`BACKUP_FORMAT_VERSION`, `BackupMeta`, `BackupPayload`, `AutoBackupInfo`, `RestoreOutcome`, `TRANSFER_OUTFLOW_CATEGORY_NAME`, `TRANSFER_INFLOW_CATEGORY_NAME`, `EnsureTransferCategoriesResult`

## Validação (Zod, `src/shared/validators`)
- logSelectionSchema: mode, days?, from?, to?, action?, user_email?, table_name? — log-management.ts

## Regras de negócio
- Backup completo contém hashes de senha e controle de acesso: exportar, baixar e restaurar exigem `SUPER_ADMIN`. Upload de restauração até 50 MB.
- **Transferência JSON**: ver [transferencia-de-tabelas.md](transferencia-de-tabelas.md). Registro de tabelas em `shared/data/table-transfer.ts`; metadados gerados por `npm run generate:table-models`.
- **Exclusão de dados**: só administradores com permissão de exclusão em Configurações e em cada recurso; seleção múltipla ou todos os grupos, prévia da quantidade e confirmação exata `CONFIRMAR`; empresa da sessão comparada com a da revisão; serializável, em ordem de dependência, com reversão integral. Preserva empresa, identidade visual, usuários, grupos, preferências e auditoria; arquivos físicos permanecem no armazenamento. Grupos em `shared/data/company-data-deletion.ts`.
- **Logs**: expurgo por idade, intervalo, ação, autor e recurso, limitado à empresa; exige `audit-logs/delete`, confirmação `EXCLUIR LOGS` válida por 10 minutos e recusa expurgar se houver registros pendentes na fila. Exportação JSON exige `audit-logs/export`. Ver `docs/auditoria/logs/`.
- Nenhuma ação destrutiva roda em ambientes publicados sem pedido explícito; as telas mostram prévia antes de confirmar.

## Erros lançados nos use-cases
| Classe | Mensagem | Arquivo |
|---|---|---|
| NotFoundError | Empresa não encontrada | crud.ts |
| ValidationError | Confirmação inválida. Digite exatamente "${company.name}" ou "${company.slug}" para prosseguir. | crud.ts |
| ValidationError | Arquivo de backup inválido (estrutura esperada: meta + data) | crud.ts |
| ValidationError | Versão do backup incompatível. Esperado: v${BACKUP_FORMAT_VERSION}, recebido: v${backupData.meta.formatVersion | crud.ts |
| ValidationError | Backup não corresponde a esta empresa. ID no arquivo: ${backupData.meta.company_id}, ID atual: ${companyId} | crud.ts |
| ValidationError | Checksum do backup não corresponde. Arquivo pode estar corrompido. | crud.ts |
