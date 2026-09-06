/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap, GeoJSON } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Maximize2, X } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { getThemeTokens, getThemedTileUrl, getTileAttribution } from "@/utils";

const createPinIcon = (fillColor: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
    <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 9.4 12.5 28.5 12.5 28.5S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z" fill="${fillColor}" stroke="#ffffff" stroke-width="1.5"/>
    <circle cx="12.5" cy="12.5" r="5.5" fill="#ffffff"/>
  </svg>`;
  return new L.Icon({
    iconUrl: `data:image/svg+xml;base64,${typeof window !== "undefined" ? window.btoa(svg) : Buffer.from(svg).toString("base64")}`,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  });
};

const leasedIcon = createPinIcon("#8b5cf6"); // Roxa (Locado)
const availableIcon = createPinIcon("#ef4444"); // Vermelha (Disponível)

interface MapCoordinate {
  lat: number;
  lng: number;
  info: string;
  isLeased?: boolean;
  status?: 'OCCUPIED' | 'AVAILABLE';
}

interface LeafletMapProps {
  data: MapCoordinate[];
  loading?: boolean;
}

interface MapThemeColors {
  brandPrimary: string;
  mapMaskFill: string;
  mapMaskStroke: string;
  mapOcean: string;
}

// Sede da empresa (Garça/SP) — usado como fallback de centro/zoom quando não
// há nenhum imóvel com coordenadas no período (Tarefa 1.4 do guia de
// correções): sem isso o mapa ficava preso no zoom 4 do Brasil inteiro, que na
// prática lê como "mapa-mundi" em vez de mostrar a região de atuação.
const GARCA_SP_CENTER: [number, number] = [-22.2106, -49.6561];
const GARCA_SP_ZOOM = 14;

// Componente auxiliar para controlar o Zoom e a Máscara
function MapController({ 
  selectedLocation, 
  allLocations, 
  worldData,
  themeColors,
}: { 
  selectedLocation: MapCoordinate | null, 
  allLocations: MapCoordinate[],
  worldData: any,
  themeColors: MapThemeColors,
}) {
  const map = useMap();

  // 1. Lógica de Zoom Automático
  useEffect(() => {
    if (selectedLocation) {
      // Se selecionou um imóvel específico, voa baixo (Zoom 16 - Rua)
      map.flyTo([selectedLocation.lat, selectedLocation.lng], 16, {
        duration: 1.5
      });
    } else if (allLocations.length > 0) {
      // Se não tem seleção, ajusta a câmera para caber TODOS os imóveis
      const bounds = L.latLngBounds(allLocations.map(p => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    } else {
      // Sem nenhum imóvel com coordenadas: cai na sede (Garça/SP) em vez de
      // deixar a câmera presa no zoom inicial do Brasil inteiro.
      map.setView(GARCA_SP_CENTER, GARCA_SP_ZOOM);
    }
  }, [selectedLocation, allLocations, map]);

  // 2. Estilização da Máscara (Mundo Cinza vs Brasil Colorido)
  const geoJsonStyle = (feature: any) => {
    // Se for Brasil, deixa transparente para ver o mapa de ruas abaixo
    if (feature.properties.name === "Brazil") {
      return {
        fillColor: "transparent",
        fillOpacity: 0,
        color: themeColors.brandPrimary,
        weight: 2,
      };
    }
    // O resto do mundo fica com uma camada cinza por cima
    return {
      fillColor: themeColors.mapMaskFill,
      fillOpacity: 0.7,     // Opacidade alta para "apagar" o resto
      color: themeColors.mapMaskStroke,
      weight: 1,
    };
  };

  if (!worldData) return null;

  return (
    <GeoJSON 
      data={worldData} 
      style={geoJsonStyle} 
      // Desativa cliques nos países cinzas para não atrapalhar
      interactive={false} 
    />
  );
}

type StatusFilter = 'ALL' | 'OCCUPIED' | 'AVAILABLE';

interface MapCanvasProps {
  data: MapCoordinate[];
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

/**
 * Corpo do mapa (busca, marcadores, legenda) — usado tanto no card normal
 * quanto no overlay de tela cheia, cada um com sua própria instância do
 * Leaflet (MapContainer não pode ser reaproveitado entre containers DOM).
 */
function MapCanvas({ data, isFullscreen, onToggleFullscreen }: MapCanvasProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPoint, setSelectedPoint] = useState<MapCoordinate | null>(null);
  const [worldGeoJson, setWorldGeoJson] = useState<any>(null);
  // Clicar na legenda restringe os alfinetes exibidos ao status escolhido.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const { theme } = useTheme();
  const tokens = getThemeTokens();
  const isDark = theme === "dark";

  const tileUrl = getThemedTileUrl(isDark);
  const tileAttribution = getTileAttribution();

  // Carrega as fronteiras do mundo para fazer o efeito de máscara
  useEffect(() => {
    fetch("https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json")
      .then(res => res.json())
      .then(data => setWorldGeoJson(data))
      .catch(err => console.error("Erro ao carregar fronteiras:", err));
  }, []);

  const filteredData = useMemo(() => {
    if (statusFilter === 'ALL') return data;
    return data.filter((p) => (p.isLeased || p.status === 'OCCUPIED' ? 'OCCUPIED' : 'AVAILABLE') === statusFilter);
  }, [data, statusFilter]);

  // Filtra sugestões no input
  const filteredSuggestions = useMemo(() => {
    if (!searchTerm) return [];
    return filteredData.filter(item =>
      item.info.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, filteredData]);

  const handleSelect = (point: MapCoordinate) => {
    setSearchTerm(point.info);
    setSelectedPoint(point);
  };

  const handleClear = () => {
    setSearchTerm("");
    setSelectedPoint(null);
  };

  const toggleStatusFilter = (status: 'OCCUPIED' | 'AVAILABLE') => {
    setSelectedPoint(null);
    setStatusFilter((prev) => (prev === status ? 'ALL' : status));
  };

  const occupiedCount = useMemo(() => data.filter((p) => p.isLeased || p.status === 'OCCUPIED').length, [data]);
  const availableCount = data.length - occupiedCount;

  return (
    <div className="relative w-full h-full bg-surface rounded-xl border border-ui-border-strong shadow-sm overflow-hidden group z-0">

      {/* --- INPUT DE BUSCA FLUTUANTE --- */}
      <div className="absolute top-4 left-4 z-[1000] w-full max-w-md px-2">
        <div className="relative shadow-lg">
          <input
            type="text"
            placeholder="Buscar rua, bairro ou imóvel..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (!e.target.value) setSelectedPoint(null);
            }}
            className="w-full pl-10 pr-10 py-3 bg-surface border border-ui-border-soft rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all"
          />
          <div className="absolute left-3 top-3 text-content-placeholder">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
          {searchTerm && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-3 text-content-placeholder hover:text-content-secondary"
            >
              ✕
            </button>
          )}
        </div>

        {/* Lista de Sugestões */}
        {searchTerm && filteredSuggestions.length > 0 && !selectedPoint && (
          <div className="mt-2 bg-surface rounded-lg shadow-xl border border-ui-border-soft max-h-60 overflow-y-auto">
            {filteredSuggestions.map((item, idx) => (
              <div
                key={idx}
                className="px-4 py-3 text-sm text-content-secondary hover:bg-surface-subtle cursor-pointer border-b border-ui-border-soft last:border-0 truncate flex flex-col"
                onClick={() => handleSelect(item)}
              >
                <span className="font-medium text-content">{item.info}</span>
                <span className="text-xs text-content-muted">Clique para ver no mapa</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- BOTÃO DE TELA CHEIA --- */}
      <button
        type="button"
        onClick={onToggleFullscreen}
        title={isFullscreen ? "Fechar tela cheia" : "Ver mapa em tela cheia"}
        className="absolute top-4 right-4 z-[1000] p-2.5 bg-surface border border-ui-border-soft rounded-lg shadow-lg text-content-secondary hover:text-content hover:bg-surface-subtle transition-colors"
      >
        {isFullscreen ? <X size={18} /> : <Maximize2 size={18} />}
      </button>

      {/* --- MAPA --- */}
      <MapContainer
        center={GARCA_SP_CENTER} // Sede da empresa (Garça/SP) — MapController reajusta para os imóveis reais assim que `data` chega
        zoom={GARCA_SP_ZOOM}
        style={{ width: "100%", height: "100%", backgroundColor: tokens.mapOcean }}
        zoomControl={false} // Vamos reposicionar se quiser, ou deixar padrão
      >
        <TileLayer
          key={`leaflet-map-${theme}`}
          attribution={tileAttribution}
          url={tileUrl}
        />

        {/* 2. Camada de Máscara (Mundo Cinza) e Controlador de Zoom */}
        <MapController
          selectedLocation={selectedPoint}
          allLocations={filteredData}
          worldData={worldGeoJson}
          themeColors={{
            brandPrimary: tokens.brandPrimary,
            mapMaskFill: tokens.mapMaskFill,
            mapMaskStroke: tokens.mapMaskStroke,
            mapOcean: tokens.mapOcean,
          }}
        />

        {/* 3. Marcadores dos Imóveis */}
        {filteredData.map((point, idx) => {
          const isLeased = point.isLeased || point.status === 'OCCUPIED';
          return (
            <Marker
              key={idx}
              position={[point.lat, point.lng]}
              icon={isLeased ? leasedIcon : availableIcon}
              eventHandlers={{
                click: () => handleSelect(point),
              }}
            >
              {/* Hover mostra os dados do imóvel sem precisar clicar (sticky
                  acompanha o cursor em vez de ficar preso à ponta do pin). */}
              <Tooltip direction="top" offset={[0, -38]} opacity={1} sticky>
                <div className="text-xs">
                  <strong className={isLeased ? 'text-purple-600' : 'text-red-600'}>
                    {isLeased ? 'Imóvel Locado' : 'Disponível para Locação'}
                  </strong>
                  <div className="text-content-secondary">{point.info}</div>
                </div>
              </Tooltip>
              <Popup className="custom-popup">
                <div className="p-1">
                  <strong className={`block text-sm mb-1 ${isLeased ? 'text-purple-600' : 'text-red-600'}`}>
                    {isLeased ? 'Imóvel Locado' : 'Disponível para Locação'}
                  </strong>
                  <p className="text-content-secondary text-xs m-0">{point.info}</p>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Legenda Fixa — clicável: filtra os alfinetes exibidos por status.
          Clicar de novo no mesmo item volta a mostrar todos. */}
      <div className="absolute bottom-6 right-6 bg-surface backdrop-blur px-4 py-3 rounded-xl shadow-lg border border-ui-border-soft text-xs text-content-secondary z-[1000] flex flex-col gap-2">
        <button
          type="button"
          onClick={() => toggleStatusFilter('OCCUPIED')}
          title="Mostrar somente imóveis locados"
          className={`flex items-center gap-2 rounded-md px-1.5 py-1 -mx-1.5 transition-colors ${
            statusFilter === 'OCCUPIED' ? 'bg-[#8b5cf6]/10 ring-1 ring-[#8b5cf6]/40' : 'hover:bg-surface-subtle'
          }`}
        >
          <span className="w-3 h-3 rounded-full bg-[#8b5cf6] border border-surface shadow-sm shrink-0"></span>
          <span className="font-medium">Imóvel Locado (Roxo)</span>
          <span className="text-content-muted ml-auto">{occupiedCount}</span>
        </button>
        <button
          type="button"
          onClick={() => toggleStatusFilter('AVAILABLE')}
          title="Mostrar somente imóveis disponíveis"
          className={`flex items-center gap-2 rounded-md px-1.5 py-1 -mx-1.5 transition-colors ${
            statusFilter === 'AVAILABLE' ? 'bg-[#ef4444]/10 ring-1 ring-[#ef4444]/40' : 'hover:bg-surface-subtle'
          }`}
        >
          <span className="w-3 h-3 rounded-full bg-[#ef4444] border border-surface shadow-sm shrink-0"></span>
          <span className="font-medium">Disponível para Locação (Vermelho)</span>
          <span className="text-content-muted ml-auto">{availableCount}</span>
        </button>
        <div className="flex items-center gap-2 pt-1 border-t border-ui-border-soft text-[11px] text-content-muted">
          <span>
            {statusFilter === 'ALL'
              ? `Total de Imóveis: ${data.length}`
              : `Exibindo ${filteredData.length} de ${data.length} imóveis`}
          </span>
        </div>
      </div>

      <style jsx global>{`
        .leaflet-container {
          background-color: var(--color-map-ocean) !important;
        }
      `}</style>
    </div>
  );
}

export default function LeafletMap({ data = [], loading = false }: LeafletMapProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Trava o scroll do body e permite fechar com Esc enquanto em tela cheia.
  useEffect(() => {
    if (!isFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isFullscreen]);

  if (loading) {
    return (
      <div className="w-full h-[600px] flex items-center justify-center bg-surface-subtle rounded-xl border border-ui-border-soft">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
      </div>
    );
  }

  return (
    <>
      <div className="w-full h-[calc(100vh-140px)] min-h-[500px]">
        <MapCanvas data={data} isFullscreen={false} onToggleFullscreen={() => setIsFullscreen(true)} />
      </div>

      {isFullscreen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[1400] bg-black/60 p-3 sm:p-6">
          <div className="w-full h-full">
            <MapCanvas data={data} isFullscreen onToggleFullscreen={() => setIsFullscreen(false)} />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
