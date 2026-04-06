"use client";

import { Icon } from "@iconify/react";
import Image from "next/image";
import { useState, useEffect } from "react";
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
  tipo: string; // "Casa", "Apartamento", "Sala Comercial", etc.
  // Campos comuns
  precoCondominio?: number;
  // Campos específicos de casa
  areaTerreno?: number;
  suites?: number;
  anoConstrucao?: number;
  jardim?: boolean;
  piscina?: boolean;
  churrasqueira?: boolean;
  // Campos específicos de apartamento
  andar?: number;
  // Campos comerciais (podem ser adicionados futuramente)
}

export default function ImoveisList() {
  const { filters } = useFilters();
  const [imoveis, setImoveis] = useState<ImovelProps[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const router = useRouter();

  const itemsPerPage = 8;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatArea = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Função para determinar se o imóvel é do tipo desejado (baseado no filtro)
  const matchesPropertyType = (property: any): boolean => {
    if (!filters.propertyType || filters.propertyType === "all") return true;
    const tipo = property.property_type;
    if (filters.propertyType === "house") return tipo === "house";
    if (filters.propertyType === "apartment") return tipo === "apartment";
    // Se o filtro for "all" ou outro valor não reconhecido, mostra tudo
    return true;
  };

  const fetchProperties = async (page: number = 1) => {
    try {
      setLoading(true);
      setError(null);

      console.log("Buscando imóveis - Página", page);
      console.log("Filtros ativos:", filters);

      // Define os tipos a buscar baseado no filtro
      let propertyTypes: string[] = [];
      if (!filters.propertyType || filters.propertyType === "all") {
        propertyTypes = ["house", "apartment"]; // A API pode não aceitar múltiplos tipos, mas enviaremos sem property_type
      } else {
        propertyTypes = [filters.propertyType];
      }

      // Monta os filtros para a API
      const apiFilters: any = {
        page,
        limit: itemsPerPage,
        status: "AVAILABLE",
        transaction_type: filters.transactionType === "alugar" ? "rent" : "sale",
      };

      // Se não for "all", adiciona property_type
      if (filters.propertyType && filters.propertyType !== "all") {
        apiFilters.property_type = filters.propertyType;
      }

      // Demais filtros
      if (filters.quartos) apiFilters.bedrooms = filters.quartos;
      if (filters.banheiros) apiFilters.bathrooms = filters.banheiros;
      if (filters.vagas) apiFilters.garage_spaces = filters.vagas;
      if (filters.garagem) apiFilters.garage = filters.garagem;
      if (filters.areaMin) apiFilters.min_area = Number(filters.areaMin);
      if (filters.areaMax) apiFilters.max_area = Number(filters.areaMax);
      if (filters.valorMin) apiFilters.min_price = Number(filters.valorMin.replace(/[^0-9]/g, ""));
      if (filters.valorMax) apiFilters.max_price = Number(filters.valorMax.replace(/[^0-9]/g, ""));
      if (filters.location) apiFilters.search = filters.location;
      if (filters.bairro) apiFilters.district = filters.bairro;
      if (filters.uf) apiFilters.state = filters.uf;
      if (filters.cep) apiFilters.zip_code = filters.cep;
      if (filters.mobilia)
        apiFilters.furnished = String(filters.mobilia) === "1" || String(filters.mobilia) === "2";
      if (filters.fachada) apiFilters.facade_condition = filters.fachada;
      if (filters.lavabo) apiFilters.lavabo = filters.lavabo;
      if (filters.dataInicio) apiFilters.available_from = filters.dataInicio;
      if (filters.andares) apiFilters.floor = filters.andares;

      console.log("Filtros enviados para API:", apiFilters);

      const response = await propertyService.getAllProperties(apiFilters);
      console.log("Resposta BRUTA da API:", response);

      let propertiesArray: any[] = [];
      let totalCount = 0;
      let totalPagesCount = 1;
      let currentPageCount = page;

      if (Array.isArray(response)) {
        propertiesArray = response;
        totalCount = response.length;
      } else if (response && typeof response === "object") {
        if (response.data && Array.isArray(response.data)) propertiesArray = response.data;
        else if (response.properties && Array.isArray(response.properties)) propertiesArray = response.properties;
        else if (response.items && Array.isArray(response.items)) propertiesArray = response.items;
        else if (response.results && Array.isArray(response.results)) propertiesArray = response.results;

        totalCount =
          response.total ?? response.totalCount ?? response.count ?? propertiesArray.length;
        totalPagesCount =
          response.totalPages ?? response.pages ?? Math.ceil(totalCount / itemsPerPage);
        currentPageCount = response.page ?? response.currentPage ?? page;
      }

      console.log(`Propriedades recebidas da API: ${propertiesArray.length}`);

      // Filtra adicionalmente pelo tipo (garantia)
      const filteredByType = propertiesArray.filter(matchesPropertyType);
      console.log(`Após filtro de tipo (matchesPropertyType): ${filteredByType.length}`);

      if (filteredByType.length === 0) {
        setImoveis([]);
        setTotalResults(0);
        setTotalPages(1);
        return;
      }

      // Mapeia os imóveis
      const mappedImoveis: ImovelProps[] = filteredByType.map((property: any) => {
        console.log("----- Processando imóvel ID:", property.id, "Tipo:", property.property_type);

        // ----- ENDEREÇO -----
        let street = "", number = "", district = "", city = "", state = "";
        if (property.addresses && property.addresses.length > 0) {
          const addr = property.addresses[0].address;
          if (addr) {
            street = addr.street || "";
            number = addr.number?.toString() || "";
            district = addr.district || "";
            city = addr.city || "";
            state = addr.state || "";
          }
        }

        const local = `${street ? street + ", " : ""}${
          number ? number + " - " : ""
        }${district ? district + ", " : ""}${city ? city + " - " : ""}${state || ""}`
          .trim()
          .replace(/,\s*$/, "") || "Localização não informada";

        // ----- PREÇO, CONDOMÍNIO, STATUS -----
        let preco = 0;
        let condoFee = 0;
        let propertyStatus: string | null = null;

        if (property.values && property.values.length > 0) {
          const val = property.values[0];
          if (filters.transactionType === "alugar") {
            preco = parseFloat(val.rental_value) || 0;
          } else {
            preco = parseFloat(val.purchase_value) || 0;
          }
          condoFee = parseFloat(val.condo_fee) || 0;
          propertyStatus = val.status || property.status;
        } else {
          propertyStatus = property.status;
        }

        propertyStatus = propertyStatus ? String(propertyStatus).toUpperCase() : null;

        // ----- TIPO DO IMÓVEL (TEXTO AMIGÁVEL) -----
        let tipoAmigavel = "Imóvel";
        const rawType = property.property_type;
        if (rawType === "house") {
          tipoAmigavel = "Casa";
        } else if (rawType === "apartment") {
          tipoAmigavel = "Apartamento";
        } else if (rawType === "commercial" || rawType === "commercial_sale") {
          tipoAmigavel = "Sala Comercial";
        } else if (property.type?.description) {
          tipoAmigavel = property.type.description;
        } else if (property.type?.name) {
          tipoAmigavel = property.type.name;
        }

        // ----- CARACTERÍSTICAS COMUNS -----
        const quartos = property.bedrooms ?? 0;
        const banheiros = (property.bathrooms ?? 0) + (property.half_bathrooms ?? 0);
        const vagas = property.garage_spaces ?? 0;
        const area = property.area_built ?? property.area_total ?? 0;
        const mobilia = property.furnished ?? false;

        // ----- IMAGEM -----
        let imagem = "/CasaLocacao.jpeg"; // imagem padrão
        if (property.documents && property.documents.length > 0) {
          const img = property.documents.find(
            (d: any) => d.type === "IMAGE" && d.file_path
          );
          if (img?.file_path) {
            imagem = img.file_path;
          }
        }

        // ----- CAMPOS ESPECÍFICOS -----
        const baseImovel = {
          id: property.id || `temp-${Math.random()}`,
          nome: property.title || property.name || `${tipoAmigavel} em ${district || city || "localização"}`,
          local,
          preco,
          quartos,
          banheiros,
          vagas,
          area,
          mobilia,
          status: propertyStatus || "UNKNOWN",
          imagem,
          cidade: city || "Não informada",
          tipo: tipoAmigavel,
          precoCondominio: condoFee,
        };

        // Adiciona campos específicos baseado no tipo bruto (property_type)
        if (rawType === "house") {
          return {
            ...baseImovel,
            areaTerreno: property.area_total ?? 0,
            suites: property.suites ?? 0,
            anoConstrucao: property.year_built ?? 0,
            jardim: property.garden ?? false,
            piscina: property.pool ?? false,
            churrasqueira: property.barbecue ?? false,
          };
        } else if (rawType === "apartment") {
          return {
            ...baseImovel,
            andar: property.floor_number ?? 0,
          };
        } else {
          // Para outros tipos (comercial, terreno, etc.) retorna apenas os campos comuns
          return { ...baseImovel };
        }
      });

      console.log("========= IMÓVEIS MAPEADOS =========");
      console.log(mappedImoveis);
      console.log("====================================");

      // Filtra apenas disponíveis (status AVAILABLE)
      const availableImoveis = mappedImoveis.filter(p => p.status === "AVAILABLE");
      console.log(`Imóveis disponíveis após filtro de status: ${availableImoveis.length}`);

      // Recalcula totais
      const newTotalResults = availableImoveis.length;
      const newTotalPages = Math.ceil(newTotalResults / itemsPerPage);
      let newCurrentPage = currentPageCount;
      if (newCurrentPage > newTotalPages && newTotalPages > 0) {
        newCurrentPage = 1;
      }

      setImoveis(availableImoveis);
      setTotalPages(newTotalPages);
      setCurrentPage(newCurrentPage);
      setTotalResults(newTotalResults);
    } catch (err) {
      console.error("❌ Erro ao buscar imóveis:", err);
      setError(err instanceof Error ? err.message : "Erro ao conectar com a API");

      // Dados de exemplo (fallback) - inclui casas, apartamentos e um comercial
      const exampleData = [
        // Casas
        {
          id: "c1",
          nome: "Casa Moderna Alphaville",
          local: "Alphaville, Barueri",
          preco: 8500,
          quartos: 4,
          banheiros: 5,
          vagas: 3,
          area: 350,
          areaTerreno: 500,
          suites: 2,
          mobilia: true,
          status: "AVAILABLE",
          cidade: "Barueri",
          tipo: "Casa",
          jardim: true,
          piscina: true,
          churrasqueira: true,
          anoConstrucao: 2020,
        },
        {
          id: "c2",
          nome: "Sobrado Familiar",
          local: "Morumbi, São Paulo",
          preco: 12000,
          quartos: 5,
          banheiros: 6,
          vagas: 4,
          area: 450,
          areaTerreno: 600,
          suites: 3,
          mobilia: false,
          status: "AVAILABLE",
          cidade: "São Paulo",
          tipo: "Casa",
          jardim: true,
          piscina: false,
          churrasqueira: true,
          anoConstrucao: 2018,
        },
        // Apartamentos
        {
          id: "a1",
          nome: "Apartamento Moderno",
          local: "Alphaville, Barueri",
          preco: 4500,
          quartos: 3,
          banheiros: 2,
          vagas: 2,
          area: 120,
          mobilia: true,
          andar: 12,
          precoCondominio: 800,
          status: "AVAILABLE",
          cidade: "Barueri",
          tipo: "Apartamento",
        },
        {
          id: "a2",
          nome: "Apartamento Alto Padrão",
          local: "Morumbi, São Paulo",
          preco: 6800,
          quartos: 4,
          banheiros: 3,
          vagas: 3,
          area: 180,
          mobilia: false,
          andar: 8,
          precoCondominio: 1200,
          status: "AVAILABLE",
          cidade: "São Paulo",
          tipo: "Apartamento",
        },
        // Sala Comercial (exemplo)
        {
          id: "com1",
          nome: "Sala Comercial Centro",
          local: "Centro, Barueri",
          preco: 3200,
          quartos: 0,
          banheiros: 1,
          vagas: 2,
          area: 85,
          mobilia: false,
          status: "AVAILABLE",
          cidade: "Barueri",
          tipo: "Sala Comercial",
          precoCondominio: 450,
        },
      ];

      // Aplica filtros nos dados de exemplo
      let filteredData = [...exampleData];
      if (filters.propertyType && filters.propertyType !== "all") {
        filteredData = filteredData.filter(item => 
          (filters.propertyType === "house" && item.tipo === "Casa") ||
          (filters.propertyType === "apartment" && item.tipo === "Apartamento")
        );
        // Comercial não é filtrado por house/apartment, então se filter for house/apartment, comercial é excluído. OK.
      }
      if (filters.quartos)
        filteredData = filteredData.filter((item) => item.quartos >= Number(filters.quartos));
      if (filters.banheiros)
        filteredData = filteredData.filter((item) => item.banheiros >= Number(filters.banheiros));
      if (filters.vagas)
        filteredData = filteredData.filter((item) => item.vagas >= Number(filters.vagas));
      if (filters.valorMin) {
        const minValor = Number(filters.valorMin.replace(/[^0-9]/g, ""));
        filteredData = filteredData.filter((item) => item.preco >= minValor);
      }
      if (filters.valorMax) {
        const maxValor = Number(filters.valorMax.replace(/[^0-9]/g, ""));
        filteredData = filteredData.filter((item) => item.preco <= maxValor);
      }
      if (filters.areaMin)
        filteredData = filteredData.filter((item) => item.area >= Number(filters.areaMin));
      if (filters.areaMax)
        filteredData = filteredData.filter((item) => item.area <= Number(filters.areaMax));
      if (String(filters.mobilia) === "1")
        filteredData = filteredData.filter((item) => item.mobilia === true);
      else if (String(filters.mobilia) === "0")
        filteredData = filteredData.filter((item) => item.mobilia === false);
      if (filters.location) {
        filteredData = filteredData.filter(
          (item) =>
            item.local.toLowerCase().includes(filters.location.toLowerCase()) ||
            item.nome.toLowerCase().includes(filters.location.toLowerCase())
        );
      }

      // Filtra disponíveis
      filteredData = filteredData.filter((item) => item.status === "AVAILABLE");

      const startIndex = (page - 1) * itemsPerPage;
      const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

      setImoveis(paginatedData);
      setTotalPages(Math.ceil(filteredData.length / itemsPerPage));
      setCurrentPage(page);
      setTotalResults(filteredData.length);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    fetchProperties(1);
  }, [filters]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      fetchProperties(newPage);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleVerDetalhes = (id: string, tipo: string) => {
    // Define rota baseada no tipo amigável
    let basePath = "imoveis"; // fallback genérico
    if (tipo.toLowerCase() === "casa") {
      basePath = "casas";
    } else if (tipo.toLowerCase() === "apartamento") {
      basePath = "apartamentos";
    } else if (tipo.toLowerCase().includes("comercial")) {
      basePath = "comerciais";
    }
    router.push(`/${basePath}/${id}`);
  };

  // Loading skeleton
  if (loading && imoveis.length === 0) {
    return (
      <div className="w-full py-8 mt-20">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              {filters.transactionType === "alugar" ? "Imóveis para Locação" : "Imóveis à Venda"}
            </h1>
            <p className="text-gray-600">Encontre o imóvel ideal para você</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-6">
            {[...Array(4)].map((_, index) => (
              <div
                key={index}
                className="bg-surface rounded-xl shadow-lg overflow-hidden animate-pulse"
              >
                <div className="h-48 bg-gray-300"></div>
                <div className="p-5">
                  <div className="h-6 bg-gray-300 rounded mb-4"></div>
                  <div className="h-4 bg-gray-300 rounded mb-6"></div>
                  <div className="h-8 bg-gray-300 rounded mb-6"></div>
                  <div className="grid grid-cols-4 gap-4 py-4 mb-4">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="h-16 bg-gray-300 rounded"></div>
                    ))}
                  </div>
                  <div className="h-10 bg-gray-300 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Render principal
  return (
    <div className="w-full py-8 mt-20">
      <div className="container mx-auto px-4">
        {/* Cabeçalho */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            {filters.transactionType === "alugar" ? "Imóveis para Locação" : "Imóveis à Venda"}
          </h1>
          <p className="text-gray-600 mb-6">Encontre o imóvel ideal para você</p>
          
          {/* Mensagem de erro */}
          {error && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg mb-6">
              <div className="flex items-center">
                <Icon icon="mingcute:warning-line" className="w-5 h-5 mr-2" />
                <div>
                  <p className="font-medium">⚠️ Atenção</p>
                  <p className="text-sm">{error}</p>
                  <p className="text-xs mt-1">
                    Mostrando dados de exemplo enquanto a API não está disponível.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Contador de resultados */}
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 p-4 bg-surface rounded-lg shadow-sm">
            <div>
              <p className="text-gray-800 font-medium">
                {totalResults} {totalResults === 1 ? "imóvel encontrado" : "imóveis encontrados"}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {filters.transactionType === "alugar" ? "Para locação" : "À venda"}
              </p>
            </div>
            <div className="flex items-center gap-4 mt-4 md:mt-0">
              {totalPages > 1 && (
                <p className="text-sm text-gray-500">
                  Página {currentPage} de {totalPages}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => fetchProperties(currentPage)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 text-sm"
                  title="Recarregar dados"
                >
                  <Icon icon="mingcute:refresh-line" className="w-4 h-4" />
                  Atualizar
                </button>
                <button
                  onClick={() => console.log("Estado atual:", { imoveis, loading, error, totalPages, currentPage, filters })}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                >
                  Debug
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Grid de Imóveis */}
        {imoveis.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-6">
              {imoveis.map((imovel) => {
                const isCasa = imovel.tipo === "Casa";
                const isApartamento = imovel.tipo === "Apartamento";
                const isComercial = imovel.tipo.toLowerCase().includes("comercial");
                return (
                  <div
                    key={imovel.id}
                    className="bg-surface rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col border border-gray-100"
                  >
                    {/* Imagem */}
                    <div className="relative h-48 overflow-hidden">
                      {imovel.imagem ? (
                        <Image
                          src={imovel.imagem}
                          alt={imovel.nome}
                          fill
                          className="object-cover transition-transform duration-300 hover:scale-105"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                          priority={false}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-100 to-blue-100 flex items-center justify-center">
                          <Icon
                            icon={isCasa ? "mingcute:home-2-line" : isApartamento ? "mingcute:building-2-line" : "mingcute:store-line"}
                            className="w-16 h-16 text-purple-300"
                          />
                        </div>
                      )}

                      {/* Badges de características específicas */}
                      <div className="absolute top-3 left-3 flex flex-col gap-2">
                        {isCasa && imovel.piscina && (
                          <span className="px-3 py-1 bg-blue-600 text-white text-xs rounded-full font-medium">
                            Piscina
                          </span>
                        )}
                        {isCasa && imovel.jardim && (
                          <span className="px-3 py-1 bg-green-600 text-white text-xs rounded-full font-medium">
                            Jardim
                          </span>
                        )}
                        {isCasa && imovel.churrasqueira && (
                          <span className="px-3 py-1 bg-orange-600 text-white text-xs rounded-full font-medium">
                            Churrasqueira
                          </span>
                        )}
                        {isApartamento && imovel.andar && (
                          <span className="px-3 py-1 bg-purple-600 text-white text-xs rounded-full font-medium">
                            {imovel.andar}º andar
                          </span>
                        )}
                        {isComercial && (
                          <span className="px-3 py-1 bg-indigo-600 text-white text-xs rounded-full font-medium">
                            Comercial
                          </span>
                        )}
                      </div>

                      {/* Badge de status */}
                      <div className="absolute top-3 right-3">
                        {imovel.status === "AVAILABLE" ? (
                          <span className="px-3 py-1 bg-green-500 text-white text-xs rounded-full font-medium">
                            Disponível
                          </span>
                        ) : imovel.status === "RENTED" || imovel.status === "SOLD" ? (
                          <span className="px-3 py-1 bg-red-500 text-white text-xs rounded-full font-medium">
                            {imovel.status === "RENTED" ? "Alugado" : "Vendido"}
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-gray-500 text-white text-xs rounded-full font-medium">
                            {imovel.status}
                          </span>
                        )}
                      </div>

                      {/* Ano de construção (casa) */}
                      {isCasa && imovel.anoConstrucao && (
                        <div className="absolute bottom-3 left-3">
                          <span className="px-3 py-1 bg-gray-800/80 text-white text-xs rounded-full font-medium backdrop-blur-sm">
                            {imovel.anoConstrucao}
                          </span>
                        </div>
                      )}

                      {/* Suítes (casa) */}
                      {isCasa && imovel.suites && imovel.suites > 0 && (
                        <div className="absolute bottom-3 right-3">
                          <span className="px-3 py-1 bg-purple-600/80 text-white text-xs rounded-full font-medium backdrop-blur-sm">
                            {imovel.suites} suíte{imovel.suites > 1 ? "s" : ""}
                          </span>
                        </div>
                      )}

                      {/* Overlay escuro */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"></div>
                    </div>

                    {/* Conteúdo */}
                    <div className="p-5 flex-grow flex flex-col">
                      {/* Nome e Localização */}
                      <div className="mb-4">
                        <h3 className="text-lg font-bold text-gray-800 mb-2 line-clamp-1">
                          {imovel.nome}
                        </h3>
                        <div className="flex items-start gap-2 text-gray-600">
                          <Icon
                            icon="mingcute:map-pin-line"
                            className="w-4 h-4 flex-shrink-0 mt-0.5"
                          />
                          <span className="text-sm line-clamp-2">{imovel.local}</span>
                        </div>
                      </div>

                      {/* Preço */}
                      <div className="mb-4">
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-purple-900">
                            {formatCurrency(imovel.preco)}
                          </span>
                          <span className="text-gray-500">
                            {filters.transactionType === "alugar" ? "/mês" : ""}
                          </span>
                        </div>

                        {isCasa && imovel.areaTerreno && (
                          <p className="text-sm text-gray-600 mt-1">
                            Área do terreno: {formatArea(imovel.areaTerreno)} m²
                          </p>
                        )}

                        {!isCasa && imovel.precoCondominio && imovel.precoCondominio > 0 && (
                          <p className="text-sm text-gray-600 mt-1">
                            Condomínio: {formatCurrency(imovel.precoCondominio)}
                          </p>
                        )}

                        <div className="mt-3 flex gap-2 flex-wrap">
                          {imovel.mobilia ? (
                            <span className="inline-flex items-center px-3 py-1 bg-purple-50 text-purple-700 text-sm rounded-full">
                              <Icon icon="mingcute:sofa-line" className="w-4 h-4 mr-1" />
                              Mobiliado
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">
                              <Icon icon="mingcute:sofa-line" className="w-4 h-4 mr-1" />
                              Não mobiliado
                            </span>
                          )}
                          <span className="inline-flex items-center px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-full">
                            <Icon icon="mingcute:home-2-line" className="w-4 h-4 mr-1" />
                            {imovel.tipo}
                          </span>
                        </div>
                      </div>

                      {/* Ícones de Características */}
                      <div className="grid grid-cols-4 gap-4 py-4 border-y border-gray-100 mb-4">
                        <div className="flex flex-col items-center group cursor-help" title="Quartos">
                          <div className="p-2 bg-purple-50 rounded-lg mb-2 group-hover:bg-purple-100 transition-colors">
                            <Icon icon="mingcute:bed-line" className="w-5 h-5 text-purple-600" />
                          </div>
                          <span className="text-sm font-medium text-gray-800">{imovel.quartos}</span>
                          <span className="text-xs text-gray-500">Quartos</span>
                        </div>

                        <div className="flex flex-col items-center group cursor-help" title="Banheiros">
                          <div className="p-2 bg-blue-50 rounded-lg mb-2 group-hover:bg-blue-100 transition-colors">
                            <Icon icon="mingcute:shower-line" className="w-5 h-5 text-blue-600" />
                          </div>
                          <span className="text-sm font-medium text-gray-800">{imovel.banheiros}</span>
                          <span className="text-xs text-gray-500">Banheiros</span>
                        </div>

                        <div className="flex flex-col items-center group cursor-help" title="Vagas de garagem">
                          <div className="p-2 bg-green-50 rounded-lg mb-2 group-hover:bg-green-100 transition-colors">
                            <Icon icon="mingcute:car-line" className="w-5 h-5 text-green-600" />
                          </div>
                          <span className="text-sm font-medium text-gray-800">{imovel.vagas}</span>
                          <span className="text-xs text-gray-500">Vagas</span>
                        </div>

                        <div className="flex flex-col items-center group cursor-help" title="Área construída">
                          <div className="p-2 bg-yellow-50 rounded-lg mb-2 group-hover:bg-yellow-100 transition-colors">
                            <Icon icon="mingcute:ruler-line" className="w-5 h-5 text-yellow-600" />
                          </div>
                          <span className="text-sm font-medium text-gray-800">{formatArea(imovel.area)}</span>
                          <span className="text-xs text-gray-500">m²</span>
                        </div>
                      </div>

                      {/* Características adicionais */}
                      <div className="mb-4">
                        <div className="flex flex-wrap gap-2">
                          {isCasa && imovel.piscina && (
                            <span className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
                              <Icon icon="mingcute:swimming-pool-line" className="w-3 h-3 mr-1" />
                              Piscina
                            </span>
                          )}
                          {isCasa && imovel.jardim && (
                            <span className="inline-flex items-center px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full">
                              <Icon icon="mingcute:flower-line" className="w-3 h-3 mr-1" />
                              Jardim
                            </span>
                          )}
                          {isCasa && imovel.churrasqueira && (
                            <span className="inline-flex items-center px-2 py-1 bg-orange-50 text-orange-700 text-xs rounded-full">
                              <Icon icon="mingcute:fire-line" className="w-3 h-3 mr-1" />
                              Churrasqueira
                            </span>
                          )}
                          {isCasa && imovel.suites && imovel.suites > 0 && (
                            <span className="inline-flex items-center px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded-full">
                              <Icon icon="mingcute:bed-2-line" className="w-3 h-3 mr-1" />
                              {imovel.suites} suíte{imovel.suites > 1 ? "s" : ""}
                            </span>
                          )}
                          {isApartamento && imovel.andar && (
                            <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                              <Icon icon="mingcute:arrow-up-line" className="w-3 h-3 mr-1" />
                              {imovel.andar}º andar
                            </span>
                          )}
                          {isComercial && (
                            <span className="inline-flex items-center px-2 py-1 bg-indigo-50 text-indigo-700 text-xs rounded-full">
                              <Icon icon="mingcute:store-line" className="w-3 h-3 mr-1" />
                              Sala/Comercial
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Botão de Ação */}
                      <div className="mt-auto">
                        <button
                          onClick={() => handleVerDetalhes(imovel.id, imovel.tipo)}
                          className="w-full py-3 bg-gradient-to-r from-purple-700 to-purple-900 text-white rounded-lg font-medium hover:from-purple-800 hover:to-purple-950 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                          disabled={imovel.status !== "AVAILABLE"}
                        >
                          {imovel.status === "AVAILABLE" ? (
                            <>
                              <Icon icon="mingcute:eye-line" className="w-5 h-5" />
                              {filters.transactionType === "alugar" ? "Ver Detalhes" : "Ver Imóvel"}
                            </>
                          ) : (
                            <>
                              <Icon icon="mingcute:close-circle-line" className="w-5 h-5" />
                              Indisponível
                            </>
                          )}
                        </button>
                        {imovel.status !== "AVAILABLE" && (
                          <p className="text-xs text-gray-500 text-center mt-2">
                            {imovel.status === "RENTED"
                              ? `Este imóvel já foi alugado`
                              : imovel.status === "SOLD"
                              ? `Este imóvel já foi vendido`
                              : `Este imóvel não está disponível`}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-12">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                >
                  <Icon icon="mingcute:arrow-left-line" className="w-5 h-5" />
                  Anterior
                </button>

                <div className="flex items-center gap-2">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`w-12 h-12 rounded-lg flex items-center justify-center font-medium transition-all ${
                          currentPage === pageNum
                            ? "bg-purple-900 text-white shadow-md"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  {totalPages > 5 && currentPage < totalPages - 2 && (
                    <>
                      <span className="text-gray-400">...</span>
                      <button
                        onClick={() => handlePageChange(totalPages)}
                        className={`w-12 h-12 rounded-lg flex items-center justify-center font-medium transition-all ${
                          currentPage === totalPages
                            ? "bg-purple-900 text-white shadow-md"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm"
                        }`}
                      >
                        {totalPages}
                      </button>
                    </>
                  )}
                </div>

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                >
                  Próxima
                  <Icon icon="mingcute:arrow-right-line" className="w-5 h-5" />
                </button>
              </div>
            )}

            <div className="text-center mt-6 text-sm text-gray-500">
              Mostrando {imoveis.length} de {totalResults} imóveis
            </div>
          </>
        ) : (
          !loading && (
            <div className="text-center py-12 bg-surface rounded-xl shadow-sm">
              <Icon icon="mingcute:home-2-line" className="w-24 h-24 text-gray-300 mx-auto mb-6" />
              <h3 className="text-2xl font-medium text-gray-600 mb-3">
                Nenhum imóvel encontrado
              </h3>
              <p className="text-gray-500 mb-8 max-w-md mx-auto">
                {filters.quartos ||
                filters.banheiros ||
                filters.valorMin ||
                filters.valorMax ||
                filters.areaMin ||
                filters.areaMax
                  ? "Não encontramos imóveis com os filtros selecionados. Tente ajustar os critérios de busca."
                  : "Não há imóveis disponíveis no momento. Por favor, tente novamente mais tarde."}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => fetchProperties(1)}
                  className="px-8 py-3 bg-purple-900 text-white rounded-lg hover:bg-purple-800 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <Icon icon="mingcute:refresh-line" className="w-5 h-5" />
                  Tentar novamente
                </button>
                <button
                  onClick={() => console.log("Limpar filtros")}
                  className="px-8 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Limpar filtros
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}