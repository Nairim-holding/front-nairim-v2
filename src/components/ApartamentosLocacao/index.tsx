"use client";

import { Icon } from "@iconify/react";
import Image from "next/image";
import { useState, useEffect } from "react";
import { propertyService } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useFilters } from "@/app/context";

interface ApartamentoProps {
    id: string;
    nome: string;
    local: string;
    preco: number;
    quartos: number;
    banheiros: number;
    vagas: number;
    area: number;
    mobilia: boolean;
    andar: number;
    condominio: boolean;
    status: string;
    imagem?: string;
    cidade: string;
    tipo: string;
    precoCondominio?: number;
}

export default function ApartamentosLocacao() {
    const { filters } = useFilters();
    const [apartamentos, setApartamentos] = useState<ApartamentoProps[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalResults, setTotalResults] = useState(0);
    const router = useRouter();
    
    const itemsPerPage = 8;

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 2
        }).format(value);
    };

    // Função auxiliar para verificar se é apartamento
    const isApartment = (property: any): boolean => {
        // 1. Verifica property_type na raiz
        if (property.property_type === "apartment") return true;
        
        // 2. Verifica dentro de property.type
        if (property.type) {
            const typeDesc = property.type.description?.toLowerCase() || property.type.name?.toLowerCase();
            if (typeDesc?.includes("apartamento") || typeDesc === "apartment") return true;
        }
        
        return false;
    };

    const fetchProperties = async (page: number = 1) => {
        try {
            setLoading(true);
            setError(null);
            
            console.log(`Buscando apartamentos - Página ${page}...`);
            console.log('Filtros ativos:', filters);
            
            const apiFilters: any = {
                page,
                limit: itemsPerPage,
                status: "AVAILABLE",
                property_type: "apartment", // pedimos apartamentos
                transaction_type: filters.transactionType === "alugar" ? "rent" : "sale",
            };
            
            if (filters.quartos) apiFilters.bedrooms = filters.quartos;
            if (filters.banheiros) apiFilters.bathrooms = filters.banheiros;
            if (filters.vagas) apiFilters.garage_spaces = filters.vagas;
            if (filters.garagem) apiFilters.garage = filters.garagem;
            if (filters.areaMin) apiFilters.min_area = Number(filters.areaMin);
            if (filters.areaMax) apiFilters.max_area = Number(filters.areaMax);
            if (filters.valorMin) apiFilters.min_price = Number(filters.valorMin.replace(/[^0-9]/g, ''));
            if (filters.valorMax) apiFilters.max_price = Number(filters.valorMax.replace(/[^0-9]/g, ''));
            if (filters.location) apiFilters.search = filters.location;
            if (filters.bairro) apiFilters.district = filters.bairro;
            if (filters.uf) apiFilters.state = filters.uf;
            if (filters.cep) apiFilters.zip_code = filters.cep;
            if (filters.mobilia) apiFilters.furnished = String(filters.mobilia) === "1" || String(filters.mobilia) === "2";
            if (filters.andares) apiFilters.floor = filters.andares;
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
            } else if (response && typeof response === 'object') {
                if (response.data && Array.isArray(response.data)) propertiesArray = response.data;
                else if (response.properties && Array.isArray(response.properties)) propertiesArray = response.properties;
                else if (response.items && Array.isArray(response.items)) propertiesArray = response.items;
                else if (response.results && Array.isArray(response.results)) propertiesArray = response.results;
                
                totalCount = 
                    response.total ?? response.totalCount ?? response.count ?? propertiesArray.length;
                totalPagesCount = 
                    response.totalPages ?? response.pages ?? Math.ceil(totalCount / itemsPerPage);
                currentPageCount = 
                    response.page ?? response.currentPage ?? page;
            }
            
            console.log(`Propriedades recebidas (antes do filtro): ${propertiesArray.length}`);
            
            // Filtra apenas apartamentos (garantia, caso a API ignore property_type)
            const onlyApartments = propertiesArray.filter(isApartment);
            console.log(`Propriedades após filtrar apenas apartamentos: ${onlyApartments.length}`);
            
            if (onlyApartments.length === 0) {
                setApartamentos([]);
                setTotalResults(0);
                setTotalPages(1);
                return;
            }
            
            // Mapeia os apartamentos
            const mappedApartamentos: ApartamentoProps[] = onlyApartments.map((property: any) => {
                console.log("----- Processando apartamento ID:", property.id);
                console.log("Objeto completo:", JSON.stringify(property, null, 2));
                
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
                
                const local = `${street ? street + ', ' : ''}${number ? number + ' - ' : ''}${district ? district + ', ' : ''}${city ? city + ' - ' : ''}${state || ''}`
                    .trim()
                    .replace(/,\s*$/, '') || "Localização não informada";
                
                // ----- PREÇO, CONDOMÍNIO, STATUS -----
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
                
                // ----- TIPO (forçamos "Apartamento") -----
                const tipo = "Apartamento";
                
                // ----- CARACTERÍSTICAS -----
                const quartos = property.bedrooms ?? 0;
                const banheiros = (property.bathrooms ?? 0) + (property.half_bathrooms ?? 0);
                const vagas = property.garage_spaces ?? 0;
                const area = property.area_built ?? property.area_total ?? 0;
                const mobilia = property.furnished ?? false;
                const andar = property.floor_number ?? 0;
                
                // ----- IMAGEM -----
                let imagem = "/CasasLocacao.jpg";
                if (property.documents && property.documents.length > 0) {
                    const img = property.documents.find(
                        (d: any) => d.type === "IMAGE" && d.file_path
                    );
                    if (img?.file_path) {
                        imagem = img.file_path;
                    }
                }
                
                return {
                    id: property.id || `apart-${Math.random().toString(36).substr(2, 9)}`,
                    nome: property.title || property.name || `${tipo} em ${district || city || "localização"}`,
                    local,
                    preco,
                    quartos,
                    banheiros,
                    vagas,
                    area,
                    mobilia,
                    andar,
                    condominio: condoFee > 0,
                    precoCondominio: condoFee,
                    status: propertyStatus,
                    imagem,
                    cidade: city || "Não informada",
                    tipo,
                };
            });
            
            console.log("========= APARTAMENTOS MAPEADOS =========");
            console.log(mappedApartamentos);
            console.log("==========================================");
            
            // --- RECALCULA TOTAL DE APARTAMENTOS E PÁGINAS ---
            let estimatedTotalApartments = totalCount; // fallback
            let estimatedTotalPages = totalPagesCount;

            if (propertiesArray.length > 0) {
                // Proporção de apartamentos nesta página
                const apartmentProportion = onlyApartments.length / propertiesArray.length;
                estimatedTotalApartments = Math.round(totalCount * apartmentProportion);
                estimatedTotalPages = Math.ceil(estimatedTotalApartments / itemsPerPage);
            }

            console.log(`Total original da API: ${totalCount} (todos os tipos)`);
            console.log(`Estimativa de apartamentos: ${estimatedTotalApartments}`);
            console.log(`Páginas estimadas: ${estimatedTotalPages}`);
            
            setApartamentos(mappedApartamentos);
            setTotalPages(estimatedTotalPages);
            setCurrentPage(currentPageCount);
            setTotalResults(estimatedTotalApartments);
            
        } catch (err) {
            console.error("❌ Erro ao buscar apartamentos:", err);
            setError(err instanceof Error ? err.message : "Erro ao conectar com a API");
            
            // ---------- DADOS DE EXEMPLO (APENAS APARTAMENTOS) ----------
            const exampleData = [
                { id: "1", nome: "Apartamento Moderno", local: "Alphaville, Barueri", preco: 4500, quartos: 3, banheiros: 2, vagas: 2, area: 120, mobilia: true, andar: 12, condominio: true, precoCondominio: 800, status: "AVAILABLE", cidade: "Barueri", tipo: "Apartamento" },
                { id: "2", nome: "Apartamento Alto Padrão", local: "Morumbi, São Paulo", preco: 6800, quartos: 4, banheiros: 3, vagas: 3, area: 180, mobilia: false, andar: 8, condominio: true, precoCondominio: 1200, status: "AVAILABLE", cidade: "São Paulo", tipo: "Apartamento" },
                { id: "3", nome: "Apartamento com Vista", local: "Moema, São Paulo", preco: 5200, quartos: 2, banheiros: 2, vagas: 1, area: 85, mobilia: true, andar: 15, condominio: false, precoCondominio: 0, status: "AVAILABLE", cidade: "São Paulo", tipo: "Apartamento" },
                { id: "4", nome: "Apartamento de Condomínio", local: "Jardins, São Paulo", preco: 7500, quartos: 3, banheiros: 3, vagas: 2, area: 150, mobilia: true, andar: 5, condominio: true, precoCondominio: 950, status: "AVAILABLE", cidade: "São Paulo", tipo: "Apartamento" },
                { id: "5", nome: "Apartamento Compacto", local: "Pinheiros, São Paulo", preco: 3800, quartos: 1, banheiros: 1, vagas: 1, area: 65, mobilia: true, andar: 3, condominio: true, precoCondominio: 600, status: "AVAILABLE", cidade: "São Paulo", tipo: "Apartamento" },
                { id: "6", nome: "Apartamento Duplex", local: "Brooklin, São Paulo", preco: 8500, quartos: 3, banheiros: 3, vagas: 2, area: 140, mobilia: false, andar: 7, condominio: true, precoCondominio: 1100, status: "AVAILABLE", cidade: "São Paulo", tipo: "Apartamento" },
                { id: "7", nome: "Apartamento com Varanda", local: "Vila Olímpia, São Paulo", preco: 6200, quartos: 2, banheiros: 2, vagas: 1, area: 95, mobilia: true, andar: 10, condominio: true, precoCondominio: 850, status: "AVAILABLE", cidade: "São Paulo", tipo: "Apartamento" },
                { id: "8", nome: "Apartamento Novo", local: "Itaim Bibi, São Paulo", preco: 7100, quartos: 3, banheiros: 2, vagas: 2, area: 110, mobilia: false, andar: 6, condominio: true, precoCondominio: 900, status: "AVAILABLE", cidade: "São Paulo", tipo: "Apartamento" },
            ];
            
            // Aplica filtros nos dados de exemplo
            let filteredData = [...exampleData];
            if (filters.quartos) filteredData = filteredData.filter(ap => ap.quartos >= Number(filters.quartos));
            if (filters.banheiros) filteredData = filteredData.filter(ap => ap.banheiros >= Number(filters.banheiros));
            if (filters.vagas) filteredData = filteredData.filter(ap => ap.vagas >= Number(filters.vagas));
            if (filters.valorMin) {
                const minValor = Number(filters.valorMin.replace(/[^0-9]/g, ''));
                filteredData = filteredData.filter(ap => ap.preco >= minValor);
            }
            if (filters.valorMax) {
                const maxValor = Number(filters.valorMax.replace(/[^0-9]/g, ''));
                filteredData = filteredData.filter(ap => ap.preco <= maxValor);
            }
            if (filters.areaMin) filteredData = filteredData.filter(ap => ap.area >= Number(filters.areaMin));
            if (filters.areaMax) filteredData = filteredData.filter(ap => ap.area <= Number(filters.areaMax));
            if (String(filters.mobilia) === "1") filteredData = filteredData.filter(ap => ap.mobilia === true);
            else if (String(filters.mobilia) === "0") filteredData = filteredData.filter(ap => ap.mobilia === false);
            
            const startIndex = (page - 1) * itemsPerPage;
            const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);
            
            setApartamentos(paginatedData);
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
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handleVerDetalhes = (apartamentoId: string) => {
        router.push(`/apartamentos/${apartamentoId}`);
    };

    if (loading && apartamentos.length === 0) {
        return (
            <div className="w-full py-8">
                <div className="container mx-auto px-4">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-800 mb-2">
                            {filters.transactionType === "alugar" ? "Apartamentos para Locação" : "Apartamentos à Venda"}
                        </h1>
                        <p className="text-gray-600">Encontre o apartamento ideal para você</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {[...Array(8)].map((_, index) => (
                            <div key={index} className="bg-surface rounded-xl shadow-lg overflow-hidden animate-pulse">
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

    return (
        <div className="w-full py-8">
            <div className="container mx-auto px-4">
                {/* Cabeçalho */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">
                        {filters.transactionType === "alugar" ? "Apartamentos para Locação" : "Apartamentos à Venda"}
                    </h1>
                    <p className="text-gray-600 mb-6">Encontre o apartamento ideal para você</p>
                    
                    {/* Filtros ativos */}
                    <div className="mb-6 p-4 bg-purple-50 rounded-lg">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-purple-800">Filtros ativos:</span>
                            {filters.quartos && (
                                <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full">
                                    {filters.quartos} quarto{filters.quartos !== 1 ? 's' : ''}
                                </span>
                            )}
                            {filters.banheiros && (
                                <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full">
                                    {filters.banheiros} banheiro{filters.banheiros !== 1 ? 's' : ''}
                                </span>
                            )}
                            {filters.vagas && (
                                <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full">
                                    {filters.vagas} vaga{filters.vagas !== 1 ? 's' : ''}
                                </span>
                            )}
                            {filters.valorMin && (
                                <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full">
                                    Valor mínimo: {formatCurrency(Number(filters.valorMin.replace(/[^0-9]/g, '')))}
                                </span>
                            )}
                            {filters.valorMax && (
                                <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full">
                                    Valor máximo: {formatCurrency(Number(filters.valorMax.replace(/[^0-9]/g, '')))}
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
                                    Mobiliado
                                </span>
                            )}
                            {String(filters.mobilia) === "0" && (
                                <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full">
                                    Não mobiliado
                                </span>
                            )}
                            {filters.andares && (
                                <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full">
                                    Andar: {filters.andares}
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
                                    <p className="text-xs mt-1">Mostrando dados de exemplo enquanto a API não está disponível.</p>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Contador de resultados - COM ÍCONE DE INFORMAÇÃO */}
                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 p-4 bg-surface rounded-lg shadow-sm">
                        <div className="flex items-center gap-2">
                            <p className="text-gray-800 font-medium">
                                {totalResults} {totalResults === 1 ? 'apartamento encontrado' : 'apartamentos encontrados'}
                            </p>
                            <span className="group relative cursor-help">
                                <Icon icon="mingcute:information-line" className="w-4 h-4 text-gray-400" />
                                <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10">
                                    Total estimado com base na página atual
                                </span>
                            </span>
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
                                    onClick={() => console.log("Estado atual:", { apartamentos, loading, error, totalPages, currentPage, filters })}
                                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                                >
                                    Debug
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Grid de Apartamentos */}
                {apartamentos.length > 0 ? (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {apartamentos.map((apartamento) => (
                                <div key={apartamento.id} className="bg-surface rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col border border-gray-100">
                                    {/* ... conteúdo do card (inalterado) ... */}
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
                                        if (totalPages <= 5) pageNum = i + 1;
                                        else if (currentPage <= 3) pageNum = i + 1;
                                        else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                                        else pageNum = currentPage - 2 + i;
                                        return (
                                            <button
                                                key={pageNum}
                                                onClick={() => handlePageChange(pageNum)}
                                                className={`w-12 h-12 rounded-lg flex items-center justify-center font-medium transition-all ${
                                                    currentPage === pageNum
                                                        ? 'bg-purple-900 text-white shadow-md'
                                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm'
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
                                                        ? 'bg-purple-900 text-white shadow-md'
                                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm'
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
                            Mostrando {apartamentos.length} de {totalResults} apartamentos
                        </div>
                    </>
                ) : (
                    !loading && (
                        <div className="text-center py-12 bg-surface rounded-xl shadow-sm">
                            <Icon icon="mingcute:building-2-line" className="w-24 h-24 text-gray-300 mx-auto mb-6" />
                            <h3 className="text-2xl font-medium text-gray-600 mb-3">Nenhum apartamento encontrado</h3>
                            <p className="text-gray-500 mb-8 max-w-md mx-auto">
                                {filters.quartos || filters.banheiros || filters.valorMin || filters.valorMax || filters.areaMin || filters.areaMax
                                    ? "Não encontramos apartamentos com os filtros selecionados. Tente ajustar os critérios de busca."
                                    : "Não há apartamentos disponíveis no momento. Por favor, tente novamente mais tarde."}
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