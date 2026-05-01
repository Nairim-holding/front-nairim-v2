"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import Image from "next/image";
import { propertyService } from "@/services/property-service";
import Header from "@/components/layout/AppHeader";
import Footer from "@/components/layout/AppFooter";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const formatArea = (value: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);

function resolveAddress(property: any) {
  const addr =
    property.addresses?.[0]?.address ??
    property.address ??
    null;
  if (!addr) return { street: "", number: "", district: "", city: "", state: "", zip_code: "" };
  return addr;
}

function resolveImages(property: any): string[] {
  const docs: any[] = property.documents ?? [];
  const fromDocs = docs
    .filter((d) => d.type === "IMAGE" && (d.file_path || d.url))
    .map((d) => d.file_path ?? d.url);
  if (fromDocs.length > 0) return fromDocs;
  if (property.images?.length) return property.images;
  if (property.photos?.length) return property.photos;
  return [];
}

function resolveValues(property: any) {
  return property.values?.[0] ?? property.values ?? null;
}

function resolveType(property: any): string {
  const raw = (property.property_type ?? property.type?.name ?? "").toLowerCase();
  if (raw === "house" || raw === "casa" || raw === "residential_house") return "Casa";
  if (raw === "apartment" || raw === "apartamento" || raw === "residential_apartment") return "Apartamento";
  if (raw.includes("commercial")) return "Sala Comercial";
  if (property.type?.description) return property.type.description;
  return "Imóvel";
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-page)]">
      <Header />
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 animate-pulse space-y-6">
        <div className="h-6 w-40 bg-[var(--color-bg-subtle)] rounded-lg" />
        <div className="h-[420px] bg-[var(--color-bg-subtle)] rounded-2xl" />
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <div className="h-8 w-3/4 bg-[var(--color-bg-subtle)] rounded-lg" />
            <div className="h-4 w-1/2 bg-[var(--color-bg-subtle)] rounded" />
            <div className="h-20 bg-[var(--color-bg-subtle)] rounded-xl" />
          </div>
          <div className="h-48 bg-[var(--color-bg-subtle)] rounded-2xl" />
        </div>
      </div>
      <Footer />
    </div>
  );
}

// ─── Feature chip ─────────────────────────────────────────────────────────────

function FeatureItem({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-[var(--color-bg-subtle)] border border-[var(--color-border-soft)]">
      <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
        <Icon icon={icon} className="w-5 h-5 text-purple-700 dark:text-purple-400" />
      </div>
      <span className="text-sm font-bold text-[var(--color-text-primary)]">{value}</span>
      <span className="text-[11px] text-[var(--color-text-muted)] text-center leading-tight">{label}</span>
    </div>
  );
}

// ─── Image gallery ────────────────────────────────────────────────────────────

function Gallery({ images }: { images: string[] }) {
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  const fallback = (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30">
      <Icon icon="mingcute:home-2-line" className="w-20 h-20 text-purple-200" />
    </div>
  );

  return (
    <>
      <div className="rounded-2xl overflow-hidden bg-[var(--color-bg-subtle)] border border-[var(--color-border-soft)]">
        {/* Main image */}
        <div
          className="relative h-[340px] md:h-[480px] cursor-zoom-in"
          onClick={() => images.length > 0 && setLightbox(true)}
        >
          {images.length > 0 ? (
            <Image
              src={images[active]}
              alt="Foto do imóvel"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 900px"
              priority
            />
          ) : fallback}
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setActive((p) => (p - 1 + images.length) % images.length); }}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/70 transition-colors"
              >
                <Icon icon="mingcute:arrow-left-line" className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActive((p) => (p + 1) % images.length); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/70 transition-colors"
              >
                <Icon icon="mingcute:arrow-right-line" className="w-4 h-4" />
              </button>
              <div className="absolute bottom-3 right-3 bg-black/50 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full">
                {active + 1} / {images.length}
              </div>
            </>
          )}
        </div>

        {/* Thumbnails */}
        {images.length > 1 && (
          <div className="flex gap-2 p-3 overflow-x-auto scrollbar-none">
            {images.map((src, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={`relative shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                  i === active ? "border-purple-600 scale-105" : "border-transparent opacity-60 hover:opacity-100"
                }`}
              >
                <Image src={src} alt={`Foto ${i + 1}`} fill className="object-cover" sizes="64px" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightbox(false)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
            onClick={() => setLightbox(false)}
          >
            <Icon icon="mingcute:close-line" className="w-5 h-5" />
          </button>
          <div className="relative w-full max-w-4xl h-[80vh] px-4">
            <Image src={images[active]} alt="Foto ampliada" fill className="object-contain" sizes="100vw" />
          </div>
          {images.length > 1 && (
            <>
              <button
                className="absolute left-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
                onClick={(e) => { e.stopPropagation(); setActive((p) => (p - 1 + images.length) % images.length); }}
              >
                <Icon icon="mingcute:arrow-left-line" className="w-5 h-5" />
              </button>
              <button
                className="absolute right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
                onClick={(e) => { e.stopPropagation(); setActive((p) => (p + 1) % images.length); }}
              >
                <Icon icon="mingcute:arrow-right-line" className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PropertyDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const id = params.id as string;
  const transactionType = searchParams.get("t") === "comprar" ? "comprar" : "alugar";

  const [property, setProperty] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    propertyService
      .getById(id)
      .then((res: any) => {
        // API retorna { success, data } — desempacota se necessário
        setProperty(res?.data ?? res);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <DetailSkeleton />;

  if (error || !property) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-page)] flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20 px-4">
          <Icon icon="mingcute:home-2-line" className="w-16 h-16 text-[var(--color-text-muted)]" />
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Imóvel não encontrado</h2>
          <p className="text-sm text-[var(--color-text-secondary)] text-center max-w-sm">
            {error ?? "Não conseguimos carregar os detalhes deste imóvel."}
          </p>
          <button
            onClick={() => router.back()}
            className="mt-2 px-6 py-2.5 bg-purple-900 hover:bg-purple-800 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            Voltar
          </button>
        </div>
        <Footer />
      </div>
    );
  }

  const addr = resolveAddress(property);
  const images = resolveImages(property);
  const values = resolveValues(property);
  const tipo = resolveType(property);

  const toNum = (v: any) => (typeof v === "number" ? v : parseFloat(v)) || 0;

  const preco = transactionType === "alugar"
    ? toNum(values?.rental_value)
    : toNum(values?.purchase_value);

  const condoFee = toNum(values?.condo_fee);
  const propertyTax = toNum(values?.property_tax);
  const isAvailable = (values?.status ?? property.status ?? "").toUpperCase() === "AVAILABLE";

  const locationParts = [
    addr.street && addr.number ? `${addr.street}, ${addr.number}` : addr.street,
    addr.district,
    addr.city && addr.state ? `${addr.city} - ${addr.state}` : addr.city || addr.state,
  ].filter(Boolean);

  const typeIcon =
    tipo === "Casa" ? "mingcute:home-2-line" :
    tipo === "Apartamento" ? "mingcute:building-2-line" :
    "mingcute:store-line";

  const features = [
    property.bedrooms > 0 && { icon: "mingcute:bed-line", label: "Quartos", value: `${property.bedrooms}+` },
    property.bathrooms > 0 && { icon: "mingcute:shower-line", label: "Banheiros", value: `${property.bathrooms + (property.half_bathrooms ?? 0)}` },
    property.garage_spaces > 0 && { icon: "mingcute:car-line", label: "Vagas", value: `${property.garage_spaces}` },
    property.area_built > 0 && { icon: "mingcute:ruler-line", label: "Área construída", value: `${formatArea(property.area_built)} m²` },
    property.area_total > 0 && property.area_total !== property.area_built && { icon: "mingcute:ruler-line", label: "Área total", value: `${formatArea(property.area_total)} m²` },
    property.suites > 0 && { icon: "mingcute:star-line", label: "Suítes", value: `${property.suites}` },
    property.floor_number > 0 && { icon: "mingcute:building-2-line", label: "Andar", value: `${property.floor_number}º` },
    property.frontage > 0 && { icon: "mingcute:house-line", label: "Testada", value: `${property.frontage}m` },
  ].filter(Boolean) as { icon: string; label: string; value: string }[];

  const extras = [
    property.furnished && { icon: "mingcute:sofa-line", label: "Mobiliado" },
    property.pool && { icon: "mingcute:swimming-line", label: "Piscina" },
    property.garden && { icon: "mingcute:leaf-line", label: "Jardim" },
    property.barbecue && { icon: "mingcute:fire-line", label: "Churrasqueira" },
    property.half_bathrooms > 0 && { icon: "mingcute:droplets-line", label: `${property.half_bathrooms} Lavabo(s)` },
  ].filter(Boolean) as { icon: string; label: string }[];

  return (
    <div className="min-h-screen bg-[var(--color-bg-page)] flex flex-col">
      <Header />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 md:px-8 py-8 md:py-12">

        {/* Breadcrumb / back */}
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 hover:text-purple-700 transition-colors font-medium"
          >
            <Icon icon="mingcute:arrow-left-line" className="w-4 h-4" />
            Voltar
          </button>
          <span>/</span>
          <span className="text-[var(--color-text-secondary)]">{tipo}s</span>
          <span>/</span>
          <span className="text-[var(--color-text-primary)] font-medium line-clamp-1 max-w-[200px]">
            {property.title ?? tipo}
          </span>
        </div>

        <div className="grid md:grid-cols-[1fr_340px] gap-8 lg:gap-12">

          {/* ── Coluna principal ── */}
          <div className="space-y-8">

            {/* Gallery */}
            <Gallery images={images} />

            {/* Título e localização */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
                  <Icon icon={typeIcon} className="w-3.5 h-3.5" />
                  {tipo}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                  isAvailable
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${isAvailable ? "bg-emerald-500" : "bg-gray-400"}`} />
                  {isAvailable ? "Disponível" : "Indisponível"}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] border border-[var(--color-border-soft)]">
                  {transactionType === "alugar" ? "Para alugar" : "À venda"}
                </span>
              </div>

              <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)] leading-tight">
                {property.title ?? `${tipo} em ${addr.city || "localização não informada"}`}
              </h1>

              {locationParts.length > 0 && (
                <div className="flex items-start gap-2 text-[var(--color-text-secondary)]">
                  <Icon icon="mingcute:map-pin-2-line" className="w-4 h-4 shrink-0 mt-0.5 text-purple-600" />
                  <span className="text-sm">{locationParts.join(", ")}</span>
                </div>
              )}
              {addr.zip_code && (
                <p className="text-xs text-[var(--color-text-muted)] pl-6">CEP: {addr.zip_code}</p>
              )}
            </div>

            {/* Características */}
            {features.length > 0 && (
              <div>
                <h2 className="text-base font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
                  <Icon icon="mingcute:list-check-line" className="w-5 h-5 text-purple-600" />
                  Características
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {features.map((f) => (
                    <FeatureItem key={f.label} icon={f.icon} label={f.label} value={f.value} />
                  ))}
                </div>
              </div>
            )}

            {/* Extras / diferenciais */}
            {extras.length > 0 && (
              <div>
                <h2 className="text-base font-bold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
                  <Icon icon="mingcute:star-line" className="w-5 h-5 text-purple-600" />
                  Diferenciais
                </h2>
                <div className="flex flex-wrap gap-2">
                  {extras.map((e) => (
                    <span
                      key={e.label}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-800/30"
                    >
                      <Icon icon={e.icon} className="w-4 h-4" />
                      {e.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Descrição */}
            {(property.description || property.notes) && (
              <div>
                <h2 className="text-base font-bold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
                  <Icon icon="mingcute:file-text-line" className="w-5 h-5 text-purple-600" />
                  Descrição
                </h2>
                <div className="prose prose-sm max-w-none text-[var(--color-text-secondary)] leading-relaxed space-y-2">
                  {(property.description ?? property.notes ?? "").split("\n").map((p: string, i: number) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Informações adicionais */}
            <div>
              <h2 className="text-base font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
                <Icon icon="mingcute:information-line" className="w-5 h-5 text-purple-600" />
                Informações adicionais
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  property.year_built && { label: "Ano de construção", value: property.year_built },
                  addr.city && { label: "Cidade", value: addr.city },
                  condoFee > 0 && { label: "Condomínio", value: formatCurrency(condoFee) + "/mês" },
                  propertyTax > 0 && { label: "IPTU", value: formatCurrency(propertyTax) + "/ano" },
                ].filter(Boolean).map((item: any) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between px-4 py-3 rounded-xl bg-[var(--color-bg-subtle)] border border-[var(--color-border-soft)]"
                  >
                    <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
                      {item.label}
                    </span>
                    <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Sidebar de preço e contato ── */}
          <aside className="space-y-4">
            <div className="sticky top-40">

              {/* Card de preço */}
              <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] shadow-lg overflow-hidden">
                <div className="bg-purple-900 px-6 py-5 text-white">
                  <p className="text-xs font-medium text-purple-300 uppercase tracking-widest mb-1">
                    {transactionType === "alugar" ? "Aluguel mensal" : "Valor de venda"}
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">
                      {preco > 0 ? formatCurrency(preco) : "Sob consulta"}
                    </span>
                    {transactionType === "alugar" && preco > 0 && (
                      <span className="text-sm text-purple-300">/mês</span>
                    )}
                  </div>
                  {condoFee > 0 && (
                    <p className="text-xs text-purple-300 mt-1">
                      + {formatCurrency(condoFee)}/mês condomínio
                    </p>
                  )}
                </div>

                <div className="px-6 py-5 space-y-3">
                  {/* Resumo rápido */}
                  <div className="grid grid-cols-2 gap-2 pb-4 border-b border-[var(--color-border-soft)]">
                    {[
                      property.bedrooms > 0 && { icon: "mingcute:bed-line", value: `${property.bedrooms} quarto${property.bedrooms > 1 ? "s" : ""}` },
                      property.bathrooms > 0 && { icon: "mingcute:shower-line", value: `${property.bathrooms} banho${property.bathrooms > 1 ? "s" : ""}` },
                      property.garage_spaces > 0 && { icon: "mingcute:car-line", value: `${property.garage_spaces} vaga${property.garage_spaces > 1 ? "s" : ""}` },
                      property.frontage > 0 && { icon: "mingcute:house-line", value: `${formatArea(property.frontage)} m` },
                    ].filter(Boolean).map((item: any) => (
                      <div key={item.value} className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                        <Icon icon={item.icon} className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                        {item.value}
                      </div>
                    ))}
                  </div>

                  {/* Botões de contato */}
                  <a
                    href="https://wa.me/5514999999999"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors"
                  >
                    <Icon icon="mingcute:whatsapp-line" className="w-5 h-5" />
                    Falar no WhatsApp
                  </a>

                  <a
                    href="mailto:contato@nairimholding.com.br"
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-[var(--color-border-default)] hover:bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] text-sm font-semibold transition-colors"
                  >
                    <Icon icon="mingcute:mail-line" className="w-5 h-5" />
                    Enviar e-mail
                  </a>
                </div>
              </div>

              {/* Também disponível como... */}
              {values && (
                (() => {
                  const altType = transactionType === "alugar" ? "comprar" : "alugar";
                  const altPrice = altType === "alugar"
                    ? parseFloat(values.rental_value) || 0
                    : parseFloat(values.purchase_value) || 0;
                  if (!altPrice) return null;
                  return (
                    <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] px-5 py-4">
                      <p className="text-xs text-[var(--color-text-muted)] mb-2">
                        Também disponível para {altType === "alugar" ? "aluguel" : "compra"}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-[var(--color-text-primary)]">
                          {formatCurrency(altPrice)}
                          {altType === "alugar" && <span className="text-xs font-normal text-[var(--color-text-muted)]">/mês</span>}
                        </span>
                        <button
                          onClick={() => {
                            const url = new URL(window.location.href);
                            url.searchParams.set("t", altType);
                            window.history.replaceState(null, "", url.toString());
                            window.location.reload();
                          }}
                          className="text-xs text-purple-700 hover:text-purple-700/50 cursor-pointer font-semibold underline underline-offset-2"
                        >
                          Ver {altType === "alugar" ? "aluguel" : "compra"}
                        </button>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
}
