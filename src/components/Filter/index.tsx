"use client";

import { useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import { useFilters } from "@/app/context";

export default function Filter() {
  const { 
    filters, 
    setFilters, 
    activeFiltersCount, 
    resetFilters: contextResetFilters,
    isFilterOpen, 
    setIsFilterOpen 
  } = useFilters();
  
  const [activeSection, setActiveSection] = useState<string>("valores");
  const [isMobile, setIsMobile] = useState(false);

  // Detectar tamanho da tela
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Fechar modal ao pressionar ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFilterOpen) {
        setIsFilterOpen(false);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isFilterOpen]);

  const handleFilterChange = (field: keyof typeof filters, value: any) => {
    setFilters({ ...filters, [field]: value });
  };

  const handleSearch = () => {
    console.log("Realizando busca com filtros:", filters);
    // Disparar evento de busca para os componentes ouvirem
    window.dispatchEvent(new CustomEvent('filtersApplied', { detail: filters }));
  };

  const resetFilters = () => {
    contextResetFilters();
  };

  const aplicarFiltros = () => {
    handleSearch();
    setIsFilterOpen(false);
  };

  const estadosBrasileiros = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", 
    "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", 
    "RS", "RO", "RR", "SC", "SP", "SE", "TO"
  ];

  return (
    <>
      {/* Container Principal com position absolute apenas no desktop */}
      <div className="w-full max-w-4xl mx-auto my-10 md:absolute md:top-500px md:left-1/2 md:-translate-y-1/2 md:-translate-x-1/2 md:z-10 md:my-0 md:w-[95%] md:max-w-6xl">
        {/* Barra de Pesquisa Principal */}
        <div className="bg-surface rounded-xl shadow-lg p-4 md:shadow-2xl md:border md:border-ui-border-soft">
          <div className="flex flex-col md:flex-row items-center gap-3">
            {/* Toggle Compra/Aluguel */}
            <div className="flex w-full md:w-auto border rounded-lg overflow-hidden shrink-0">
              <button
                type="button"
                onClick={() => handleFilterChange("transactionType", "comprar")}
                className={`flex-1 md:flex-none px-4 py-3 font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                  filters.transactionType === "comprar"
                    ? "bg-purple-900 text-white"
                    : "bg-surface-subtle text-content-secondary hover:bg-surface-muted"
                }`}
                aria-pressed={filters.transactionType === "comprar"}
              >
                <Icon 
                  icon="mingcute:shopping-cart-2-line" 
                  className="w-4 h-4" 
                />
                <span className="text-sm md:text-base">Comprar</span>
              </button>
              <button
                type="button"
                onClick={() => handleFilterChange("transactionType", "alugar")}
                className={`flex-1 md:flex-none px-4 py-3 font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                  filters.transactionType === "alugar"
                    ? "bg-purple-900 text-white"
                    : "bg-surface-subtle text-content-secondary hover:bg-surface-muted"
                }`}
                aria-pressed={filters.transactionType === "alugar"}
              >
                <Icon 
                  icon="mingcute:key-line" 
                  className="w-4 h-4" 
                />
                <span className="text-sm md:text-base">Alugar</span>
              </button>
            </div>

            {/* Campo de Busca */}
            <div className="w-full md:flex-1">
              <div className="relative">
                <Icon
                  icon="mingcute:search-line"
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-content-placeholder w-4 h-4 md:w-5 md:h-5"
                />
                <input
                  id="search-input"
                  name="search"
                  type="text"
                  placeholder={`Buscar imóveis para ${filters.transactionType === "comprar" ? "comprar" : "alugar"}...`}
                  value={filters.location}
                  onChange={(e) => handleFilterChange("location", e.target.value)}
                  className="w-full pl-10 md:pl-12 pr-4 py-2 md:py-3 text-sm text-content-placeholder focus:text-content md:text-base border border-ui-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  aria-label="Buscar imóveis por localização"
                />
              </div>
            </div>

            {/* Botão de Filtro */}
            <button
              type="button"
              onClick={() => setIsFilterOpen(true)}
              className="w-full md:w-auto px-4 py-2.5 md:px-6 md:py-3 bg-surface-subtle text-content-secondary rounded-lg font-medium hover:bg-surface-muted transition-colors flex items-center justify-center gap-2 shrink-0"
              aria-label={`Abrir filtros avançados (${activeFiltersCount} filtros ativos)`}
              aria-expanded={isFilterOpen}
            >
              <Icon icon="mingcute:filter-line" className="w-4 h-4 md:w-5 md:h-5" />
              <span className="text-sm md:text-base">Filtros</span>
              {activeFiltersCount > 0 && (
                <span className="bg-purple-900 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {/* Botão de Buscar */}
            <button
              type="button"
              onClick={handleSearch}
              className="w-full md:w-auto px-4 py-2.5 md:px-6 md:py-3 bg-purple-900 text-white rounded-lg font-medium hover:bg-purple-800 transition-colors flex items-center justify-center gap-2 shrink-0"
              aria-label="Buscar imóveis"
            >
              <Icon icon="mingcute:search-line" className="w-4 h-4 md:w-5 md:h-5" />
              <span className="text-sm md:text-base">Buscar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Filtros - Mobile (Renderizado fora do container principal) */}
      {isFilterOpen && isMobile && (
        <div className="fixed inset-0 z-50">
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setIsFilterOpen(false)}
            role="presentation"
          />

          {/* Painel de Filtros Mobile */}
          <div className="fixed bottom-0 left-0 right-0 bg-surface rounded-t-2xl shadow-2xl max-h-[85vh] overflow-hidden flex flex-col">
            {/* Barra de arrastar */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-12 h-1.5 bg-surface-muted rounded-full"></div>
            </div>

            {/* Cabeçalho */}
            <div className="sticky top-0 bg-surface border-b border-ui-border-soft p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-content">Filtros Avançados</h2>
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(false)}
                  className="text-content-placeholder hover:text-content-muted transition-colors p-1"
                  aria-label="Fechar filtros"
                >
                  <Icon icon="mingcute:close-line" className="w-6 h-6" />
                </button>
              </div>
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="px-3 py-1.5 text-xs text-content-muted hover:text-purple-900 transition-colors flex items-center gap-1"
                >
                  <Icon icon="mingcute:refresh-line" className="w-3 h-3" />
                  Limpar todos
                </button>
                <button
                  type="button"
                  onClick={aplicarFiltros}
                  className="ml-auto px-4 py-1.5 bg-purple-900 text-white text-xs rounded-lg hover:bg-purple-800 transition-colors flex items-center gap-1"
                >
                  <Icon icon="mingcute:check-line" className="w-3 h-3" />
                  Aplicar
                </button>
              </div>
            </div>

            {/* Menu lateral de seções (mobile) */}
            <div className="border-b border-ui-border-soft overflow-x-auto">
              <div className="flex px-4">
                {[
                  { id: "valores", label: "Valores", icon: "mingcute:coin-line" },
                  { id: "caracteristicas", label: "Características", icon: "mingcute:home-2-line" },
                  { id: "area", label: "Área", icon: "mingcute:ruler-line" },
                  { id: "localizacao", label: "Localização", icon: "mingcute:map-pin-line" },
                  { id: "outros", label: "Outros", icon: "mingcute:settings-3-line" }
                ].map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveSection(section.id)}
                    className={`flex flex-col items-center px-3 py-2 min-w-[80px] transition-colors ${
                      activeSection === section.id
                        ? "text-purple-900 border-b-2 border-purple-900"
                        : "text-content-muted"
                    }`}
                    aria-selected={activeSection === section.id}
                    role="tab"
                  >
                    <Icon icon={section.icon} className="w-4 h-4 mb-1" />
                    <span className="text-xs font-medium">{section.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Conteúdo da seção ativa */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeSection === "valores" && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-content mb-2">Valores (R$)</h3>
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="valor-min-mobile" className="block text-xs font-medium text-content-secondary mb-1">
                        Valor mínimo
                      </label>
                      <input
                        id="valor-min-mobile"
                        name="valorMin"
                        type="text"
                        placeholder="0,00"
                        value={filters.valorMin}
                        onChange={(e) => handleFilterChange("valorMin", e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-ui-border text-content-placeholder focus:text-content rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="valor-max-mobile" className="block text-xs font-medium text-content-secondary mb-1">
                        Valor máximo
                      </label>
                      <input
                        id="valor-max-mobile"
                        name="valorMax"
                        type="text"
                        placeholder="0,00"
                        value={filters.valorMax}
                        onChange={(e) => handleFilterChange("valorMax", e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-ui-border text-content-placeholder focus:text-content rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeSection === "caracteristicas" && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-content mb-2">Características</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="property-type-mobile" className="block text-xs font-medium text-content-secondary mb-1">
                        Tipo de Imóvel
                      </label>
                      <select
                        id="property-type-mobile"
                        name="propertyType"
                        value={filters.propertyType || "all"}
                        onChange={(e) => handleFilterChange("propertyType", e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-ui-border text-content-placeholder focus:text-content rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      >
                        <option value="all">Todos</option>
                        <option value="apartment">Apartamento</option>
                        <option value="house">Casa</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="quartos-mobile" className="block text-xs font-medium text-content-secondary mb-1">
                        Quartos
                      </label>
                      <select
                        id="quartos-mobile"
                        name="quartos"
                        value={filters.quartos}
                        onChange={(e) => handleFilterChange("quartos", e.target.value || "")}
                        className="w-full px-3 py-2 text-sm border border-ui-border text-content-placeholder focus:text-content rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      >
                        <option value="">Qualquer</option>
                        <option value="1">1 quarto</option>
                        <option value="2">2 quartos</option>
                        <option value="3">3 quartos</option>
                        <option value="4">4+ quartos</option>
                      </select>
                    </div>
                    
                    <div>
                      <label htmlFor="banheiros-mobile" className="block text-xs font-medium text-content-secondary mb-1">
                        Banheiros
                      </label>
                      <select
                        id="banheiros-mobile"
                        name="banheiros"
                        value={filters.banheiros}
                        onChange={(e) => handleFilterChange("banheiros", e.target.value || "")}
                        className="w-full px-3 py-2 text-sm border border-ui-border text-content-placeholder focus:text-content rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      >
                        <option value="">Qualquer</option>
                        <option value="1">1 banheiro</option>
                        <option value="2">2 banheiros</option>
                        <option value="3">3+ banheiros</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="vagas-mobile" className="block text-xs font-medium text-content-secondary mb-1">
                        Vagas
                      </label>
                      <select
                        id="vagas-mobile"
                        name="vagas"
                        value={filters.vagas}
                        onChange={(e) => handleFilterChange("vagas", e.target.value || "")}
                        className="w-full px-3 py-2 text-sm border border-ui-border text-content-placeholder focus:text-content rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      >
                        <option value="">Qualquer</option>
                        <option value="1">1 vaga</option>
                        <option value="2">2 vagas</option>
                        <option value="3">3+ vagas</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="garagem-mobile" className="block text-xs font-medium text-content-secondary mb-1">
                        Garagem
                      </label>
                      <select
                        id="garagem-mobile"
                        name="garagem"
                        value={filters.garagem}
                        onChange={(e) => handleFilterChange("garagem", e.target.value || "")}
                        className="w-full px-3 py-2 text-sm border border-ui-border text-content-placeholder focus:text-content rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      >
                        <option value="">Qualquer</option>
                        <option value="1">1 carro</option>
                        <option value="2">2 carros</option>
                        <option value="3">3+ carros</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="lavabo-mobile" className="block text-xs font-medium text-content-secondary mb-1">
                        Lavabo
                      </label>
                      <select
                        id="lavabo-mobile"
                        name="lavabo"
                        value={filters.lavabo}
                        onChange={(e) => handleFilterChange("lavabo", e.target.value || "")}
                        className="w-full px-3 py-2 text-sm border border-ui-border text-content-placeholder focus:text-content rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      >
                        <option value="">Qualquer</option>
                        <option value="1">1 lavabo</option>
                        <option value="2">2 lavabos</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="andares-mobile" className="block text-xs font-medium text-content-secondary mb-1">
                        Andares
                      </label>
                      <select
                        id="andares-mobile"
                        name="andares"
                        value={filters.andares}
                        onChange={(e) => handleFilterChange("andares", e.target.value || "")}
                        className="w-full px-3 py-2 text-sm border border-ui-border text-content-placeholder focus:text-content rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      >
                        <option value="">Qualquer</option>
                        <option value="1">1 andar</option>
                        <option value="2">2 andares</option>
                        <option value="3">3+ andares</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === "area" && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-content mb-2">Área (m²)</h3>
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="area-min-mobile" className="block text-xs font-medium text-content-secondary mb-1">
                        Área mínima
                      </label>
                      <input
                        id="area-min-mobile"
                        name="areaMin"
                        type="text"
                        placeholder="0 m²"
                        value={filters.areaMin}
                        onChange={(e) => handleFilterChange("areaMin", e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-ui-border text-content-placeholder focus:text-content rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="area-max-mobile" className="block text-xs font-medium text-content-secondary mb-1">
                        Área máxima
                      </label>
                      <input
                        id="area-max-mobile"
                        name="areaMax"
                        type="text"
                        placeholder="0 m²"
                        value={filters.areaMax}
                        onChange={(e) => handleFilterChange("areaMax", e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-ui-border text-content-placeholder focus:text-content rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeSection === "localizacao" && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-content mb-2">Localização</h3>
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="endereco-mobile" className="block text-xs font-medium text-content-secondary mb-1">
                        Endereço
                      </label>
                      <input
                        id="endereco-mobile"
                        name="endereco"
                        type="text"
                        placeholder="Rua, número"
                        value={filters.endereco}
                        onChange={(e) => handleFilterChange("endereco", e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-ui-border text-content-placeholder focus:text-content rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="bairro-mobile" className="block text-xs font-medium text-content-secondary mb-1">
                          Bairro
                        </label>
                        <input
                          id="bairro-mobile"
                          name="bairro"
                          type="text"
                          placeholder="Nome do bairro"
                          value={filters.bairro}
                          onChange={(e) => handleFilterChange("bairro", e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-ui-border text-content-placeholder focus:text-content rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                        />
                      </div>
                      <div>
                        <label htmlFor="cep-mobile" className="block text-xs font-medium text-content-secondary mb-1">
                          CEP
                        </label>
                        <input
                          id="cep-mobile"
                          name="cep"
                          type="text"
                          placeholder="00000-000"
                          value={filters.cep}
                          onChange={(e) => handleFilterChange("cep", e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-ui-border text-content-placeholder focus:text-content rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="uf-mobile" className="block text-xs font-medium text-content-secondary mb-1">
                        Estado (UF)
                      </label>
                      <select
                        id="uf-mobile"
                        name="uf"
                        value={filters.uf}
                        onChange={(e) => handleFilterChange("uf", e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-ui-border text-content-placeholder focus:text-content rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      >
                        <option value="">Selecione um estado</option>
                        {estadosBrasileiros.map((uf) => (
                          <option key={uf} value={uf}>
                            {uf}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === "outros" && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-content mb-2">Outros</h3>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="data-inicio-mobile" className="block text-xs font-medium text-content-secondary mb-1">
                          Data início
                        </label>
                        <input
                          id="data-inicio-mobile"
                          name="dataInicio"
                          type="date"
                          value={filters.dataInicio}
                          onChange={(e) => handleFilterChange("dataInicio", e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-ui-border text-content-placeholder focus:text-content rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                        />
                      </div>
                      <div>
                        <label htmlFor="data-fim-mobile" className="block text-xs font-medium text-content-secondary mb-1">
                          Data fim
                        </label>
                        <input
                          id="data-fim-mobile"
                          name="dataFim"
                          type="date"
                          value={filters.dataFim}
                          onChange={(e) => handleFilterChange("dataFim", e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-ui-border text-content-placeholder focus:text-content rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="fachada-mobile" className="block text-xs font-medium text-content-secondary mb-1">
                        Fachada
                      </label>
                      <select
                        id="fachada-mobile"
                        name="fachada"
                        value={filters.fachada}
                        onChange={(e) => handleFilterChange("fachada", e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-ui-border text-content-placeholder focus:text-content rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      >
                        <option value="">Qualquer</option>
                        <option value="nova">Nova</option>
                        <option value="reformada">Reformada</option>
                        <option value="precisa_reforma">Precisa reforma</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="mobilia-mobile" className="block text-xs font-medium text-content-secondary mb-1">
                        Quantidade de móveis
                      </label>
                      <select
                        id="mobilia-mobile"
                        name="mobilia"
                        value={filters.mobilia}
                        onChange={(e) => handleFilterChange("mobilia", e.target.value || "")}
                        className="w-full px-3 py-2 text-sm border border-ui-border text-content-placeholder focus:text-content rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      >
                        <option value="">Qualquer</option>
                        <option value="0">Sem mobília</option>
                        <option value="1">Parcialmente mobiliado</option>
                        <option value="2">Totalmente mobiliado</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Rodapé Mobile */}
            <div className="sticky bottom-0 bg-surface border-t border-ui-border-soft p-4">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-ui-border text-content-secondary rounded-lg font-medium hover:bg-surface-subtle transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={aplicarFiltros}
                  className="flex-1 px-4 py-2.5 bg-purple-900 text-white rounded-lg font-medium hover:bg-purple-800 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Icon icon="mingcute:search-line" className="w-3 h-3" />
                  Aplicar filtros
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Filtros - Desktop (Renderizado fora do container principal) */}
      {isFilterOpen && !isMobile && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setIsFilterOpen(false)}
            role="presentation"
          />

          {/* Painel de Filtros Desktop */}
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-surface shadow-2xl overflow-y-auto">
            <div className="h-full flex flex-col">
              {/* Cabeçalho */}
              <div className="sticky top-0 bg-surface border-b border-ui-border-soft p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-content">Filtros Avançados</h2>
                  <button
                    type="button"
                    onClick={() => setIsFilterOpen(false)}
                    className="text-content-placeholder hover:text-content-muted transition-colors"
                    aria-label="Fechar filtros"
                  >
                    <Icon icon="mingcute:close-line" className="w-6 h-6" />
                  </button>
                </div>
                
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="px-4 py-2 text-sm text-content-muted hover:text-purple-900 transition-colors flex items-center gap-2"
                  >
                    <Icon icon="mingcute:refresh-line" className="w-4 h-4" />
                    Limpar todos
                  </button>
                  <button
                    type="button"
                    onClick={aplicarFiltros}
                    className="ml-auto px-6 py-2 bg-purple-900 text-white rounded-lg hover:bg-purple-800 transition-colors flex items-center gap-2"
                  >
                    <Icon icon="mingcute:check-line" className="w-4 h-4" />
                    Aplicar filtros
                  </button>
                </div>
              </div>

              {/* Corpo dos Filtros */}
              <div className="flex-1 p-6 space-y-8">
                {/* Valores */}
                <div>
                  <h3 className="text-lg font-semibold text-content mb-4 flex items-center gap-2">
                    <Icon icon="mingcute:coin-line" className="w-5 h-5" />
                    Valores
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="valor-min-desktop" className="block text-sm font-medium text-content-secondary mb-2">
                        Valor mínimo (R$)
                      </label>
                      <input
                        id="valor-min-desktop"
                        name="valorMin"
                        type="text"
                        placeholder="0,00"
                        value={filters.valorMin}
                        onChange={(e) => handleFilterChange("valorMin", e.target.value)}
                        className="w-full px-4 py-2 border border-ui-border text-content-placeholder focus:text-content rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="valor-max-desktop" className="block text-sm font-medium text-content-secondary mb-2">
                        Valor máximo (R$)
                      </label>
                      <input
                        id="valor-max-desktop"
                        name="valorMax"
                        type="text"
                        placeholder="0,00"
                        value={filters.valorMax}
                        onChange={(e) => handleFilterChange("valorMax", e.target.value)}
                        className="w-full px-4 py-2 border border-ui-border text-content-placeholder focus:text-content rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Características */}
                <div>
                  <h3 className="text-lg font-semibold text-content mb-4 flex items-center gap-2">
                    <Icon icon="mingcute:home-2-line" className="w-5 h-5" />
                    Características
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="property-type-desktop" className="block text-sm font-medium text-content-secondary mb-2">
                        Tipo de Imóvel
                      </label>
                      <select
                        id="property-type-desktop"
                        name="propertyType"
                        value={filters.propertyType || "all"}
                        onChange={(e) => handleFilterChange("propertyType", e.target.value)}
                        className="w-full px-4 py-2 border border-ui-border text-content-placeholder focus:text-content rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      >
                        <option value="all">Todos</option>
                        <option value="apartment">Apartamento</option>
                        <option value="house">Casa</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="quartos-desktop" className="block text-sm font-medium text-content-secondary mb-2">
                        Quartos
                      </label>
                      <select
                        id="quartos-desktop"
                        name="quartos"
                        value={filters.quartos}
                        onChange={(e) => handleFilterChange("quartos", e.target.value || "")}
                        className="w-full px-4 py-2 border border-ui-border text-content-placeholder focus:text-content rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      >
                        <option value="">Qualquer</option>
                        <option value="1">1 quarto</option>
                        <option value="2">2 quartos</option>
                        <option value="3">3 quartos</option>
                        <option value="4">4+ quartos</option>
                      </select>
                    </div>
                    
                    <div>
                      <label htmlFor="banheiros-desktop" className="block text-sm font-medium text-content-secondary mb-2">
                        Banheiros
                      </label>
                      <select
                        id="banheiros-desktop"
                        name="banheiros"
                        value={filters.banheiros}
                        onChange={(e) => handleFilterChange("banheiros", e.target.value || "")}
                        className="w-full px-4 py-2 border border-ui-border text-content-placeholder focus:text-content rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      >
                        <option value="">Qualquer</option>
                        <option value="1">1 banheiro</option>
                        <option value="2">2 banheiros</option>
                        <option value="3">3+ banheiros</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="vagas-desktop" className="block text-sm font-medium text-content-secondary mb-2">
                        Vagas
                      </label>
                      <select
                        id="vagas-desktop"
                        name="vagas"
                        value={filters.vagas}
                        onChange={(e) => handleFilterChange("vagas", e.target.value || "")}
                        className="w-full px-4 py-2 border border-ui-border text-content-placeholder focus:text-content rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      >
                        <option value="">Qualquer</option>
                        <option value="1">1 vaga</option>
                        <option value="2">2 vagas</option>
                        <option value="3">3+ vagas</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="garagem-desktop" className="block text-sm font-medium text-content-secondary mb-2">
                        Garagem
                      </label>
                      <select
                        id="garagem-desktop"
                        name="garagem"
                        value={filters.garagem}
                        onChange={(e) => handleFilterChange("garagem", e.target.value || "")}
                        className="w-full px-4 py-2 border border-ui-border text-content-placeholder focus:text-content rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      >
                        <option value="">Qualquer</option>
                        <option value="1">1 carro</option>
                        <option value="2">2 carros</option>
                        <option value="3">3+ carros</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="lavabo-desktop" className="block text-sm font-medium text-content-secondary mb-2">
                        Lavabo
                      </label>
                      <select
                        id="lavabo-desktop"
                        name="lavabo"
                        value={filters.lavabo}
                        onChange={(e) => handleFilterChange("lavabo", e.target.value || "")}
                        className="w-full px-4 py-2 border border-ui-border text-content-placeholder focus:text-content rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      >
                        <option value="">Qualquer</option>
                        <option value="1">1 lavabo</option>
                        <option value="2">2 lavabos</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="andares-desktop" className="block text-sm font-medium text-content-secondary mb-2">
                        Andares
                      </label>
                      <select
                        id="andares-desktop"
                        name="andares"
                        value={filters.andares}
                        onChange={(e) => handleFilterChange("andares", e.target.value || "")}
                        className="w-full px-4 py-2 border border-ui-border text-content-placeholder focus:text-content rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      >
                        <option value="">Qualquer</option>
                        <option value="1">1 andar</option>
                        <option value="2">2 andares</option>
                        <option value="3">3+ andares</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Área */}
                <div>
                  <h3 className="text-lg font-semibold text-content mb-4 flex items-center gap-2">
                    <Icon icon="mingcute:ruler-line" className="w-5 h-5" />
                    Área (m²)
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="area-min-desktop" className="block text-sm font-medium text-content-secondary mb-2">
                        Área mínima
                      </label>
                      <input
                        id="area-min-desktop"
                        name="areaMin"
                        type="text"
                        placeholder="0 m²"
                        value={filters.areaMin}
                        onChange={(e) => handleFilterChange("areaMin", e.target.value)}
                        className="w-full px-4 py-2 border border-ui-border text-content-placeholder focus:text-content rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="area-max-desktop" className="block text-sm font-medium text-content-secondary mb-2">
                        Área máxima
                      </label>
                      <input
                        id="area-max-desktop"
                        name="areaMax"
                        type="text"
                        placeholder="0 m²"
                        value={filters.areaMax}
                        onChange={(e) => handleFilterChange("areaMax", e.target.value)}
                        className="w-full px-4 py-2 border border-ui-border text-content-placeholder focus:text-content rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Localização */}
                <div>
                  <h3 className="text-lg font-semibold text-content mb-4 flex items-center gap-2">
                    <Icon icon="mingcute:map-pin-line" className="w-5 h-5" />
                    Localização
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="endereco-desktop" className="block text-sm font-medium text-content-secondary mb-2">
                        Endereço
                      </label>
                      <input
                        id="endereco-desktop"
                        name="endereco"
                        type="text"
                        placeholder="Rua, número"
                        value={filters.endereco}
                        onChange={(e) => handleFilterChange("endereco", e.target.value)}
                        className="w-full px-4 py-2 border border-ui-border text-content-placeholder focus:text-content rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="bairro-desktop" className="block text-sm font-medium text-content-secondary mb-2">
                          Bairro
                        </label>
                        <input
                          id="bairro-desktop"
                          name="bairro"
                          type="text"
                          placeholder="Nome do bairro"
                          value={filters.bairro}
                          onChange={(e) => handleFilterChange("bairro", e.target.value)}
                          className="w-full px-4 py-2 border border-ui-border text-content-placeholder focus:text-content rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                        />
                      </div>
                      <div>
                        <label htmlFor="cep-desktop" className="block text-sm font-medium text-content-secondary mb-2">
                          CEP
                        </label>
                        <input
                          id="cep-desktop"
                          name="cep"
                          type="text"
                          placeholder="00000-000"
                          value={filters.cep}
                          onChange={(e) => handleFilterChange("cep", e.target.value)}
                          className="w-full px-4 py-2 border border-ui-border text-content-placeholder focus:text-content rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="uf-desktop" className="block text-sm font-medium text-content-secondary mb-2">
                        Estado (UF)
                      </label>
                      <select
                        id="uf-desktop"
                        name="uf"
                        value={filters.uf}
                        onChange={(e) => handleFilterChange("uf", e.target.value)}
                        className="w-full px-4 py-2 border border-ui-border text-content-placeholder focus:text-content rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      >
                        <option value="">Selecione um estado</option>
                        {estadosBrasileiros.map((uf) => (
                          <option key={uf} value={uf}>
                            {uf}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Outros */}
                <div>
                  <h3 className="text-lg font-semibold text-content mb-4 flex items-center gap-2">
                    <Icon icon="mingcute:settings-3-line" className="w-5 h-5" />
                    Outros
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="data-inicio-desktop" className="block text-sm font-medium text-content-secondary mb-2">
                          Data início
                        </label>
                        <input
                          id="data-inicio-desktop"
                          name="dataInicio"
                          type="date"
                          value={filters.dataInicio}
                          onChange={(e) => handleFilterChange("dataInicio", e.target.value)}
                          className="w-full px-4 py-2 border border-ui-border text-content-placeholder focus:text-content rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                        />
                      </div>
                      <div>
                        <label htmlFor="data-fim-desktop" className="block text-sm font-medium text-content-secondary mb-2">
                          Data fim
                        </label>
                        <input
                          id="data-fim-desktop"
                          name="dataFim"
                          type="date"
                          value={filters.dataFim}
                          onChange={(e) => handleFilterChange("dataFim", e.target.value)}
                          className="w-full px-4 py-2 border border-ui-border text-content-placeholder focus:text-content rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="fachada-desktop" className="block text-sm font-medium text-content-secondary mb-2">
                        Fachada
                      </label>
                      <select
                        id="fachada-desktop"
                        name="fachada"
                        value={filters.fachada}
                        onChange={(e) => handleFilterChange("fachada", e.target.value)}
                        className="w-full px-4 py-2 border border-ui-border text-content-placeholder focus:text-content rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      >
                        <option value="">Qualquer</option>
                        <option value="nova">Nova</option>
                        <option value="reformada">Reformada</option>
                        <option value="precisa_reforma">Precisa reforma</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="mobilia-desktop" className="block text-sm font-medium text-content-secondary mb-2">
                        Quantidade de móveis
                      </label>
                      <select
                        id="mobilia-desktop"
                        name="mobilia"
                        value={filters.mobilia}
                        onChange={(e) => handleFilterChange("mobilia", e.target.value || "")}
                        className="w-full px-4 py-2 border border-ui-border text-content-placeholder focus:text-content rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      >
                        <option value="">Qualquer</option>
                        <option value="0">Sem mobília</option>
                        <option value="1">Parcialmente mobiliado</option>
                        <option value="2">Totalmente mobiliado</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rodapé Desktop */}
              <div className="sticky bottom-0 bg-surface border-t border-ui-border-soft p-6">
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setIsFilterOpen(false)}
                    className="flex-1 px-6 py-3 border border-ui-border text-content-secondary rounded-lg font-medium hover:bg-surface-subtle transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={aplicarFiltros}
                    className="flex-1 px-6 py-3 bg-purple-900 text-white rounded-lg font-medium hover:bg-purple-800 transition-colors flex items-center justify-center gap-2"
                  >
                    <Icon icon="mingcute:search-line" className="w-4 h-4" />
                    Aplicar filtros
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}