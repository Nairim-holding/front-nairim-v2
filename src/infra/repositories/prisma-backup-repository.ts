import prisma from '@/infra/database/prisma';
import type { BackupRepository } from '@/core/repositories/backup-repository';
import type { BackupMeta, BackupPayload } from '@/core/entities/backup';
import { BACKUP_FORMAT_VERSION } from '@/core/entities/backup';
import { buildChecksum } from '@/core/utils/backup-filename';
import { NotFoundError } from '@/core/errors/domain-errors';

/**
 * Implementação Prisma de {@link BackupRepository}.
 * Porte fiel de api-nairim-v2/src/services/BackupService.ts
 * (exportCompany + a transação de restoreCompany).
 *
 * Multi-tenancy: os métodos assumem contexto de tenant aberto (via `withTenant`),
 * mas TODOS os `where`/`data` já carregam `company_id` explícito — o mesmo
 * comportamento do backend. Dentro de `$transaction` o client NÃO é estendido,
 * logo não há injeção automática (as linhas restauradas já trazem `company_id`).
 *
 * FIDELIDADE:
 *  - Export: mesma ordem de chaves em `data` (pais antes de filhos) e `meta`
 *    com `app`, `formatVersion`, `company_*`, `exportedAt`, `checksum`, `counts`.
 *  - Restore: delete em ordem FK-safe (filhos antes de pais) e reinserção em
 *    ordem FK-safe (pais antes de filhos), com `address`/`user` via `upsert`
 *    (tabelas compartilhadas/preservadas) e religação de `Transaction`.
 *    Usuários NÃO são deletados.
 *
 * Camada: infra.
 */

const idsOf = (arr: Array<{ id: string }>): string[] => arr.map((x) => x.id);

export class PrismaBackupRepository implements BackupRepository {
  async getCompanyById(companyId: string): Promise<{ id: string; name: string; slug: string } | null> {
    return prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, slug: true },
    });
  }

  async exportCompany(companyId: string): Promise<BackupPayload> {
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundError('Empresa não encontrada');

    const byCompany = { where: { company_id: companyId } };

    const [
      companyBranding,
      propertyTypes,
      agencies,
      owners,
      tenants,
      properties,
      leases,
      users,
      financialInstitutions,
      categories,
      subcategories,
      cards,
      centers,
      suppliers,
      transactions,
      invoices,
      recurringConfigs,
      plannings,
      documents,
      favorites,
      userColumnPreferences,
      userDashboardLayouts,
    ] = await Promise.all([
      prisma.companyBranding.findMany(byCompany),
      prisma.propertyType.findMany(byCompany),
      prisma.agency.findMany(byCompany),
      prisma.owner.findMany(byCompany),
      prisma.tenant.findMany(byCompany),
      prisma.property.findMany(byCompany),
      prisma.lease.findMany(byCompany),
      prisma.user.findMany(byCompany),
      prisma.financialInstitution.findMany(byCompany),
      prisma.category.findMany(byCompany),
      prisma.subcategory.findMany(byCompany),
      prisma.card.findMany(byCompany),
      prisma.center.findMany(byCompany),
      prisma.supplier.findMany(byCompany),
      prisma.transaction.findMany(byCompany),
      prisma.invoice.findMany(byCompany),
      prisma.recurringConfig.findMany(byCompany),
      prisma.planning.findMany(byCompany),
      prisma.document.findMany(byCompany),
      prisma.favorite.findMany(byCompany),
      prisma.userColumnPreference.findMany(byCompany),
      prisma.userDashboardLayout.findMany(byCompany),
    ]);

    const agencyIds = idsOf(agencies);
    const propertyIds = idsOf(properties);
    const ownerIds = idsOf(owners);
    const tenantIds = idsOf(tenants);
    const supplierIds = idsOf(suppliers);
    const planningIds = idsOf(plannings);

    const [
      agencyAddresses,
      propertyAddresses,
      ownerAddresses,
      tenantAddresses,
      supplierAddresses,
      propertyValues,
      propertyIptus,
      planningMonths,
      contacts,
    ] = await Promise.all([
      prisma.agencyAddress.findMany({ where: { agency_id: { in: agencyIds } } }),
      prisma.propertyAddress.findMany({ where: { property_id: { in: propertyIds } } }),
      prisma.ownerAddress.findMany({ where: { owner_id: { in: ownerIds } } }),
      prisma.tenantAddress.findMany({ where: { tenant_id: { in: tenantIds } } }),
      prisma.supplierAddress.findMany({ where: { supplier_id: { in: supplierIds } } }),
      prisma.propertyValue.findMany({ where: { property_id: { in: propertyIds } } }),
      prisma.propertyIptu.findMany({ where: { property_id: { in: propertyIds } } }),
      prisma.planningMonth.findMany({ where: { planning_id: { in: planningIds } } }),
      prisma.contact.findMany({
        where: {
          OR: [
            { agency_id: { in: agencyIds } },
            { owner_id: { in: ownerIds } },
            { tenant_id: { in: tenantIds } },
            { supplier_id: { in: supplierIds } },
          ],
        },
      }),
    ]);

    const addressIds = Array.from(
      new Set(
        [
          ...agencyAddresses,
          ...propertyAddresses,
          ...ownerAddresses,
          ...tenantAddresses,
          ...supplierAddresses,
        ].map((a) => a.address_id),
      ),
    );
    const addresses = await prisma.address.findMany({ where: { id: { in: addressIds } } });

    // Ordem = pais antes de filhos (importante para o restore).
    const data: Record<string, unknown[]> = {
      addresses,
      company: [company],
      companyBranding,
      propertyTypes,
      agencies,
      owners,
      tenants,
      suppliers,
      properties,
      users,
      financialInstitutions,
      categories,
      subcategories,
      cards,
      centers,
      leases,
      recurringConfigs,
      invoices,
      transactions,
      plannings,
      planningMonths,
      documents,
      favorites,
      userColumnPreferences,
      userDashboardLayouts,
      agencyAddresses,
      propertyAddresses,
      ownerAddresses,
      tenantAddresses,
      supplierAddresses,
      contacts,
      propertyValues,
      propertyIptus,
    };

    const checksum = buildChecksum(data);

    const meta: BackupMeta = {
      app: 'nairim',
      formatVersion: BACKUP_FORMAT_VERSION,
      company_id: companyId,
      company_name: company.name,
      company_slug: company.slug,
      exportedAt: new Date().toISOString(),
      checksum,
      counts: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v.length : v ? 1 : 0]),
      ),
    };

    return { meta, data };
  }

  async restoreCompany(companyId: string, backupData: BackupPayload): Promise<void> {
    const { data } = backupData;

    await prisma.$transaction(async (tx) => {
      // ─── Deleta os dados da empresa em ordem FK-safe (filhos antes de pais) ───
      await tx.agencyAddress.deleteMany({ where: { agency: { company_id: companyId } } });
      await tx.propertyAddress.deleteMany({ where: { property: { company_id: companyId } } });
      await tx.ownerAddress.deleteMany({ where: { owner: { company_id: companyId } } });
      await tx.tenantAddress.deleteMany({ where: { tenant: { company_id: companyId } } });
      await tx.supplierAddress.deleteMany({ where: { supplier: { company_id: companyId } } });
      await tx.contact.deleteMany({
        where: {
          OR: [
            { agency: { company_id: companyId } },
            { owner: { company_id: companyId } },
            { tenant: { company_id: companyId } },
            { supplier: { company_id: companyId } },
          ],
        },
      });
      await tx.propertyValue.deleteMany({ where: { property: { company_id: companyId } } });
      await tx.propertyIptu.deleteMany({ where: { property: { company_id: companyId } } });
      await tx.planningMonth.deleteMany({ where: { planning: { company_id: companyId } } });
      await tx.userColumnPreference.deleteMany({ where: { company_id: companyId } });
      await tx.userDashboardLayout.deleteMany({ where: { company_id: companyId } });
      await tx.document.deleteMany({ where: { company_id: companyId } });
      await tx.favorite.deleteMany({ where: { company_id: companyId } });

      // Transações e faturas
      await tx.transaction.deleteMany({ where: { company_id: companyId } });
      await tx.invoice.deleteMany({ where: { company_id: companyId } });

      // Configurações e planos
      await tx.recurringConfig.deleteMany({ where: { company_id: companyId } });
      await tx.planning.deleteMany({ where: { company_id: companyId } });

      // Locações (depois, porque podem ter documents e transactions vinculadas)
      await tx.lease.deleteMany({ where: { company_id: companyId } });

      // Imóveis (podem ter locações, valores, etc.)
      await tx.property.deleteMany({ where: { company_id: companyId } });

      // Pessoas (inquilinos, proprietários, imobiliárias, fornecedores)
      await tx.tenant.deleteMany({ where: { company_id: companyId } });
      await tx.owner.deleteMany({ where: { company_id: companyId } });
      await tx.agency.deleteMany({ where: { company_id: companyId } });
      await tx.supplier.deleteMany({ where: { company_id: companyId } });

      // NOTA: usuários NÃO são deletados (entidades de acesso, não de negócio).

      // Referências (financeiro, tipos, etc.)
      await tx.card.deleteMany({ where: { company_id: companyId } });
      await tx.center.deleteMany({ where: { company_id: companyId } });
      await tx.subcategory.deleteMany({ where: { company_id: companyId } });
      await tx.category.deleteMany({ where: { company_id: companyId } });
      await tx.financialInstitution.deleteMany({ where: { company_id: companyId } });
      await tx.propertyType.deleteMany({ where: { company_id: companyId } });

      // Marca de negócio
      await tx.companyBranding.deleteMany({ where: { company_id: companyId } });

      // ─── Reinsere os dados em ordem FK-safe (pais antes de filhos) ──────────
      if (Array.isArray(data.companyBranding) && data.companyBranding.length > 0) {
        await tx.companyBranding.createMany({ data: data.companyBranding as any });
      }

      if (Array.isArray(data.propertyTypes) && data.propertyTypes.length > 0) {
        await tx.propertyType.createMany({ data: data.propertyTypes as any });
      }
      if (Array.isArray(data.financialInstitutions) && data.financialInstitutions.length > 0) {
        await tx.financialInstitution.createMany({ data: data.financialInstitutions as any });
      }
      if (Array.isArray(data.categories) && data.categories.length > 0) {
        await tx.category.createMany({ data: data.categories as any });
      }
      if (Array.isArray(data.subcategories) && data.subcategories.length > 0) {
        await tx.subcategory.createMany({ data: data.subcategories as any });
      }
      if (Array.isArray(data.centers) && data.centers.length > 0) {
        await tx.center.createMany({ data: data.centers as any });
      }
      if (Array.isArray(data.cards) && data.cards.length > 0) {
        await tx.card.createMany({ data: data.cards as any });
      }

      // Pais de relacionamentos (endereços são tabela compartilhada → upsert).
      if (Array.isArray(data.addresses) && data.addresses.length > 0) {
        for (const address of data.addresses as any[]) {
          await tx.address.upsert({
            where: { id: address.id },
            update: address,
            create: address,
          });
        }
      }
      if (Array.isArray(data.agencies) && data.agencies.length > 0) {
        await tx.agency.createMany({ data: data.agencies as any });
      }
      if (Array.isArray(data.owners) && data.owners.length > 0) {
        await tx.owner.createMany({ data: data.owners as any });
      }
      if (Array.isArray(data.tenants) && data.tenants.length > 0) {
        await tx.tenant.createMany({ data: data.tenants as any });
      }
      if (Array.isArray(data.suppliers) && data.suppliers.length > 0) {
        await tx.supplier.createMany({ data: data.suppliers as any });
      }
      if (Array.isArray(data.properties) && data.properties.length > 0) {
        await tx.property.createMany({ data: data.properties as any });
      }

      // Filhos
      if (Array.isArray(data.agencyAddresses) && data.agencyAddresses.length > 0) {
        await tx.agencyAddress.createMany({ data: data.agencyAddresses as any });
      }
      if (Array.isArray(data.propertyAddresses) && data.propertyAddresses.length > 0) {
        await tx.propertyAddress.createMany({ data: data.propertyAddresses as any });
      }
      if (Array.isArray(data.ownerAddresses) && data.ownerAddresses.length > 0) {
        await tx.ownerAddress.createMany({ data: data.ownerAddresses as any });
      }
      if (Array.isArray(data.tenantAddresses) && data.tenantAddresses.length > 0) {
        await tx.tenantAddress.createMany({ data: data.tenantAddresses as any });
      }
      if (Array.isArray(data.supplierAddresses) && data.supplierAddresses.length > 0) {
        await tx.supplierAddress.createMany({ data: data.supplierAddresses as any });
      }
      if (Array.isArray(data.contacts) && data.contacts.length > 0) {
        await tx.contact.createMany({ data: data.contacts as any });
      }
      if (Array.isArray(data.propertyValues) && data.propertyValues.length > 0) {
        await tx.propertyValue.createMany({ data: data.propertyValues as any });
      }
      if (Array.isArray(data.propertyIptus) && data.propertyIptus.length > 0) {
        await tx.propertyIptu.createMany({ data: data.propertyIptus as any });
      }

      // Usuários (preservados, apenas recriados se não existem)
      if (Array.isArray(data.users) && data.users.length > 0) {
        for (const user of data.users as any[]) {
          await tx.user.upsert({
            where: { id: user.id },
            update: { ...user, company_id: companyId },
            create: { ...user, company_id: companyId },
          });
        }
      }

      // Negócio (locações, planejamento, transações)
      if (Array.isArray(data.leases) && data.leases.length > 0) {
        await tx.lease.createMany({ data: data.leases as any });
      }
      if (Array.isArray(data.plannings) && data.plannings.length > 0) {
        await tx.planning.createMany({ data: data.plannings as any });
      }
      if (Array.isArray(data.planningMonths) && data.planningMonths.length > 0) {
        await tx.planningMonth.createMany({ data: data.planningMonths as any });
      }
      if (Array.isArray(data.recurringConfigs) && data.recurringConfigs.length > 0) {
        await tx.recurringConfig.createMany({ data: data.recurringConfigs as any });
      }
      // Faturas ANTES das transações: Transaction.invoice_id referencia Invoice.
      if (Array.isArray(data.invoices) && data.invoices.length > 0) {
        await tx.invoice.createMany({ data: data.invoices as any });
      }
      if (Array.isArray(data.transactions) && data.transactions.length > 0) {
        // Transaction tem auto-referência (parent_transaction_id → Transaction).
        const txs = data.transactions as any[];
        const withoutParent = txs.map((t) => ({ ...t, parent_transaction_id: null }));
        await tx.transaction.createMany({ data: withoutParent });

        const children = txs.filter((t) => t.parent_transaction_id);
        for (const child of children) {
          await tx.transaction.update({
            where: { id: child.id },
            data: { parent_transaction_id: child.parent_transaction_id },
          });
        }
      }

      // Documentos e preferências (últimas, relações leves)
      if (Array.isArray(data.documents) && data.documents.length > 0) {
        await tx.document.createMany({ data: data.documents as any });
      }
      if (Array.isArray(data.favorites) && data.favorites.length > 0) {
        await tx.favorite.createMany({ data: data.favorites as any });
      }
      if (Array.isArray(data.userColumnPreferences) && data.userColumnPreferences.length > 0) {
        await tx.userColumnPreference.createMany({ data: data.userColumnPreferences as any });
      }
      if (Array.isArray(data.userDashboardLayouts) && data.userDashboardLayouts.length > 0) {
        await tx.userDashboardLayout.createMany({ data: data.userDashboardLayouts as any });
      }
    });
  }
}