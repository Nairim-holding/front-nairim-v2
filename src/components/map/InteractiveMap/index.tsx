/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap, GeoJSON } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Filter, Maximize2, X } from "lucide-react";
import { getPropertyMapStatus, type PropertyMapStatus } from '@/core/entities/property-map';
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
const soldIcon = createPinIcon("#374151"); // Cinza escuro (Vendido)

const STATUS_OPTIONS = [
  { status: 'OCCUPIED', label: 'Locados', color: '#8b5cf6', icon: leasedIcon, title: 'Imóvel Locado', textClass: 'text-purple-600' },
  { status: 'AVAILABLE', label: 'Disponíveis', color: '#ef4444', icon: availableIcon, title: 'Disponível para Locação', textClass: 'text-red-600' },
  { status: 'SOLD', label: 'Vendidos', color: '#374151', icon: soldIcon, title: 'Imóvel Vendido', textClass: 'text-gray-700 dark:text-gray-300' },
] as const;
const ALL_STATUSES: PropertyMapStatus[] = STATUS_OPTIONS.map(option => option.status);

interface MapCoordinate {
  lat: number;
  lng: number;
  info: string;
  isLeased?: boolean;
  status?: PropertyMapStatus;
  propertyId?: string;
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
      // Trocas rápidas de filtro/tela cheia não deixam uma transição de zoom pendente.
      map.fitBounds(bounds, { padding: [50, 50], animate: false });
    } else {
      // Sem nenhum imóvel com coordenadas: cai na sede (Garça/SP) em vez de
      // deixar a câmera presa no zoom inicial do Brasil inteiro.
      map.setView(GARCA_SP_CENTER, GARCA_SP_ZOOM, { animate: false });
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

interface MapCanvasProps {
  data: MapCoordinate[];
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  selectedStatuses: PropertyMapStatus[];
  onStatusesChange: (statuses: PropertyMapStatus[]) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  selectedPoint: MapCoordinate | null;
  onSelect: (point: MapCoordinate | null) => void;
}

/**
 * Corpo do mapa (busca, marcadores, legenda) — usado tanto no card normal
 * quanto no overlay de tela cheia, cada um com sua própria instância do
 * Leaflet (MapContainer não pode ser reaproveitado entre containers DOM).
 */
function MapCanvas({ data, isFullscreen, onToggleFullscreen, selectedStatuses, onStatusesChange, searchTerm, onSearchChange, selectedPoint, onSelect }: MapCanvasProps) {
  const [worldGeoJson, setWorldGeoJson] = useState<any>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!isFilterOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!filterRef.current?.contains(event.target as Node)) setIsFilterOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [isFilterOpen]);

  const filteredData = useMemo(() => {
    const search = searchTerm.trim().toLocaleLowerCase('pt-BR');
    return data.filter(point => selectedStatuses.includes(getPropertyMapStatus(point)) &&
      (!search || point.info.toLocaleLowerCase('pt-BR').includes(search)));
  }, [data, selectedStatuses, searchTerm]);

  // Filtra sugestões no input
  const filteredSuggestions = useMemo(() => {
    if (!searchTerm) return [];
    return filteredData;
  }, [searchTerm, filteredData]);

  const handleSelect = (point: MapCoordinate) => {
    onSearchChange(point.info);
    onSelect(point);
  };

  const handleClear = () => {
    onSearchChange("");
    onSelect(null);
  };

  const toggleStatusFilter = (status: PropertyMapStatus) => {
    onStatusesChange(selectedStatuses.includes(status)
      ? selectedStatuses.filter(selected => selected !== status)
      : [...selectedStatuses, status]);
  };
  const statusCounts = useMemo(() => STATUS_OPTIONS.map(option => ({
    ...option, count: data.filter(point => getPropertyMapStatus(point) === option.status).length,
  })), [data]);

  return (
    <div className="relative w-full h-full bg-surface rounded-xl border border-ui-border-strong shadow-sm overflow-hidden group z-0">

      {/* --- INPUT DE BUSCA FLUTUANTE --- */}
      <div className="absolute top-4 left-4 right-16 z-[1000] max-w-xl">
        <div className="flex gap-2">
        <div className="relative shadow-lg flex-1 min-w-0">
          <input
            type="text"
            placeholder="Buscar rua, bairro ou imóvel..."
            value={searchTerm}
            onChange={(e) => {
              onSearchChange(e.target.value);
              onSelect(null);
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
              aria-label="Limpar busca de endereço"
              className="absolute right-3 top-3 text-content-placeholder hover:text-content-secondary"
            >
              ✕
            </button>
          )}
        </div>

        <div ref={filterRef} className="relative shrink-0">
          <button
            type="button"
            aria-label="Filtrar imóveis por status"
            aria-expanded={isFilterOpen}
            onClick={() => setIsFilterOpen(open => !open)}
            className="h-full flex items-center gap-2 px-3 py-3 bg-surface border border-ui-border-soft rounded-lg shadow-lg text-sm text-content-secondary hover:bg-surface-subtle"
          >
            <Filter size={18} />
            <span className="hidden sm:inline">Filtro</span>
            {selectedStatuses.length !== ALL_STATUSES.length && <span className="text-xs font-semibold">{selectedStatuses.length}</span>}
          </button>
          {isFilterOpen && (
            <div className="absolute top-full right-0 mt-2 w-56 bg-surface rounded-lg shadow-xl border border-ui-border-soft p-3 text-sm text-content">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold">Status dos imóveis</span>
                <button type="button" onClick={() => onStatusesChange(ALL_STATUSES)} className="text-brand hover:underline">Todos</button>
              </div>
              <div role="group" aria-label="Status dos imóveis" className="space-y-2">
                {STATUS_OPTIONS.map(option => (
                  <label key={option.status} className="flex items-center gap-2 cursor-pointer rounded-md p-1 hover:bg-surface-subtle">
                    <input type="checkbox" checked={selectedStatuses.includes(option.status)} onChange={() => toggleStatusFilter(option.status)} className="accent-brand" />
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: option.color }} />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
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
        {filteredData.length === 0 && (
          <p role="status" className="mt-2 bg-surface rounded-lg shadow-lg border border-ui-border-soft p-3 text-sm text-content-secondary">
            Nenhum imóvel encontrado para os filtros selecionados.
          </p>
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
          selectedLocation={selectedPoint && filteredData.includes(selectedPoint) ? selectedPoint : null}
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
          const option = STATUS_OPTIONS.find(option => option.status === getPropertyMapStatus(point))!;
          return (
            <Marker
              key={`${point.propertyId ?? idx}-${point.lat}-${point.lng}`}
              position={[point.lat, point.lng]}
              icon={option.icon}
              alt={`${option.title}: ${point.info}`}
              eventHandlers={{
                click: () => handleSelect(point),
              }}
            >
              {/* Hover mostra os dados do imóvel sem precisar clicar (sticky
                  acompanha o cursor em vez de ficar preso à ponta do pin). */}
              <Tooltip direction="top" offset={[0, -38]} opacity={1} sticky>
                <div className="text-xs">
                  <strong className={option.textClass}>
                    {option.title}
                  </strong>
                  <div className="text-content-secondary">{point.info}</div>
                </div>
              </Tooltip>
              <Popup className="custom-popup">
                <div className="p-1">
                  <strong className={`block text-sm mb-1 ${option.textClass}`}>
                    {option.title}
                  </strong>
                  <p className="text-content-secondary text-xs m-0">{point.info}</p>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* A legenda oferece atalhos para um status; o filtro permite combinar vários. */}
      <div className="absolute bottom-6 right-6 bg-surface backdrop-blur px-4 py-3 rounded-xl shadow-lg border border-ui-border-soft text-xs text-content-secondary z-[1000] flex flex-col gap-2">
        {statusCounts.map(option => (
          <button key={option.status} type="button"
            onClick={() => onStatusesChange(selectedStatuses.length === 1 && selectedStatuses[0] === option.status ? ALL_STATUSES : [option.status])}
            title={`Mostrar somente imóveis ${option.label.toLowerCase()}`}
            aria-pressed={selectedStatuses.length === 1 && selectedStatuses[0] === option.status}
            className="flex items-center gap-2 rounded-md px-1.5 py-1 -mx-1.5 transition-colors hover:bg-surface-subtle aria-pressed:bg-surface-subtle aria-pressed:ring-1 aria-pressed:ring-ui-border-strong"
          >
            <span className="w-3 h-3 rounded-full border border-surface shadow-sm shrink-0" style={{ backgroundColor: option.color }} />
            <span className="font-medium">{option.label}</span>
            <span className="text-content-muted ml-auto">{option.count}</span>
          </button>
        ))}
        <div className="flex items-center gap-2 pt-1 border-t border-ui-border-soft text-[11px] text-content-muted">
          <span>
            {selectedStatuses.length === ALL_STATUSES.length && !searchTerm
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
  const [selectedStatuses, setSelectedStatuses] = useState<PropertyMapStatus[]>(ALL_STATUSES);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPoint, setSelectedPoint] = useState<MapCoordinate | null>(null);
  const selectionProps = {
    selectedStatuses, searchTerm, selectedPoint,
    onSearchChange: setSearchTerm,
    onSelect: setSelectedPoint,
    onStatusesChange: (statuses: PropertyMapStatus[]) => {
      setSelectedStatuses(statuses);
      setSelectedPoint(null);
    },
  };

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
        <MapCanvas data={data} {...selectionProps} isFullscreen={false} onToggleFullscreen={() => setIsFullscreen(true)} />
      </div>

      {isFullscreen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[1400] bg-black/60 p-3 sm:p-6">
          <div className="w-full h-full">
            <MapCanvas data={data} {...selectionProps} isFullscreen onToggleFullscreen={() => setIsFullscreen(false)} />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
