import prisma from '@/infra/database/prisma';
import type { DashboardRepository } from '@/core/repositories/dashboard-repository';
import type { ChartData, ClientsMetrics, FinancialMetrics, GeolocationResponse, PortfolioMetrics } from '@/core/entities/dashboard';
import {
  calcVariation,
  calculateVacancyMonths,
  decimalToNumber,
  getPeriodDatesIn,
} from '@/core/utils/dashboard-metrics';

/**
 * Implementação Prisma de {@link DashboardRepository}.
 * Porte fiel de api-nairim-v2/src/services/DashboardService.ts.
 *
 * Tenant: Property, PropertyType, Document, Agency, Owner, Tenant e Lease estão
 * em TENANT_MODELS — a extensão injeta `company_id` nas leituras. As métricas
 * são agregadas pelo mesmo filtro de `created_at` no período (corrente vs.
 * anterior) que o backend.
 *
 * FIDELIDADE (incluindo peculiaridades do backend):
 *  - `calcVariation` limita a variação a ±100% e arredonda `result`/`variation`
 *    para 2 casas; `isPositive` = variação >= 0 (ou `current >= 0` quando não
 *    há base anterior).
 *  - `countPropertiesWithLessThan3Docs` na verdade conta "propriedades com
 *    documentos", usando REQUIRED_DOCUMENT_TYPES (TITLE_DEED, REGISTRATION,
 *    PROPERTY_RECORD) — uma propriedade é "completa" se tiver AO MENOS UM dos
 *    três (bug do backend preservado fielmente).
 *  - `calculateVacancyMonths`: sem leases → 12; último lease com `end_date >=
 *    data de referência` → 0; senão diferença em meses completos.
 *  - `ownersTotal.propertiesPerOwner` estima o período anterior proporcional
 *    ao número de proprietários (prevOwnersCount * média atual).
 *  - `availablePropertiesByType`/`propertiesByAgency` usam agrupamento por
 *    nome com lista de detalhes no `data`.
 *
 * Camada: infra.
 */

const REQUIRED_DOCUMENT_TYPES = ['TITLE_DEED', 'REGISTRATION', 'PROPERTY_RECORD'];

export { calcVariation, calculateVacancyMonths, decimalToNumber, getPeriodDatesIn };

export class PrismaDashboardRepository implements DashboardRepository {
  async getFinancial(startDate: Date, endDate: Date): Promise<FinancialMetrics> {
    const period = getPeriodDatesIn(startDate, endDate);
    const toNum = decimalToNumber;

    const [properties, prevProperties] = await Promise.all([
      prisma.property.findMany({
        where: {
          created_at: { gte: period.current.start, lte: period.current.end },
          deleted_at: null,
        },
        include: {
          type: true,
          values: { where: { deleted_at: null }, orderBy: { created_at: 'desc' }, take: 1 },
          agency: true,
          owner: true,
          leases: {
            where: { deleted_at: null },
            include: { tenant: true },
            orderBy: { end_date: 'desc' },
            take: 1,
          },
        },
      }),
      prisma.property.findMany({
        where: {
          created_at: { gte: period.previous.start, lte: period.previous.end },
          deleted_at: null,
        },
        include: {
          values: { where: { deleted_at: null }, orderBy: { created_at: 'desc' }, take: 1 },
          leases: {
            where: { deleted_at: null },
            orderBy: { end_date: 'desc' },
            take: 1,
          },
        },
      }),
    ]);

    const avgRentalData = properties
      .filter((p) => toNum(p.values[0]?.rental_value) > 0)
      .map((p) => ({
        id: p.id,
        title: p.title,
        rentalValue: toNum(p.values[0]?.rental_value),
        type: p.type?.description,
        areaTotal: p.area_total,
        valuePerSqm:
          p.area_total > 0 && p.values[0]?.rental_value != null
            ? Number((toNum(p.values[0]?.rental_value) / p.area_total).toFixed(2))
            : 0,
        owner: p.owner?.name,
      }));
    const prevAvgValue =
      prevProperties.length > 0
        ? prevProperties.reduce((acc, p) => acc + toNum(p.values[0]?.rental_value), 0) /
          prevProperties.length
        : 0;

    const activeRentalData = properties
      .filter((p) => toNum(p.values[0]?.rental_value) > 0 && p.values[0]?.status === 'AVAILABLE')
      .map((p) => ({
        id: p.id,
        title: p.title,
        rentalValue: toNum(p.values[0]?.rental_value),
        status: p.values[0]?.status,
        type: p.type?.description,
        agency: p.agency ? { tradeName: p.agency.trade_name } : null,
        leaseInfo: p.leases[0]
          ? { contractNumber: p.leases[0].contract_number, tenantName: p.leases[0].tenant?.name }
          : null,
      }));
    const prevTotalRent = prevProperties.reduce(
      (acc, p) => acc + (p.values[0]?.status === 'AVAILABLE' ? toNum(p.values[0]?.rental_value) : 0),
      0,
    );

    const taxFeeData = properties
      .filter((p) => toNum(p.values[0]?.property_tax) > 0 || toNum(p.values[0]?.condo_fee) > 0)
      .map((p) => {
        const total = toNum(p.values[0]?.property_tax) + toNum(p.values[0]?.condo_fee);
        const rent = toNum(p.values[0]?.rental_value);
        return {
          id: p.id,
          title: p.title,
          type: p.type?.description,
          propertyTax: toNum(p.values[0]?.property_tax),
          condoFee: toNum(p.values[0]?.condo_fee),
          totalTaxAndCondo: total,
          rentalValue: rent,
          costToRentRatio: rent > 0 ? Number(((total / rent) * 100).toFixed(2)) : 0,
          impactOnRevenue: rent > 0 ? Number(((total / rent) * 100).toFixed(2)) : 0,
        };
      });
    const prevTotalTax = prevProperties.reduce(
      (acc, p) => acc + toNum(p.values[0]?.property_tax) + toNum(p.values[0]?.condo_fee),
      0,
    );

    const acquisitionData = properties
      .filter((p) => toNum(p.values[0]?.purchase_value) > 0)
      .map((p) => {
        const purchase = toNum(p.values[0]?.purchase_value);
        const annualRent = toNum(p.values[0]?.rental_value) * 12;
        return {
          id: p.id,
          title: p.title,
          type: p.type?.description,
          purchaseValue: purchase,
          currentStatus: p.values[0]?.status,
          acquisitionDate: p.values[0]?.created_at,
          saleValue: toNum(p.values[0]?.sale_value),
          estimatedAnnualROI: purchase > 0 ? Number(((annualRent / purchase) * 100).toFixed(2)) : 0,
        };
      });
    const prevTotalAcq = prevProperties.reduce((acc, p) => acc + toNum(p.values[0]?.purchase_value), 0);

    const finVacancyData = properties
      .filter((p) => p.values[0]?.status === 'AVAILABLE')
      .map((p) => ({
        id: p.id,
        title: p.title,
        rentalValue: toNum(p.values[0]?.rental_value),
        monthsVacant: calculateVacancyMonths(p.leases, endDate),
        estimatedLoss: toNum(p.values[0]?.rental_value) * calculateVacancyMonths(p.leases, endDate),
      }));
    const currentFinVacRate =
      properties.length > 0 ? (finVacancyData.length / properties.length) * 100 : 0;
    const prevFinVacRate =
      prevProperties.length > 0
        ? (prevProperties.filter((p) => p.values[0]?.status === 'AVAILABLE').length /
            prevProperties.length) *
          100
        : 0;

    const vacMonthsData = properties
      .filter((p) => p.values[0]?.status === 'AVAILABLE')
      .map((p) => ({
        id: p.id,
        title: p.title,
        vacancyMonths: calculateVacancyMonths(p.leases, endDate),
        estimatedLoss: toNum(p.values[0]?.rental_value) * calculateVacancyMonths(p.leases, endDate),
      }));
    const currentTotalVacMonths = vacMonthsData.reduce((acc, p) => acc + p.vacancyMonths, 0);
    const prevTotalVacMonths = prevProperties.reduce(
      (acc, p) => acc + calculateVacancyMonths(p.leases, period.previous.end),
      0,
    );

    return {
      averageRentalTicket: calcVariation(
        avgRentalData.length > 0
          ? avgRentalData.reduce((acc, p) => acc + p.rentalValue, 0) / avgRentalData.length
          : 0,
        prevAvgValue,
        avgRentalData,
      ),
      totalRentalActive: calcVariation(
        activeRentalData.reduce((acc, p) => acc + p.rentalValue, 0),
        prevTotalRent,
        activeRentalData,
      ),
      totalAcquisitionValue: calcVariation(
        acquisitionData.reduce((acc, p) => acc + p.purchaseValue, 0),
        prevTotalAcq,
        acquisitionData,
      ),
      financialVacancyRate: calcVariation(currentFinVacRate, prevFinVacRate, finVacancyData),
      totalPropertyTaxAndCondoFee: calcVariation(
        taxFeeData.reduce((acc, p) => acc + p.totalTaxAndCondo, 0),
        prevTotalTax,
        taxFeeData,
      ),
      vacancyInMonths: calcVariation(currentTotalVacMonths, prevTotalVacMonths, vacMonthsData),
    };
  }

  async getPortfolio(startDate: Date, endDate: Date): Promise<PortfolioMetrics> {
    const period = getPeriodDatesIn(startDate, endDate);
    const toNum = decimalToNumber;

    const [properties, prevProperties] = await Promise.all([
      prisma.property.findMany({
        where: {
          created_at: { gte: period.current.start, lte: period.current.end },
          deleted_at: null,
        },
        include: {
          type: true,
          values: { where: { deleted_at: null }, orderBy: { created_at: 'desc' }, take: 1 },
          documents: { where: { deleted_at: null } },
          agency: true,
          leases: {
            where: { deleted_at: null },
            orderBy: { end_date: 'desc' },
            take: 1,
          },
        },
      }),
      prisma.property.findMany({
        where: {
          created_at: { gte: period.previous.start, lte: period.previous.end },
          deleted_at: null,
        },
        include: {
          values: { where: { deleted_at: null }, orderBy: { created_at: 'desc' }, take: 1 },
          documents: { where: { deleted_at: null } },
          leases: {
            where: { deleted_at: null },
            orderBy: { end_date: 'desc' },
            take: 1,
          },
        },
      }),
    ]);

    const allDetails = properties.map((p) => ({
      id: p.id,
      title: p.title,
      type: p.type?.description,
      status: p.values[0]?.status,
      rentalValue: toNum(p.values[0]?.rental_value),
      areaTotal: p.area_total,
      documentCount: p.documents.length,
      agency: p.agency ? { tradeName: p.agency.trade_name } : null,
    }));

    const pendingDocs = properties
      .map((p) => {
        const present = p.documents.map((d) => d.type);
        const missing = REQUIRED_DOCUMENT_TYPES.filter((t) => !present.includes(t as never));
        const isComplete = REQUIRED_DOCUMENT_TYPES.some((t) => present.includes(t as never));
        return {
          id: p.id,
          title: p.title,
          documentCount: p.documents.length,
          type: p.type?.description,
          missingDocuments: missing,
          isComplete,
        };
      })
      .filter((p) => !p.isComplete);

    const prevPendingCount = prevProperties.filter((p) => {
      const present = p.documents.map((d) => d.type);
      return !REQUIRED_DOCUMENT_TYPES.some((t) => present.includes(t as never));
    }).length;

    const saleValueData = properties
      .filter((p) => toNum(p.values[0]?.sale_value) > 0)
      .map((p) => ({
        id: p.id,
        title: p.title,
        saleValue: toNum(p.values[0]?.sale_value),
        type: p.type?.description,
        rentalValue: toNum(p.values[0]?.rental_value),
      }));

    const available = properties
      .filter((p) => p.values[0]?.status === 'AVAILABLE')
      .map((p) => ({
        id: p.id,
        title: p.title,
        type: p.type?.description,
        rentalValue: toNum(p.values[0]?.rental_value),
        areaTotal: p.area_total,
        monthsVacant: calculateVacancyMonths(p.leases, endDate),
      }));
    const occupied = properties
      .filter((p) => p.values[0]?.status !== 'AVAILABLE')
      .map((p) => ({
        id: p.id,
        title: p.title,
        type: p.type?.description,
        rentalValue: toNum(p.values[0]?.rental_value),
        status: p.values[0]?.status,
      }));

    const currentVacRate = properties.length > 0 ? (available.length / properties.length) * 100 : 0;
    const prevVacRate =
      prevProperties.length > 0
        ? (prevProperties.filter((p) => p.values[0]?.status === 'AVAILABLE').length /
            prevProperties.length) *
          100
        : 0;

    const currentOccRate = properties.length > 0 ? (occupied.length / properties.length) * 100 : 0;
    const prevOccRate =
      prevProperties.length > 0
        ? (prevProperties.filter((p) => p.values[0]?.status !== 'AVAILABLE').length /
            prevProperties.length) *
          100
        : 0;

    const currentPhysVac = properties.reduce(
      (acc, p) => acc + calculateVacancyMonths(p.leases, endDate),
      0,
    );
    const prevPhysVac = prevProperties.reduce(
      (acc, p) => acc + calculateVacancyMonths(p.leases, period.previous.end),
      0,
    );

    const availablePropertiesByType: ChartData[] = Object.entries(
      properties.reduce(
        (acc: Record<string, number>, p) => {
          const type = p.type?.description || 'Outros';
          if (p.values[0]?.status === 'AVAILABLE') acc[type] = (acc[type] || 0) + 1;
          return acc;
        },
        {},
      ),
    ).map(([name, value]) => ({
      name,
      value,
      data: available.filter((p) => p.type === name),
    }));

    return {
      totalPropertys: calcVariation(properties.length, prevProperties.length, allDetails),
      countPropertiesWithLessThan3Docs: calcVariation(
        pendingDocs.length,
        prevPendingCount,
        pendingDocs,
      ),
      totalPropertiesWithSaleValue: calcVariation(
        saleValueData.length,
        prevProperties.filter((p) => toNum(p.values[0]?.sale_value) > 0).length,
        saleValueData,
      ),
      availablePropertiesByType,
      vacancyRate: calcVariation(currentVacRate, prevVacRate, available),
      occupationRate: calcVariation(currentOccRate, prevOccRate, occupied),
      physicalVacancy: calcVariation(
        currentPhysVac,
        prevPhysVac,
        properties.map((p) => ({
          id: p.id,
          title: p.title,
          vacancyMonths: calculateVacancyMonths(p.leases, endDate),
        })),
      ),
    };
  }

  async getClients(startDate: Date, endDate: Date): Promise<ClientsMetrics> {
    const period = getPeriodDatesIn(startDate, endDate);
    const toNum = decimalToNumber;

    const [owners, prevOwnersCount, tenants, prevTenantsCount, agencies, prevAgenciesCount] =
      await Promise.all([
        prisma.owner.findMany({
          where: {
            created_at: { gte: period.current.start, lte: period.current.end },
            deleted_at: null,
          },
          include: {
            properties: {
              where: { deleted_at: null },
              include: {
                type: true,
                values: { where: { deleted_at: null }, orderBy: { created_at: 'desc' }, take: 1 },
              },
            },
          },
        }),
        prisma.owner.count({
          where: {
            created_at: { gte: period.previous.start, lte: period.previous.end },
            deleted_at: null,
          },
        }),

        prisma.tenant.findMany({
          where: {
            created_at: { gte: period.current.start, lte: period.current.end },
            deleted_at: null,
          },
          include: {
            leases: {
              where: { deleted_at: null },
              include: {
                property: {
                  include: {
                    type: true,
                    values: { where: { deleted_at: null }, orderBy: { created_at: 'desc' }, take: 1 },
                  },
                },
              },
            },
          },
        }),
        prisma.tenant.count({
          where: {
            created_at: { gte: period.previous.start, lte: period.previous.end },
            deleted_at: null,
          },
        }),

        prisma.agency.findMany({
          where: {
            created_at: { gte: period.current.start, lte: period.current.end },
            deleted_at: null,
          },
          include: {
            properties: {
              where: { deleted_at: null },
              include: {
                type: true,
                values: { where: { deleted_at: null }, orderBy: { created_at: 'desc' }, take: 1 },
              },
            },
          },
        }),
        prisma.agency.count({
          where: {
            created_at: { gte: period.previous.start, lte: period.previous.end },
            deleted_at: null,
          },
        }),
      ]);

    const ownersDetails = owners.map((o) => ({
      id: o.id,
      name: o.name,
      createdAt: o.created_at,
      propertiesCount: o.properties.length,
      properties: o.properties.map((p) => ({
        id: p.id,
        title: p.title,
        type: p.type?.description,
        status: p.values[0]?.status,
        rentalValue: toNum(p.values[0]?.rental_value),
        saleValue: toNum(p.values[0]?.sale_value),
      })),
    }));

    const tenantsDetails = tenants.map((t) => ({
      id: t.id,
      name: t.name,
      createdAt: t.created_at,
      properties: t.leases.map((l) => ({
        id: l.property.id,
        title: l.property.title,
        type: l.property.type?.description,
        contractNumber: l.contract_number,
        rentalValue: toNum(l.rent_amount),
      })),
    }));

    const agenciesDetails = agencies.map((a) => ({
      id: a.id,
      legalName: a.legal_name,
      tradeName: a.trade_name,
      createdAt: a.created_at,
      propertiesCount: a.properties.length,
    }));

    const totalProperties = owners.reduce((acc, o) => acc + o.properties.length, 0);
    const propertiesPerOwnerVal = owners.length > 0 ? totalProperties / owners.length : 0;

    const prevTotalPropertiesEstimate = prevOwnersCount * propertiesPerOwnerVal;
    const prevPropertiesPerOwnerVal =
      prevOwnersCount > 0 ? prevTotalPropertiesEstimate / prevOwnersCount : 0;

    return {
      ownersTotal: calcVariation(owners.length, prevOwnersCount, ownersDetails),

      tenantsTotal: calcVariation(tenants.length, prevTenantsCount, tenantsDetails),

      propertiesPerOwner: calcVariation(
        propertiesPerOwnerVal,
        prevPropertiesPerOwnerVal,
        ownersDetails,
      ),

      agenciesTotal: calcVariation(agencies.length, prevAgenciesCount, agenciesDetails),

      propertiesByAgency: agencies.map((a) => ({
        name: a.trade_name || a.legal_name,
        value: a.properties.length,
        data: a.properties.map((p) => ({
          id: p.id,
          title: p.title,
          type: p.type?.description,
          status: p.values[0]?.status,
          rentalValue: toNum(p.values[0]?.rental_value),
          areaTotal: p.area_total,
          agency: {
            id: a.id,
            tradeName: a.trade_name,
            legalName: a.legal_name,
          },
        })),
      })),
    };
  }

  async getGeolocation(startDate: Date, endDate: Date): Promise<GeolocationResponse> {
    const properties = await prisma.property.findMany({
      where: { deleted_at: null },
      include: {
        addresses: { where: { deleted_at: null }, include: { address: true } },
        values: { where: { deleted_at: null }, orderBy: { created_at: 'desc' }, take: 1 },
        leases: {
          where: {
            deleted_at: null,
            status: { not: 'CANCELED' },
            start_date: { lte: endDate },
            end_date: { gte: startDate },
          },
          take: 1,
        },
      },
    });

    const coordinates = properties
      .flatMap((p) => {
        const isLeased = p.leases.length > 0 || p.values[0]?.status === 'OCCUPIED';
        const statusLabel = isLeased ? 'Locado' : 'Disponível';

        return p.addresses.map((a) => {
          const lat = a.address.latitude;
          const lng = a.address.longitude;

          if (lat != null && lng != null) {
            return {
              lat,
              lng,
              info: `${p.title} (${statusLabel}) - ${a.address.city}/${a.address.state}`,
              isLeased,
              status: (isLeased ? 'OCCUPIED' : 'AVAILABLE') as 'OCCUPIED' | 'AVAILABLE',
            };
          }
          return null;
        });
      })
      .filter((coord): coord is { lat: number; lng: number; info: string; isLeased: boolean; status: 'OCCUPIED' | 'AVAILABLE' } => coord !== null);

    return { coordinates };
  }

  /** Cálculo de meses vagos a partir do último lease do imóvel. Fiel ao backend. */
  private calculateVacancyMonths(
    leases: { end_date: Date }[] | undefined | null,
    referenceDate: Date,
  ): number {
    return calculateVacancyMonths(leases, referenceDate);
  }
}

