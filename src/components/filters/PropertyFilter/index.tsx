"use client";

import { useState, useEffect, useRef } from "react";
import { Icon } from "@iconify/react";
import { useFilters } from "@/contexts/filter-context";

// ─── Type icon helper ─────────────────────────────────────────────────────────

function getLabelFromRaw(raw: string, property: any): string {
  if (raw === "house" || raw === "casa" || raw.includes("residential_house")) return "Casa";
  if (raw.includes("apart") || raw === "flat") return "Apartamento";
  if (raw.includes("commercial") || raw.includes("comercial") || raw.includes("sala")) return "Sala Comercial";
  if (raw.includes("terreno") || raw.includes("land") || raw.includes("lote")) return "Terreno";
  if (raw.includes("rural") || raw.includes("sitio") || raw.includes("chacara")) return "Rural";
  // Fallback: usa o nome do tipo no objeto ou capitaliza o raw
  return property.type?.description || property.type?.name ||
    raw.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
}

function typeIcon(name: string = ""): string {
  const n = name.toLowerCase();
  if (n.includes("house") || n.includes("casa") || n.includes("residential")) return "mingcute:home-2-line";
  if (n.includes("apart") || n.includes("flat")) return "mingcute:building-2-line";
  if (n.includes("comercial") || n.includes("commercial") || n.includes("sala") || n.includes("office")) return "mingcute:store-line";
  if (n.includes("terreno") || n.includes("land") || n.includes("lote")) return "mingcute:landscape-line";
  if (n.includes("rural") || n.includes("farm") || n.includes("sitio") || n.includes("chacara")) return "mingcute:leaf-line";
  if (n.includes("galpao") || n.includes("warehouse") || n.includes("industrial")) return "mingcute:warehouse-line";
  return "mingcute:building-3-line";
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PropertyTypeOption {
  value: string;
  label: string;
  icon: string;
}

const TYPE_ALL: PropertyTypeOption = { value: "all", label: "Todos", icon: "mingcute:grid-2-line" };

// ─── Component ────────────────────────────────────────────────────────────────

export default function PropertyFilter() {
  const {
    filters,
    setFilters,
    activeFiltersCount,
    resetFilters: contextResetFilters,
    isFilterOpen,
    setIsFilterOpen,
  } = useFilters();

  const modalRef = useRef<HTMLDivElement>(null);
  const [propertyTypes, setPropertyTypes] = useState<PropertyTypeOption[]>([]);
  const [typeSearch, setTypeSearch] = useState("");

  // Busca todos os tipos cadastrados no endpoint /property-types
  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_URL_API;
    if (!API_URL) return;

    fetch(`${API_URL}/property-types`)
      .then((r) => r.json())
      .then((res) => {
        const list: any[] = Array.isArray(res) ? res : (res?.data ?? res?.items ?? []);
        if (list.length === 0) throw new Error("empty");
        const types: PropertyTypeOption[] = list.map((t) => {
          const raw = (t.name ?? t.id ?? "").toLowerCase().trim();
          return {
            value: raw,
            label: t.description || getLabelFromRaw(raw, t),
            icon: typeIcon(raw),
          };
        });
        setPropertyTypes(types);
      })
      .catch(() => {
        // Fallback: deriva dos imóveis disponíveis
        fetch(`${process.env.NEXT_PUBLIC_URL_API}/properties?limit=100&status=AVAILABLE`)
          .then((r) => r.json())
          .then((res) => {
            const list: any[] = res?.data ?? (Array.isArray(res) ? res : []);
            const seen = new Set<string>();
            const types: PropertyTypeOption[] = [];
            list.forEach((p) => {
              const raw = (p.property_type ?? "").toLowerCase().trim();
              if (!raw || seen.has(raw)) return;
              seen.add(raw);
              types.push({ value: raw, label: getLabelFromRaw(raw, p), icon: typeIcon(raw) });
            });
            if (types.length > 0) setPropertyTypes(types);
          })
          .catch(() => setPropertyTypes([
            { value: "house",     label: "Casa",          icon: "mingcute:home-2-line"     },
            { value: "apartment", label: "Apartamento",   icon: "mingcute:building-2-line" },
          ]));
      });
  }, []);

  // Fecha modal com ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFilterOpen) setIsFilterOpen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isFilterOpen, setIsFilterOpen]);

  // Trava scroll do body quando modal aberto
  useEffect(() => {
    document.body.style.overflow = isFilterOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isFilterOpen]);

  // Tipo atualmente selecionado (para exibir na barra)
  const selectedType =
    filters.propertyType !== "all"
      ? propertyTypes.find((t) => t.value === filters.propertyType)
      : null;

  // ─── Tipos filtrados no modal ─────────────────────────────────────────────

  const filteredTypes = propertyTypes.filter((t) =>
    t.label.toLowerCase().includes(typeSearch.toLowerCase())
  );

  // ─── Handlers ────────────────────────────────────────────────────────────

  const formatCurrencyInput = (value: string): string => {
    const digits = value.replace(/\D/g, "");
    if (!digits) return "";
    const num = parseInt(digits, 10) / 100;
    return new Intl.NumberFormat("pt-BR", {
      style: "decimal",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const handleCurrencyChange = (field: "valorMin" | "valorMax", raw: string) => {
    setFilters({ ...filters, [field]: formatCurrencyInput(raw) });
  };

  const handleFilterChange = (field: keyof typeof filters, value: any) => {
    setFilters({ ...filters, [field]: value });
  };

  const handleSearch = () => {
    window.dispatchEvent(new CustomEvent("filtersApplied", { detail: filters }));
  };

  const aplicarFiltros = () => {
    handleSearch();
    setIsFilterOpen(false);
  };

  const estadosBrasileiros = [
    "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA",
    "MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN",
    "RS","RO","RR","SC","SP","SE","TO",
  ];

  // ─── SelectInput ──────────────────────────────────────────────────────────

  const SelectInput = ({
    label, value, onChange, options = [1, 2, 3, 4, 5, 6, 7, 8],
  }: {
    label: string;
    value: number | "";
    onChange: (v: number | "") => void;
    options?: number[];
  }) => (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-content-secondary">{label}</label>
      <select
        value={value === "" ? "" : String(value)}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        className="w-full px-3 py-2.5 text-sm border border-ui-border text-content rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-purple-400 outline-none bg-surface"
      >
        <option value="">Qualquer</option>
        {options.map((n) => (
          <option key={n} value={n}>{n}+</option>
        ))}
      </select>
    </div>
  );

  // ─── Pill de tipo ─────────────────────────────────────────────────────────

  const TypePill = ({ opt }: { opt: PropertyTypeOption }) => (
    <button
      type="button"
      onClick={() => handleFilterChange("propertyType", opt.value)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
        filters.propertyType === opt.value
          ? "bg-purple-100 text-purple-800 ring-1 ring-purple-300"
          : "text-content-secondary hover:bg-surface-subtle"
      }`}
    >
      <Icon icon={opt.icon} className="w-3.5 h-3.5" />
      {opt.label}
    </button>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Barra de pesquisa principal ────────────────────────────────────── */}
      <section className="relative z-20 w-full px-4 md:px-8 -mt-8 md:-mt-16 pb-6">
        <div className="max-w-5xl mx-auto">
          <div className="bg-surface rounded-2xl shadow-2xl border border-ui-border-soft overflow-hidden">

            {/* Linha 1 — Toggle transação + Pills de tipo */}
            <div className="flex items-stretch border-b border-ui-border-soft">
              {/* Comprar / Alugar */}
              <div className="flex shrink-0">
                {(["alugar", "comprar"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleFilterChange("transactionType", t)}
                    className={`px-5 py-3 text-sm font-semibold flex items-center gap-2 transition-all duration-200 ${
                      filters.transactionType === t
                        ? "bg-purple-900 text-white"
                        : "text-content-secondary hover:bg-surface-subtle"
                    }`}
                  >
                    <Icon
                      icon={t === "comprar" ? "mingcute:shopping-bag-2-line" : "mingcute:key-2-line"}
                      className="w-4 h-4"
                    />
                    <span className="capitalize">{t}</span>
                  </button>
                ))}
              </div>

              <div className="w-px bg-ui-border-soft self-stretch" />

              {/* Pills de tipo — Todos + selecionado */}
              <div className="flex items-center gap-1 px-3 overflow-x-auto scrollbar-none flex-1 min-w-0">
                <TypePill opt={TYPE_ALL} />
                {selectedType && <TypePill opt={selectedType} />}
              </div>
            </div>

            {/* Linha 2 — Busca + Ações */}
            <div className="flex flex-col md:flex-row items-stretch">
              <div className="flex-1 flex items-center gap-3 px-4 py-3 border-b md:border-b-0 md:border-r border-ui-border-soft">
                <Icon icon="mingcute:search-line" className="w-5 h-5 text-content-placeholder shrink-0" />
                <input
                  id="search-input"
                  name="search"
                  type="text"
                  placeholder={`Cidade, bairro para ${filters.transactionType === "comprar" ? "comprar" : "alugar"}...`}
                  value={filters.location}
                  onChange={(e) => handleFilterChange("location", e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="w-full text-sm md:text-base bg-transparent outline-none text-content placeholder:text-content-placeholder"
                />
                {filters.location && (
                  <button
                    type="button"
                    onClick={() => handleFilterChange("location", "")}
                    className="text-content-placeholder hover:text-content transition-colors shrink-0"
                  >
                    <Icon icon="mingcute:close-circle-line" className="w-4 h-4" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsFilterOpen(true)}
                className="flex items-center justify-center gap-2 px-5 py-3 text-sm font-medium text-content-secondary hover:bg-surface-subtle transition-colors border-b md:border-b-0 md:border-r border-ui-border-soft shrink-0"
              >
                <Icon icon="mingcute:settings-4-line" className="w-4 h-4" />
                <span>Filtros</span>
                {activeFiltersCount > 0 && (
                  <span className="bg-purple-900 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {activeFiltersCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={handleSearch}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-purple-900 hover:bg-purple-800 text-white text-sm font-semibold transition-colors shrink-0"
              >
                <Icon icon="mingcute:search-line" className="w-4 h-4" />
                <span>Buscar</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Modal de Filtros Avançados ──────────────────────────────────────── */}
      {isFilterOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsFilterOpen(false)}
          />

          <div
            ref={modalRef}
            className="relative z-10 bg-surface shadow-2xl flex flex-col w-full md:w-[600px] max-h-[92dvh] md:max-h-[85vh] rounded-t-2xl md:rounded-2xl overflow-hidden"
          >
            {/* Handle mobile */}
            <div className="flex justify-center pt-3 pb-1 md:hidden">
              <div className="w-10 h-1 rounded-full bg-ui-border" />
            </div>

            {/* Cabeçalho */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-ui-border-soft shrink-0">
              <div>
                <h2 className="text-lg font-bold text-content">Filtros avançados</h2>
                {activeFiltersCount > 0 && (
                  <p className="text-xs text-purple-600 font-medium mt-0.5">
                    {activeFiltersCount} {activeFiltersCount === 1 ? "filtro ativo" : "filtros ativos"}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={contextResetFilters}
                    className="text-sm text-content-muted hover:text-purple-700 transition-colors flex items-center gap-1.5 font-medium"
                  >
                    <Icon icon="mingcute:refresh-line" className="w-4 h-4" />
                    Limpar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(false)}
                  className="w-9 h-9 rounded-full hover:bg-surface-subtle flex items-center justify-center text-content-muted transition-colors"
                >
                  <Icon icon="mingcute:close-line" className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Conteúdo rolável */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">

              {/* ── Tipo de imóvel (dinâmico + pesquisável) ── */}
              <div>
                <h3 className="text-sm font-semibold text-content mb-3 flex items-center gap-2">
                  <Icon icon="mingcute:building-3-line" className="w-4 h-4 text-purple-600" />
                  Tipo de imóvel
                </h3>

                {/* Search — só aparece se tiver muitos tipos */}
                {propertyTypes.length > 6 && (
                  <div className="relative mb-3">
                    <Icon
                      icon="mingcute:search-line"
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-placeholder"
                    />
                    <input
                      type="text"
                      placeholder="Buscar tipo..."
                      value={typeSearch}
                      onChange={(e) => setTypeSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-ui-border text-content rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-purple-400 outline-none bg-surface"
                    />
                    {typeSearch && (
                      <button
                        type="button"
                        onClick={() => setTypeSearch("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-content-placeholder hover:text-content"
                      >
                        <Icon icon="mingcute:close-circle-line" className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}

                {/* Lista de tipos */}
                <div className={`grid grid-cols-2 gap-2 ${filteredTypes.length > 8 ? "max-h-52 overflow-y-auto pr-1" : ""}`}>
                  {/* Opção "Todos" */}
                  {(typeSearch === "" || "todos".includes(typeSearch.toLowerCase())) && (
                    <button
                      type="button"
                      onClick={() => handleFilterChange("propertyType", "all")}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                        filters.propertyType === "all"
                          ? "bg-purple-900 text-white border-purple-900"
                          : "border-ui-border text-content-secondary hover:border-purple-400 hover:text-content"
                      }`}
                    >
                      <Icon icon="mingcute:grid-2-line" className="w-4 h-4 shrink-0" />
                      Todos
                      {filters.propertyType === "all" && (
                        <Icon icon="mingcute:check-line" className="w-3.5 h-3.5 ml-auto" />
                      )}
                    </button>
                  )}

                  {/* Tipos dinâmicos */}
                  {filteredTypes.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleFilterChange("propertyType", opt.value)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                        filters.propertyType === opt.value
                          ? "bg-purple-900 text-white border-purple-900"
                          : "border-ui-border text-content-secondary hover:border-purple-400 hover:text-content"
                      }`}
                    >
                      <Icon icon={opt.icon} className="w-4 h-4 shrink-0" />
                      <span className="truncate">{opt.label}</span>
                      {filters.propertyType === opt.value && (
                        <Icon icon="mingcute:check-line" className="w-3.5 h-3.5 ml-auto shrink-0" />
                      )}
                    </button>
                  ))}

                  {filteredTypes.length === 0 && typeSearch && (
                    <p className="col-span-2 text-sm text-content-muted text-center py-3">
                      Nenhum tipo encontrado para "{typeSearch}"
                    </p>
                  )}
                </div>
              </div>

              {/* ── Faixa de valor ── */}
              <div>
                <h3 className="text-sm font-semibold text-content mb-3 flex items-center gap-2">
                  <Icon icon="mingcute:coin-2-line" className="w-4 h-4 text-purple-600" />
                  Faixa de valor
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="valor-min" className="block text-xs font-medium text-content-secondary mb-1.5">
                      Valor mínimo
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-content-placeholder">R$</span>
                      <input
                        id="valor-min"
                        name="valorMin"
                        type="text"
                        inputMode="numeric"
                        placeholder="0,00"
                        value={filters.valorMin}
                        onChange={(e) => handleCurrencyChange("valorMin", e.target.value)}
                        className="w-full pl-8 pr-3 py-2.5 text-sm border border-ui-border text-content rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-purple-400 outline-none bg-surface"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="valor-max" className="block text-xs font-medium text-content-secondary mb-1.5">
                      Valor máximo
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-content-placeholder">R$</span>
                      <input
                        id="valor-max"
                        name="valorMax"
                        type="text"
                        inputMode="numeric"
                        placeholder="0,00"
                        value={filters.valorMax}
                        onChange={(e) => handleCurrencyChange("valorMax", e.target.value)}
                        className="w-full pl-8 pr-3 py-2.5 text-sm border border-ui-border text-content rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-purple-400 outline-none bg-surface"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Características ── */}
              <div>
                <h3 className="text-sm font-semibold text-content mb-4 flex items-center gap-2">
                  <Icon icon="mingcute:home-2-line" className="w-4 h-4 text-purple-600" />
                  Características
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-4">
                  <SelectInput label="Quartos"   value={filters.quartos}   onChange={(v) => handleFilterChange("quartos", v)} />
                  <SelectInput label="Banheiros" value={filters.banheiros} onChange={(v) => handleFilterChange("banheiros", v)} />
                  <SelectInput label="Vagas"     value={filters.vagas}     onChange={(v) => handleFilterChange("vagas", v)} options={[1,2,3,4,5]} />
                  <SelectInput label="Garagem"   value={filters.garagem}   onChange={(v) => handleFilterChange("garagem", v)} options={[1,2,3,4,5]} />
                  <SelectInput label="Lavabo"    value={filters.lavabo}    onChange={(v) => handleFilterChange("lavabo", v)} options={[1,2,3]} />
                  <SelectInput label="Andares"   value={filters.andares}   onChange={(v) => handleFilterChange("andares", v)} options={[1,2,3,4,5,10,15,20]} />
                </div>
              </div>

              {/* ── Área ── */}
              <div>
                <h3 className="text-sm font-semibold text-content mb-3 flex items-center gap-2">
                  <Icon icon="mingcute:ruler-line" className="w-4 h-4 text-purple-600" />
                  Área (m²)
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <input
                      id="area-min"
                      name="areaMin"
                      type="number"
                      min={0}
                      placeholder="Mínimo"
                      value={filters.areaMin}
                      onChange={(e) => handleFilterChange("areaMin", e.target.value)}
                      className="w-full px-3 pr-10 py-2.5 text-sm border border-ui-border text-content rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-purple-400 outline-none bg-surface"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-content-placeholder pointer-events-none">m²</span>
                  </div>
                  <div className="relative">
                    <input
                      id="area-max"
                      name="areaMax"
                      type="number"
                      min={0}
                      placeholder="Máximo"
                      value={filters.areaMax}
                      onChange={(e) => handleFilterChange("areaMax", e.target.value)}
                      className="w-full px-3 pr-10 py-2.5 text-sm border border-ui-border text-content rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-purple-400 outline-none bg-surface"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-content-placeholder pointer-events-none">m²</span>
                  </div>
                </div>
              </div>

              {/* ── Localização ── */}
              <div>
                <h3 className="text-sm font-semibold text-content mb-3 flex items-center gap-2">
                  <Icon icon="mingcute:map-pin-2-line" className="w-4 h-4 text-purple-600" />
                  Localização
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    id="endereco"
                    name="endereco"
                    type="text"
                    placeholder="Endereço, rua, cidade..."
                    value={filters.endereco}
                    onChange={(e) => handleFilterChange("endereco", e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-ui-border text-content rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-purple-400 outline-none bg-surface"
                  />
                  <select
                    id="uf"
                    name="uf"
                    value={filters.uf}
                    onChange={(e) => handleFilterChange("uf", e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-ui-border text-content rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-purple-400 outline-none bg-surface"
                  >
                    <option value="">Estado (UF)</option>
                    {estadosBrasileiros.map((uf) => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </div>
              </div>

            </div>

            {/* Rodapé */}
            <div className="px-6 py-4 border-t border-ui-border-soft bg-surface-subtle shrink-0 flex gap-3">
              <button
                type="button"
                onClick={() => setIsFilterOpen(false)}
                className="flex-1 py-2.5 border border-ui-border text-content-secondary rounded-xl text-sm font-medium hover:bg-surface transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={aplicarFiltros}
                className="flex-1 py-2.5 bg-purple-900 hover:bg-purple-800 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Icon icon="mingcute:search-line" className="w-4 h-4" />
                Ver resultados
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
