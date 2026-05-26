"use client";

import { Icon } from "@iconify/react";
import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import { propertyService } from "@/services/property-service";
import { useRouter } from "next/navigation";
import { useFilters } from "@/contexts/filter-context";

interface ImovelProps {
  id: string;
  nome: string;
  local: string;
  preco: number;
  quartos: number;
  banheiros: number;
  vagas: number;
  area: number;
  mobilia: boolean;
  status: string;
  imagem?: string;
  cidade: string;
  tipo: string;
  precoCondominio?: number;
  areaTerreno?: number;
  suites?: number;
  anoConstrucao?: number;
  jardim?: boolean;
  piscina?: boolean;
  churrasqueira?: boolean;
  andar?: number;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

function matchesPropertyType(tipo: string, filterType: string): boolean {
  const p = tipo.toLowerCase();
  const f = filterType.toLowerCase();
  if (f === "house" || f === "casa" || f.includes("residential_house")) return p === "casa";
  if (f === "apartment" || f === "apartamento" || f.includes("residential_apartment")) return p === "apartamento";
  if (f.includes("comercial") || f.includes("commercial")) return p.includes("comercial") || p.includes("sala");
  return p.includes(f) || f.includes(p);
}

const formatArea = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

// ── Skeleton card ──────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-surface rounded-2xl overflow-hidden border border-ui-border-soft animate-pulse">
      <div className="h-52 bg-surface-muted" />
      <div className="p-4 space-y-3">
        <div className="h-5 bg-surface-muted rounded-lg w-3/4" />
        <div className="h-4 bg-surface-muted rounded-lg w-1/2" />
        <div className="h-7 bg-surface-muted rounded-lg w-2/5 mt-1" />
        <div className="grid grid-cols-4 gap-2 pt-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 bg-surface-muted rounded-xl" />
          ))}
        </div>
        <div className="h-10 bg-surface-muted rounded-xl mt-1" />
      </div>
    </div>
  );
}

// ── Paginação ──────────────────────────────────────────────────────────────
function Pagination({
  current,
  total,
  onChange,
}: {
  current: number;
  total: number;
  onChange: (p: number) => void;
}) {
  if (total <= 1) return null;

  const pages: (number | "...")[] = [];
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    if (current > 3) pages.push("...");
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
    if (current < total - 2) pages.push("...");
    pages.push(total);
  }

  return (
    <div className="flex items-center justify-center gap-1 mt-10">
      <button
        onClick={() => onChange(current - 1)}
        disabled={current === 1}
        className="w-9 h-9 flex items-center justify-center rounded-xl border border-ui-border text-content-secondary hover:bg-surface-subtle transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Página anterior"
      >
        <Icon icon="mingcute:arrow-left-line" className="w-4 h-4" />
      </button>

      {pages.map((p, idx) =>
        p === "..." ? (
          <span key={`ellipsis-${idx}`} className="w-9 h-9 flex items-center justify-center text-content-muted text-sm">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p as number)}
            className={`w-9 h-9 flex items-center justify-center rounded-xl text-sm font-medium transition-all ${
              current === p
                ? "bg-purple-900 text-white shadow-sm"
                : "border border-ui-border text-content-secondary hover:bg-surface-subtle"
            }`}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onChange(current + 1)}
        disabled={current === total}
        className="w-9 h-9 flex items-center justify-center rounded-xl border border-ui-border text-content-secondary hover:bg-surface-subtle transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Próxima página"
      >
        <Icon icon="mingcute:arrow-right-line" className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Card de imóvel ─────────────────────────────────────────────────────────
function PropertyCard({
  imovel,
  transactionType,
  onVerDetalhes,
}: {
  imovel: ImovelProps;
  transactionType: string;
  onVerDetalhes: (id: string, tipo: string) => void;
}) {
  const isCasa = imovel.tipo === "Casa";
  const isApto = imovel.tipo === "Apartamento";

  const typeIcon = isCasa
    ? "mingcute:home-2-line"
    : isApto
    ? "mingcute:building-2-line"
    : "mingcute:store-line";

  // Badges que aparecem sobre a imagem (limitado a 2 para não poluir)
  const imageBadges: { label: string; color: string }[] = [];
  if (isCasa && imovel.piscina) imageBadges.push({ label: "Piscina", color: "bg-blue-600" });
  if (isCasa && imovel.jardim) imageBadges.push({ label: "Jardim", color: "bg-emerald-600" });
  if (isCasa && imovel.churrasqueira) imageBadges.push({ label: "Churrasqueira", color: "bg-orange-600" });
  if (isApto && imovel.andar) imageBadges.push({ label: `${imovel.andar}º andar`, color: "bg-purple-700" });

  return (
    <div className="group bg-surface rounded-2xl overflow-hidden border border-ui-border-soft hover:border-purple-200 hover:shadow-xl transition-all duration-300 flex flex-col">

      {/* Imagem */}
      <div className="relative h-52 overflow-hidden bg-surface-muted shrink-0">
        {imovel.imagem ? (
          <Image
            src={imovel.imagem}
            alt={imovel.nome}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
            <Icon icon={typeIcon} className="w-14 h-14 text-purple-200" />
          </div>
        )}

        {/* Gradiente */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

        {/* Badges esquerda */}
        {imageBadges.length > 0 && (
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {imageBadges.slice(0, 2).map((b) => (
              <span
                key={b.label}
                className={`${b.color} text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full`}
              >
                {b.label}
              </span>
            ))}
          </div>
        )}

        {/* Tipo — canto direito */}
        <div className="absolute top-3 right-3">
          <span className="bg-black/50 backdrop-blur-sm text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <Icon icon={typeIcon} className="w-3 h-3" />
            {imovel.tipo}
          </span>
        </div>

        {/* Suítes / Ano construção — rodapé da imagem */}
        {(isCasa && imovel.suites && imovel.suites > 0) || (isCasa && imovel.anoConstrucao) ? (
          <div className="absolute bottom-3 left-3 flex gap-1.5">
            {imovel.suites && imovel.suites > 0 && (
              <span className="bg-purple-800/80 backdrop-blur-sm text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
                {imovel.suites} suíte{imovel.suites > 1 ? "s" : ""}
              </span>
            )}
            {imovel.anoConstrucao ? (
              <span className="bg-black/50 backdrop-blur-sm text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
                {imovel.anoConstrucao}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Conteúdo */}
      <div className="p-4 flex flex-col flex-1">

        {/* Nome */}
        <div className="mb-3">
          <h3 className="text-base font-bold text-content line-clamp-1">{imovel.nome}</h3>
        </div>

        {/* Preço */}
        <div className="mb-3">
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-purple-900">{formatCurrency(imovel.preco)}</span>
            {transactionType === "alugar" && (
              <span className="text-xs text-content-muted font-medium">/mês</span>
            )}
          </div>
          {!isCasa && (imovel.precoCondominio ?? 0) > 0 && (
            <p className="text-xs text-content-muted mt-0.5">
              + {formatCurrency(imovel.precoCondominio!)} cond.
            </p>
          )}
          {isCasa && (imovel.areaTerreno ?? 0) > 0 && (
            <p className="text-xs text-content-muted mt-0.5">
              Terreno: {formatArea(imovel.areaTerreno!)} m²
            </p>
          )}
        </div>

        {/* Características — 4 ícones */}
        <div className="grid grid-cols-4 gap-1.5 py-3 border-y border-ui-border-soft mb-3">
          {[
            { icon: "mingcute:bed-line",    value: imovel.quartos,           label: "Quartos" },
            { icon: "mingcute:shower-line", value: imovel.banheiros,         label: "Banhos" },
            { icon: "mingcute:car-line",    value: imovel.vagas,             label: "Vagas" },
            { icon: "mingcute:ruler-line",  value: `${formatArea(imovel.area)} m²`, label: "Área" },
          ].map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-xl bg-surface-subtle flex items-center justify-center">
                <Icon icon={item.icon} className="w-4 h-4 text-purple-700" />
              </div>
              <span className="text-[11px] font-semibold text-content">{item.value}</span>
              <span className="text-[10px] text-content-muted leading-tight text-center">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Tags adicionais */}
        <div className="flex flex-wrap gap-1.5 mb-4 min-h-[22px]">
          {imovel.mobilia && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 text-[11px] font-medium rounded-full">
              <Icon icon="mingcute:sofa-line" className="w-3 h-3" />
              Mobiliado
            </span>
          )}
          {isCasa && imovel.churrasqueira && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 text-[11px] font-medium rounded-full">
              <Icon icon="mingcute:fire-line" className="w-3 h-3" />
              Churrasqueira
            </span>
          )}
          {isCasa && imovel.piscina && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] font-medium rounded-full">
              Piscina
            </span>
          )}
          {isCasa && imovel.jardim && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[11px] font-medium rounded-full">
              Jardim
            </span>
          )}
        </div>

        {/* Botão */}
        <button
          onClick={() => onVerDetalhes(imovel.id, imovel.tipo)}
          disabled={imovel.status !== "AVAILABLE"}
          className="mt-auto w-full py-2.5 rounded-xl bg-purple-900 cursor-pointer hover:bg-purple-900/50 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Icon icon="mingcute:eye-line" className="w-4 h-4" />
          {transactionType === "alugar" ? "Ver detalhes" : "Ver imóvel"}
        </button>
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────
export default function ImoveisList() {
  const { filters, resetFilters } = useFilters();
  const [imoveis, setImoveis] = useState<ImovelProps[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const router = useRouter();

  const itemsPerPage = 8;

  const fetchProperties = useCallback(
    async (page: number = 1) => {
      try {
        setLoading(true);
        setError(null);

        const apiFilters: any = {
          page,
          limit: itemsPerPage,
          status: "AVAILABLE",
          transaction_type: filters.transactionType === "alugar" ? "rent" : "sale",
        };

        if (filters.propertyType && filters.propertyType !== "all")
          apiFilters.property_type = filters.propertyType;
        if (filters.quartos)   apiFilters.bedrooms       = filters.quartos;
        if (filters.banheiros) apiFilters.bathrooms      = filters.banheiros;
        if (filters.vagas)     apiFilters.garage_spaces  = filters.vagas;
        if (filters.garagem)   apiFilters.garage         = filters.garagem;
        if (filters.areaMin)   apiFilters.min_area       = Number(filters.areaMin);
        if (filters.areaMax)   apiFilters.max_area       = Number(filters.areaMax);
        if (filters.valorMin)  apiFilters.min_price      = parseFloat(filters.valorMin.replace(/\./g, "").replace(",", ".")) || 0;
        if (filters.valorMax)  apiFilters.max_price      = parseFloat(filters.valorMax.replace(/\./g, "").replace(",", ".")) || 0;
        const searchTerms = [filters.location, filters.endereco].filter(Boolean).join(" ");
        if (searchTerms)       apiFilters.search         = searchTerms;
        if (filters.uf)        apiFilters.state          = filters.uf;
        if (filters.lavabo)    apiFilters.lavabo         = filters.lavabo;
        if (filters.andares)   apiFilters.floor          = filters.andares;
        if (filters.mobilia)
          apiFilters.furnished = String(filters.mobilia) === "1" || String(filters.mobilia) === "2";

        const response = await propertyService.getAllProperties(apiFilters);

        let propertiesArray: any[] = [];
        let totalCount = 0;
        let totalPagesCount = 1;
        let currentPageCount = page;

        if (Array.isArray(response)) {
          propertiesArray = response;
          totalCount = response.length;
        } else if (response && typeof response === "object") {
          propertiesArray =
            response.data ?? response.properties ?? response.items ?? response.results ?? [];
          totalCount = response.total ?? response.totalCount ?? response.count ?? propertiesArray.length;
          totalPagesCount = response.totalPages ?? response.pages ?? Math.ceil(totalCount / itemsPerPage);
          currentPageCount = response.page ?? response.currentPage ?? page;
        }

        if (propertiesArray.length === 0) {
          setImoveis([]);
          setTotalResults(0);
          setTotalPages(1);
          return;
        }

        const mapped: ImovelProps[] = propertiesArray.map((property: any) => {
          let street = "", number = "", district = "", city = "", state = "";
          if (property.addresses?.[0]?.address) {
            const addr = property.addresses[0].address;
            street   = addr.street    ?? "";
            number   = addr.number?.toString() ?? "";
            district = addr.district  ?? "";
            city     = addr.city      ?? "";
            state    = addr.state     ?? "";
          }

          const local =
            [
              street && number ? `${street}, ${number}` : street,
              district,
              city && state ? `${city} - ${state}` : city || state,
            ]
              .filter(Boolean)
              .join(", ") || "Localização não informada";

          let preco = 0, condoFee = 0, propertyStatus: string | null = null;
          if (property.values?.[0]) {
            const val = property.values[0];
            preco = parseFloat(
              filters.transactionType === "alugar" ? val.rental_value : val.sale_value
            ) || 0;
            condoFee = parseFloat(val.condo_fee) || 0;
            propertyStatus = val.status ?? property.status;
          } else {
            propertyStatus = property.status;
          }

          const rawType = (property.property_type ?? "").toLowerCase();
          let tipo = "Imóvel";
          if (rawType === "house" || rawType === "casa" || rawType === "residential_house")
            tipo = "Casa";
          else if (rawType === "apartment" || rawType === "apartamento" || rawType === "residential_apartment")
            tipo = "Apartamento";
          else if (rawType.includes("commercial"))
            tipo = "Sala Comercial";
          else if (property.type?.description) tipo = property.type.description;
          else if (property.type?.name)        tipo = property.type.name;

          let imagem = "/CasaLocacao.jpeg";
          const imgDoc = property.documents?.find((d: any) => d.type === "IMAGE" && d.file_path);
          if (imgDoc) imagem = imgDoc.file_path;

          const base: ImovelProps = {
            id:     property.id ?? `temp-${Math.random()}`,
            nome:   property.title ?? property.name ?? `${tipo} em ${district || city || "localização"}`,
            local,
            preco,
            quartos:   property.bedrooms   ?? 0,
            banheiros: (property.bathrooms ?? 0) + (property.half_bathrooms ?? 0),
            vagas:     property.garage_spaces ?? 0,
            area:      property.area_built ?? property.area_total ?? 0,
            mobilia:   property.furnished ?? false,
            status:    propertyStatus ? String(propertyStatus).toUpperCase() : "UNKNOWN",
            imagem,
            cidade: city || "Não informada",
            tipo,
            precoCondominio: condoFee,
          };

          if (rawType === "house") {
            return {
              ...base,
              areaTerreno:  property.area_total ?? 0,
              suites:       property.suites     ?? 0,
              anoConstrucao:property.year_built ?? 0,
              jardim:       property.garden     ?? false,
              piscina:      property.pool       ?? false,
              churrasqueira:property.barbecue   ?? false,
            };
          }
          if (rawType === "apartment") {
            return { ...base, andar: property.floor_number ?? 0 };
          }
          return base;
        });

        const available = mapped.filter((p) => {
          if (p.status !== "AVAILABLE") return false;
          if (filters.transactionType === "comprar" && p.preco === 0) return false;
          if (!filters.propertyType || filters.propertyType === "all") return true;
          return matchesPropertyType(p.tipo, filters.propertyType);
        });
        const newTotal  = available.length;
        const newPages  = Math.max(1, Math.ceil(newTotal / itemsPerPage));

        setImoveis(available);
        setTotalPages(newPages);
        setCurrentPage(Math.min(currentPageCount, newPages));
        setTotalResults(newTotal);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao conectar com a API");

        // ── Fallback de exemplo ────────────────────────────────────────
        const exampleData: ImovelProps[] = [
          { id:"c1", nome:"Casa Moderna Alphaville", local:"Alphaville, Barueri", preco:8500, quartos:4, banheiros:5, vagas:3, area:350, areaTerreno:500, suites:2, mobilia:true, status:"AVAILABLE", cidade:"Barueri", tipo:"Casa", jardim:true, piscina:true, churrasqueira:true, anoConstrucao:2020 },
          { id:"c2", nome:"Sobrado Familiar Morumbi", local:"Morumbi, São Paulo", preco:12000, quartos:5, banheiros:6, vagas:4, area:450, areaTerreno:600, suites:3, mobilia:false, status:"AVAILABLE", cidade:"São Paulo", tipo:"Casa", jardim:true, churrasqueira:true, anoConstrucao:2018 },
          { id:"a1", nome:"Apartamento Moderno", local:"Alphaville, Barueri", preco:4500, quartos:3, banheiros:2, vagas:2, area:120, mobilia:true, andar:12, precoCondominio:800, status:"AVAILABLE", cidade:"Barueri", tipo:"Apartamento" },
          { id:"a2", nome:"Apartamento Alto Padrão", local:"Morumbi, São Paulo", preco:6800, quartos:4, banheiros:3, vagas:3, area:180, mobilia:false, andar:8, precoCondominio:1200, status:"AVAILABLE", cidade:"São Paulo", tipo:"Apartamento" },
          { id:"com1", nome:"Sala Comercial Centro", local:"Centro, Barueri", preco:3200, quartos:0, banheiros:1, vagas:2, area:85, mobilia:false, status:"AVAILABLE", cidade:"Barueri", tipo:"Sala Comercial", precoCondominio:450 },
        ];

        let fd = [...exampleData];
        if (filters.transactionType === "comprar") fd = fd.filter((i) => i.preco > 0);
        if (filters.propertyType && filters.propertyType !== "all")
          fd = fd.filter((i) => matchesPropertyType(i.tipo, filters.propertyType));
        if (filters.quartos)   fd = fd.filter((i) => i.quartos   >= Number(filters.quartos));
        if (filters.banheiros) fd = fd.filter((i) => i.banheiros >= Number(filters.banheiros));
        if (filters.vagas)     fd = fd.filter((i) => i.vagas     >= Number(filters.vagas));
        if (filters.valorMin)  fd = fd.filter((i) => i.preco >= (parseFloat(filters.valorMin.replace(/\./g, "").replace(",", ".")) || 0));
        if (filters.valorMax)  fd = fd.filter((i) => i.preco <= (parseFloat(filters.valorMax.replace(/\./g, "").replace(",", ".")) || 0));
        if (filters.areaMin)   fd = fd.filter((i) => i.area >= Number(filters.areaMin));
        if (filters.areaMax)   fd = fd.filter((i) => i.area <= Number(filters.areaMax));
        if (filters.location)  fd = fd.filter((i) =>
          i.local.toLowerCase().includes(filters.location.toLowerCase()) ||
          i.nome.toLowerCase().includes(filters.location.toLowerCase())
        );

        const start = (page - 1) * itemsPerPage;
        setImoveis(fd.slice(start, start + itemsPerPage));
        setTotalPages(Math.max(1, Math.ceil(fd.length / itemsPerPage)));
        setCurrentPage(page);
        setTotalResults(fd.length);
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    setCurrentPage(1);
    fetchProperties(1);
  }, [filters]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
    fetchProperties(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleVerDetalhes = (id: string, tipo: string) => {
    const t = tipo.toLowerCase();
    const path =
      t === "casa" ? "casas" :
      t === "apartamento" ? "apartamentos" :
      t.includes("comercial") ? "comerciais" : "imoveis";
    router.push(`/${path}/${id}?t=${filters.transactionType}`);
  };

  const isAluguel = filters.transactionType === "alugar";

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading && imoveis.length === 0) {
    return (
      <section className="w-full py-10">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="mb-6">
            <div className="h-8 w-64 bg-surface-muted rounded-xl animate-pulse mb-2" />
            <div className="h-4 w-40 bg-surface-muted rounded-lg animate-pulse" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      </section>
    );
  }

  // ── Render principal ─────────────────────────────────────────────────────
  return (
    <section id="imoveis" className="w-full py-10">
      <div className="container mx-auto px-4 max-w-7xl">

        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-7">
          <div>
            <h2 className="text-2xl font-bold text-content">
              {isAluguel ? "Imóveis para Alugar" : "Imóveis à Venda"}
            </h2>
            <p className="text-sm text-content-secondary mt-1">
              {loading ? (
                <span className="inline-block w-32 h-4 bg-surface-muted rounded animate-pulse" />
              ) : (
                <>
                  <span className="font-semibold text-content">{totalResults}</span>{" "}
                  {totalResults === 1 ? "imóvel encontrado" : "imóveis encontrados"}
                  {totalPages > 1 && (
                    <span className="text-content-muted"> · página {currentPage} de {totalPages}</span>
                  )}
                </>
              )}
            </p>
          </div>

          <button
            onClick={() => fetchProperties(currentPage)}
            className="self-start md:self-auto flex items-center gap-2 px-4 py-2 text-sm text-content-secondary border border-ui-border rounded-xl hover:bg-surface-subtle transition-colors"
          >
            <Icon icon="mingcute:refresh-line" className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>

        {/* Aviso de API indisponível */}
        {error && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl mb-6 text-sm">
            <Icon icon="mingcute:warning-line" className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">API temporariamente indisponível.</span> Exibindo dados de exemplo.
            </div>
          </div>
        )}

        {/* Grid */}
        {imoveis.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {imoveis.map((imovel) => (
                <PropertyCard
                  key={imovel.id}
                  imovel={imovel}
                  transactionType={filters.transactionType}
                  onVerDetalhes={handleVerDetalhes}
                />
              ))}
            </div>

            {/* Paginação */}
            <Pagination current={currentPage} total={totalPages} onChange={handlePageChange} />

            <p className="text-center text-xs text-content-muted mt-4">
              Mostrando {imoveis.length} de {totalResults} imóveis
            </p>
          </>
        ) : (
          !loading && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-full bg-surface-subtle flex items-center justify-center mb-5">
                <Icon icon="mingcute:home-2-line" className="w-10 h-10 text-content-muted" />
              </div>
              <h3 className="text-xl font-bold text-content mb-2">Nenhum imóvel encontrado</h3>
              <p className="text-sm text-content-secondary max-w-sm mb-7">
                Não encontramos imóveis com os critérios selecionados. Tente ajustar os filtros.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => resetFilters()}
                  className="px-6 py-2.5 bg-purple-900 hover:bg-purple-800 text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-2"
                >
                  <Icon icon="mingcute:refresh-line" className="w-4 h-4" />
                  Limpar filtros
                </button>
                <button
                  onClick={() => fetchProperties(1)}
                  className="px-6 py-2.5 border border-ui-border text-content-secondary rounded-xl text-sm font-medium hover:bg-surface-subtle transition-colors"
                >
                  Tentar novamente
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </section>
  );
}
