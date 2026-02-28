"use client";

import { Icon } from "@iconify/react";
import Image from "next/image";
import { useState, useEffect } from "react";
import { propertyService } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useFilters } from "@/app/context";

interface CasaProps {
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
}

export default function CasasLocacao() {
  const { filters } = useFilters();
  const [casas, setCasas] = useState<CasaProps[]>([]);
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

  const fetchProperties = async (page: number = 1) => {
    try {
      setLoading(true);
      setError(null);

      console.log("====================");
      console.log("BUSCANDO PROPRIEDADES");
      console.log("Filtros:", filters);
      console.log("Tipo de transação:", filters.transactionType);
      console.log("====================");

      const apiFilters: any = {
        page,
        limit: itemsPerPage,
        status: "AVAILABLE",
        property_type: "house",
        transaction_type: filters.transactionType === "alugar" ? "rent" : "sale",
      };

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

      console.log(`Propriedades encontradas: ${propertiesArray.length}`);

      if (propertiesArray.length === 0) {
        setCasas([]);
        setTotalPages(totalPagesCount);
        setTotalResults(totalCount);
        return;
      }

      // ---------- MAPEAMENTO CORRIGIDO PARA A ESTRUTURA REAL DA API ----------
      const mappedProperties: CasaProps[] = propertiesArray.map((property: any) => {
        console.log("----- Processando propriedade ID:", property.id);
        console.log("Objeto completo:", JSON.stringify(property, null, 2));

        // ----- 1. ENDEREÇO (agora extrai de property.addresses[0].address) -----
        let street = "",
          number = "",
          district = "",
          city = "",
          state = "";

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

        // ----- 2. PREÇO, CONDOMÍNIO E STATUS (agora extrai de property.values[0]) -----
        let preco = 0;
        let condoFee = 0;
        let propertyStatus = "AVAILABLE";

        if (property.values && property.values.length > 0) {
          const val = property.values[0];
          if (filters.transactionType === "alugar") {
            preco = parseFloat(val.rental_value) || 0;
          } else {
            preco = parseFloat(val.purchase_value) || 0;
          }
          condoFee = parseFloat(val.condo_fee) || 0;
          propertyStatus = val.status || "AVAILABLE";
        }

        console.log(`→ Preço (${filters.transactionType}):`, preco);
        console.log("→ Condomínio:", condoFee);
        console.log("→ Status:", propertyStatus);

        // ----- 3. TIPO DO IMÓVEL -----
        let tipo = "Casa";
        if (property.type?.description) {
          tipo = property.type.description;
        } else if (property.type?.name) {
          tipo = property.type.name;
        } else if (property.property_type === "house") {
          tipo = "Casa";
        } else if (property.property_type === "apartment") {
          tipo = "Apartamento";
        } else if (property.property_type) {
          tipo = property.property_type;
        }
        console.log("→ Tipo:", tipo);

        // ----- 4. CARACTERÍSTICAS (estão na raiz do objeto) -----
        const quartos = property.bedrooms ?? 0;
        const banheiros = (property.bathrooms ?? 0) + (property.half_bathrooms ?? 0);
        const vagas = property.garage_spaces ?? 0;
        const area = property.area_built ?? property.area_total ?? 0;
        const areaTerreno = property.area_total ?? 0;
        const mobilia = property.furnished ?? false;

        console.log(
          "→ Quartos:",
          quartos,
          "| Banheiros:",
          banheiros,
          "| Vagas:",
          vagas,
          "| Área:",
          area,
          "| Mobília:",
          mobilia
        );

        // ----- 5. IMAGENS (primeira imagem do array documents) -----
        let imagem = "/CasasLocacao.jpg";
        if (property.documents && property.documents.length > 0) {
          const img = property.documents.find(
            (d: any) => d.type === "IMAGE" && d.file_path
          );
          if (img?.file_path) {
            imagem = img.file_path;
          }
        }
        console.log("→ Imagem:", imagem);

        // ----- 6. CAMPOS OPCIONAIS (não existem na API, mantidos para fallback) -----
        const suites = property.suites ?? 0;
        const anoConstrucao = property.year_built ?? 0;
        const jardim = property.garden ?? false;
        const piscina = property.pool ?? false;
        const churrasqueira = property.barbecue ?? false;

        return {
          id: property.id || `temp-${Math.random()}`,
          nome: property.title || property.name || `${tipo} em ${district || city || "localização"}`,
          local,
          preco,
          quartos,
          banheiros,
          vagas,
          area,
          mobilia,
          status: propertyStatus,
          imagem,
          cidade: city || "Não informada",
          tipo,
          precoCondominio: condoFee,
          areaTerreno,
          suites,
          anoConstrucao,
          jardim,
          piscina,
          churrasqueira,
        };
      });

      console.log("========= PROPRIEDADES MAPEADAS =========");
      console.log(mappedProperties);
      console.log("==========================================");

      setCasas(mappedProperties);
      setTotalPages(totalPagesCount);
      setCurrentPage(currentPageCount);
      setTotalResults(totalCount);
    } catch (err) {
      console.error("❌ Erro na requisição:", err);
      setError(err instanceof Error ? err.message : "Erro ao conectar com a API");

      // ---------- DADOS DE EXEMPLO (FALLBACK) ----------
      const exampleData = [
        {
          id: "1",
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
          id: "2",
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
        {
          id: "3",
          nome: "Casa Com Piscina",
          local: "Moema, São Paulo",
          preco: 9500,
          quartos: 3,
          banheiros: 4,
          vagas: 2,
          area: 280,
          areaTerreno: 400,
          suites: 1,
          mobilia: true,
          status: "AVAILABLE",
          cidade: "São Paulo",
          tipo: "Casa",
          jardim: false,
          piscina: true,
          churrasqueira: false,
          anoConstrucao: 2021,
        },
        {
          id: "4",
          nome: "Casa de Condomínio",
          local: "Jardins, São Paulo",
          preco: 15000,
          quartos: 6,
          banheiros: 7,
          vagas: 4,
          area: 520,
          areaTerreno: 700,
          suites: 4,
          mobilia: true,
          status: "AVAILABLE",
          cidade: "São Paulo",
          tipo: "Casa",
          jardim: true,
          piscina: true,
          churrasqueira: true,
          anoConstrucao: 2019,
        },
        {
          id: "5",
          nome: "Casa Com Churrasqueira",
          local: "Vila Nova Conceição, São Paulo",
          preco: 11000,
          quartos: 4,
          banheiros: 4,
          vagas: 3,
          area: 320,
          areaTerreno: 450,
          suites: 2,
          mobilia: true,
          status: "AVAILABLE",
          cidade: "São Paulo",
          tipo: "Casa",
          jardim: true,
          piscina: false,
          churrasqueira: true,
          anoConstrucao: 2022,
        },
        {
          id: "6",
          nome: "Casa Com Jardim",
          local: "Alto de Pinheiros, São Paulo",
          preco: 13000,
          quartos: 5,
          banheiros: 5,
          vagas: 3,
          area: 380,
          areaTerreno: 550,
          suites: 2,
          mobilia: false,
          status: "AVAILABLE",
          cidade: "São Paulo",
          tipo: "Casa",
          jardim: true,
          piscina: true,
          churrasqueira: true,
          anoConstrucao: 2017,
        },
        {
          id: "7",
          nome: "Casa Compacta",
          local: "Perdizes, São Paulo",
          preco: 7000,
          quartos: 2,
          banheiros: 2,
          vagas: 1,
          area: 180,
          areaTerreno: 250,
          suites: 1,
          mobilia: true,
          status: "AVAILABLE",
          cidade: "São Paulo",
          tipo: "Casa",
          jardim: true,
          piscina: false,
          churrasqueira: false,
          anoConstrucao: 2020,
        },
        {
          id: "8",
          nome: "Casa Térrea",
          local: "Tatuapé, São Paulo",
          preco: 9000,
          quartos: 3,
          banheiros: 3,
          vagas: 2,
          area: 220,
          areaTerreno: 300,
          suites: 1,
          mobilia: false,
          status: "AVAILABLE",
          cidade: "São Paulo",
          tipo: "Casa",
          jardim: false,
          piscina: true,
          churrasqueira: true,
          anoConstrucao: 2021,
        },
      ];

      // Aplica os filtros nos dados de exemplo
      let filteredData = [...exampleData];
      if (filters.quartos)
        filteredData = filteredData.filter((casa) => casa.quartos >= Number(filters.quartos));
      if (filters.banheiros)
        filteredData = filteredData.filter((casa) => casa.banheiros >= Number(filters.banheiros));
      if (filters.vagas)
        filteredData = filteredData.filter((casa) => casa.vagas >= Number(filters.vagas));
      if (filters.valorMin) {
        const minValor = Number(filters.valorMin.replace(/[^0-9]/g, ""));
        filteredData = filteredData.filter((casa) => casa.preco >= minValor);
      }
      if (filters.valorMax) {
        const maxValor = Number(filters.valorMax.replace(/[^0-9]/g, ""));
        filteredData = filteredData.filter((casa) => casa.preco <= maxValor);
      }
      if (filters.areaMin)
        filteredData = filteredData.filter((casa) => casa.area >= Number(filters.areaMin));
      if (filters.areaMax)
        filteredData = filteredData.filter((casa) => casa.area <= Number(filters.areaMax));
      if (String(filters.mobilia) === "1")
        filteredData = filteredData.filter((casa) => casa.mobilia === true);
      else if (String(filters.mobilia) === "0")
        filteredData = filteredData.filter((casa) => casa.mobilia === false);
      if (filters.location) {
        filteredData = filteredData.filter(
          (casa) =>
            casa.local.toLowerCase().includes(filters.location.toLowerCase()) ||
            casa.nome.toLowerCase().includes(filters.location.toLowerCase())
        );
      }

      const startIndex = (page - 1) * itemsPerPage;
      const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

      setCasas(paginatedData);
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

  const handleVerDetalhes = (casaId: string) => {
    router.push(`/casas/${casaId}`);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      fetchProperties(newPage);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // ---------- LOADING SKELETON ----------
  if (loading && casas.length === 0) {
    return (
      <div className="w-full py-8 mt-20">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              {filters.transactionType === "alugar"
                ? "Casas para Locação"
                : "Casas à Venda"}
            </h1>
            <p className="text-gray-600">Encontre a casa perfeita para sua família</p>
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

  // ---------- RENDER PRINCIPAL ----------
  return (
    <div className="w-full py-8 mt-20">
      <div className="container mx-auto px-4">
        {/* Cabeçalho */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            {filters.transactionType === "alugar"
              ? "Casas para Locação"
              : "Casas à Venda"}
          </h1>
          <p className="text-gray-600 mb-6">Encontre a casa perfeita para sua família</p>

          {/* Resumo dos filtros ativos */}
          <div className="mb-6 p-4 bg-purple-50 rounded-lg">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-purple-800">Filtros ativos:</span>
              {filters.quartos && (
                <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full">
                  {filters.quartos} quarto{filters.quartos !== 1 ? "s" : ""}
                </span>
              )}
              {filters.banheiros && (
                <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full">
                  {filters.banheiros} banheiro{filters.banheiros !== 1 ? "s" : ""}
                </span>
              )}
              {filters.vagas && (
                <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full">
                  {filters.vagas} vaga{filters.vagas !== 1 ? "s" : ""}
                </span>
              )}
              {filters.valorMin && (
                <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full">
                  Valor mínimo:{" "}
                  {formatCurrency(Number(filters.valorMin.replace(/[^0-9]/g, "")))}
                </span>
              )}
              {filters.valorMax && (
                <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full">
                  Valor máximo:{" "}
                  {formatCurrency(Number(filters.valorMax.replace(/[^0-9]/g, "")))}
                </span>
              )}
              {filters.areaMin && (
                <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full">
                  Área mínima: {filters.areaMin}m²
                </span>
              )}
              {filters.areaMax && (
                <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full">
                  Área máxima: {filters.areaMax}m²
                </span>
              )}
              {(filters.location || filters.bairro || filters.uf) && (
                <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full">
                  Localização: {filters.location || filters.bairro || filters.uf}
                </span>
              )}
              {String(filters.mobilia) === "1" && (
                <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full">
                  Mobiliada
                </span>
              )}
              {String(filters.mobilia) === "0" && (
                <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full">
                  Não mobiliada
                </span>
              )}
            </div>
          </div>

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
                {totalResults} {totalResults === 1 ? "casa encontrada" : "casas encontradas"}
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
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      console.log("Estado atual:", {
                        casas,
                        loading,
                        error,
                        totalPages,
                        currentPage,
                        filters,
                      });
                    }
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                >
                  Debug
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Grid de Casas */}
        {casas.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-6">
              {casas.map((casa) => (
                <div
                  key={casa.id}
                  className="bg-surface rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col border border-gray-100"
                >
                  {/* Imagem */}
                  <div className="relative h-48 overflow-hidden">
                    {casa.imagem ? (
                      <Image
                        src={casa.imagem}
                        alt={casa.nome}
                        fill
                        className="object-cover transition-transform duration-300 hover:scale-105"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                        priority={false}
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-100 to-blue-100 flex items-center justify-center">
                        <Icon icon="mingcute:home-2-line" className="w-16 h-16 text-purple-300" />
                      </div>
                    )}

                    {/* Badges de características */}
                    <div className="absolute top-3 left-3 flex flex-col gap-2">
                      {casa.piscina && (
                        <span className="px-3 py-1 bg-blue-600 text-white text-xs rounded-full font-medium">
                          Piscina
                        </span>
                      )}
                      {casa.jardim && (
                        <span className="px-3 py-1 bg-green-600 text-white text-xs rounded-full font-medium">
                          Jardim
                        </span>
                      )}
                      {casa.churrasqueira && (
                        <span className="px-3 py-1 bg-orange-600 text-white text-xs rounded-full font-medium">
                          Churrasqueira
                        </span>
                      )}
                    </div>

                    {/* Badge de status */}
                    <div className="absolute top-3 right-3">
                      {casa.status === "AVAILABLE" ? (
                        <span className="px-3 py-1 bg-green-500 text-white text-xs rounded-full font-medium">
                          Disponível
                        </span>
                      ) : casa.status === "RENTED" || casa.status === "SOLD" ? (
                        <span className="px-3 py-1 bg-red-500 text-white text-xs rounded-full font-medium">
                          {casa.status === "RENTED" ? "Alugada" : "Vendida"}
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-gray-500 text-white text-xs rounded-full font-medium">
                          {casa.status}
                        </span>
                      )}
                    </div>

                    {/* Ano de construção */}
                    {casa.anoConstrucao && (
                      <div className="absolute bottom-3 left-3">
                        <span className="px-3 py-1 bg-gray-800/80 text-white text-xs rounded-full font-medium backdrop-blur-sm">
                          {casa.anoConstrucao}
                        </span>
                      </div>
                    )}

                    {/* Suítes */}
                    {typeof casa.suites === "number" && casa.suites > 0 && (
                      <div className="absolute bottom-3 right-3">
                        <span className="px-3 py-1 bg-purple-600/80 text-white text-xs rounded-full font-medium backdrop-blur-sm">
                          {casa.suites} suíte{casa.suites > 1 ? "s" : ""}
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
                        {casa.nome}
                      </h3>
                      <div className="flex items-start gap-2 text-gray-600">
                        <Icon
                          icon="mingcute:map-pin-line"
                          className="w-4 h-4 flex-shrink-0 mt-0.5"
                        />
                        <span className="text-sm line-clamp-2">{casa.local}</span>
                      </div>
                    </div>

                    {/* Preço */}
                    <div className="mb-4">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-purple-900">
                          {formatCurrency(casa.preco)}
                        </span>
                        <span className="text-gray-500">
                          {filters.transactionType === "alugar" ? "/mês" : ""}
                        </span>
                      </div>

                      {casa.areaTerreno && (
                        <p className="text-sm text-gray-600 mt-1">
                          Terreno: {casa.areaTerreno}m²
                        </p>
                      )}

                      <div className="mt-3 flex gap-2 flex-wrap">
                        {casa.mobilia ? (
                          <span className="inline-flex items-center px-3 py-1 bg-purple-50 text-purple-700 text-sm rounded-full">
                            <Icon icon="mingcute:sofa-line" className="w-4 h-4 mr-1" />
                            Mobiliada
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">
                            <Icon icon="mingcute:sofa-line" className="w-4 h-4 mr-1" />
                            Não mobiliada
                          </span>
                        )}

                        {casa.tipo && casa.tipo !== "Casa" && (
                          <span className="inline-flex items-center px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-full">
                            <Icon icon="mingcute:home-2-line" className="w-4 h-4 mr-1" />
                            {casa.tipo}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Ícones de Características */}
                    <div className="grid grid-cols-4 gap-4 py-4 border-y border-gray-100 mb-4">
                      <div className="flex flex-col items-center group cursor-help" title="Quartos">
                        <div className="p-2 bg-purple-50 rounded-lg mb-2 group-hover:bg-purple-100 transition-colors">
                          <Icon icon="mingcute:bed-line" className="w-5 h-5 text-purple-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-800">{casa.quartos}</span>
                        <span className="text-xs text-gray-500">Quartos</span>
                      </div>

                      <div className="flex flex-col items-center group cursor-help" title="Banheiros">
                        <div className="p-2 bg-blue-50 rounded-lg mb-2 group-hover:bg-blue-100 transition-colors">
                          <Icon icon="mingcute:shower-line" className="w-5 h-5 text-blue-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-800">{casa.banheiros}</span>
                        <span className="text-xs text-gray-500">Banheiros</span>
                      </div>

                      <div className="flex flex-col items-center group cursor-help" title="Vagas de garagem">
                        <div className="p-2 bg-green-50 rounded-lg mb-2 group-hover:bg-green-100 transition-colors">
                          <Icon icon="mingcute:car-line" className="w-5 h-5 text-green-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-800">{casa.vagas}</span>
                        <span className="text-xs text-gray-500">Vagas</span>
                      </div>

                      <div className="flex flex-col items-center group cursor-help" title="Área construída">
                        <div className="p-2 bg-yellow-50 rounded-lg mb-2 group-hover:bg-yellow-100 transition-colors">
                          <Icon icon="mingcute:ruler-line" className="w-5 h-5 text-yellow-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-800">{casa.area}m²</span>
                        <span className="text-xs text-gray-500">Área</span>
                      </div>
                    </div>

                    {/* Características adicionais */}
                    <div className="mb-4">
                      <div className="flex flex-wrap gap-2">
                        {casa.piscina && (
                          <span className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
                            <Icon icon="mingcute:swimming-pool-line" className="w-3 h-3 mr-1" />
                            Piscina
                          </span>
                        )}
                        {casa.jardim && (
                          <span className="inline-flex items-center px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full">
                            <Icon icon="mingcute:flower-line" className="w-3 h-3 mr-1" />
                            Jardim
                          </span>
                        )}
                        {casa.churrasqueira && (
                          <span className="inline-flex items-center px-2 py-1 bg-orange-50 text-orange-700 text-xs rounded-full">
                            <Icon icon="mingcute:fire-line" className="w-3 h-3 mr-1" />
                            Churrasqueira
                          </span>
                        )}
                        {typeof casa.suites === "number" && casa.suites > 0 && (
                          <span className="inline-flex items-center px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded-full">
                            <Icon icon="mingcute:bed-2-line" className="w-3 h-3 mr-1" />
                            {casa.suites} suíte{casa.suites > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Botão de Ação */}
                    <div className="mt-auto">
                      <button
                        onClick={() => handleVerDetalhes(casa.id)}
                        className="w-full py-3 bg-gradient-to-r from-purple-700 to-purple-900 text-white rounded-lg font-medium hover:from-purple-800 hover:to-purple-950 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                        disabled={casa.status !== "AVAILABLE"}
                      >
                        {casa.status === "AVAILABLE" ? (
                          <>
                            <Icon icon="mingcute:eye-line" className="w-5 h-5" />
                            {filters.transactionType === "alugar"
                              ? "Ver Detalhes"
                              : "Ver Imóvel"}
                          </>
                        ) : (
                          <>
                            <Icon icon="mingcute:close-circle-line" className="w-5 h-5" />
                            Indisponível
                          </>
                        )}
                      </button>
                      {casa.status !== "AVAILABLE" && (
                        <p className="text-xs text-gray-500 text-center mt-2">
                          {casa.status === "RENTED"
                            ? "Esta casa já foi alugada"
                            : casa.status === "SOLD"
                            ? "Esta casa já foi vendida"
                            : "Esta casa não está disponível"}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
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
              Mostrando {casas.length} de {totalResults} casas
            </div>
          </>
        ) : (
          !loading && (
            <div className="text-center py-12 bg-surface rounded-xl shadow-sm">
              <Icon icon="mingcute:home-2-line" className="w-24 h-24 text-gray-300 mx-auto mb-6" />
              <h3 className="text-2xl font-medium text-gray-600 mb-3">
                Nenhuma casa encontrada
              </h3>
              <p className="text-gray-500 mb-8 max-w-md mx-auto">
                {filters.quartos ||
                filters.banheiros ||
                filters.valorMin ||
                filters.valorMax ||
                filters.areaMin ||
                filters.areaMax
                  ? "Não encontramos casas com os filtros selecionados. Tente ajustar os critérios de busca."
                  : "Não há casas disponíveis no momento. Por favor, tente novamente mais tarde."}
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
                  onClick={() => {
                    console.log("Sugestão: Limpar alguns filtros");
                  }}
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