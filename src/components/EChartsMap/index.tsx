/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, GeoJSON } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTheme } from "@/contexts/ThemeContext";
import { getThemeTokens } from "@/util/getThemeTokens";

// Ícone personalizado (Pin Roxo)
const customIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface MapCoordinate {
  lat: number;
  lng: number;
  info: string;
}

interface LeafletMapProps {
  data: MapCoordinate[];
  loading?: boolean;
}

interface MapThemeColors {
  brandPrimary: string;
  mapOcean: string;
}

// Controlador do Mapa (Zoom e Máscara)
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

  // 1. Zoom Automático
  useEffect(() => {
    if (selectedLocation) {
      // Zoom no imóvel selecionado (Nível rua)
      map.flyTo([selectedLocation.lat, selectedLocation.lng], 16, {
        duration: 1.5
      });
    } else if (allLocations.length > 0) {
      // Enquadra todos os pinos
      const bounds = L.latLngBounds(allLocations.map(p => [p.lat, p.lng]));
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [selectedLocation, allLocations, map]);

  // 2. Estilo da Máscara (Mundo Sólido vs Brasil Transparente)
  const geoJsonStyle = (feature: any) => {
    // SELECIONADO (Brasil): Transparente para ver as ruas
    if (feature.properties.name === "Brazil") {
      return {
        fillColor: "transparent",
        fillOpacity: 0,
        color: themeColors.brandPrimary,
        weight: 2,
        dashArray: "5, 5"
      };
    }
    
    // RESTO DO MUNDO: Sólido Cinza (Bloqueia visão)
    return {
      fillColor: themeColors.mapOcean,
      fillOpacity: 1,       // Opacidade total para cobrir o mapa base
      color: themeColors.mapOcean,
      weight: 1,
    };
  };

  if (!worldData) return null;

  return (
    <GeoJSON 
      data={worldData} 
      style={geoJsonStyle} 
      interactive={false} 
    />
  );
}

export default function EChartsMap({ data = [], loading = false }: LeafletMapProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPoint, setSelectedPoint] = useState<MapCoordinate | null>(null);
  const [worldGeoJson, setWorldGeoJson] = useState<any>(null);
  const { theme } = useTheme();
  const tokens = getThemeTokens();
  const isDark = theme === "dark";
  
  // Controle de Foco do Input
  const [isFocused, setIsFocused] = useState(false);

  const tileUrl = isDark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  // Carrega GeoJSON do Mundo
  useEffect(() => {
    fetch("https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json")
      .then(res => res.json())
      .then(data => setWorldGeoJson(data))
      .catch(err => console.error("Erro ao carregar fronteiras:", err));
  }, []);

  // Filtra sugestões (Retorna TODOS se busca vazia)
  const filteredSuggestions = useMemo(() => {
    if (!searchTerm) return data; 
    return data.filter(item => 
      item.info.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, data]);

  const handleSelect = (point: MapCoordinate) => {
    setSearchTerm(point.info);
    setSelectedPoint(point);
    setIsFocused(false); // Fecha lista após selecionar
  };

  const handleClear = () => {
    setSearchTerm("");
    setSelectedPoint(null);
    setIsFocused(true); // Mantém focado para ver a lista novamente
  };

  if (loading) {
    return (
      <div className="w-full h-[600px] flex items-center justify-center bg-surface-subtle rounded-xl border border-ui-border-soft">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[calc(100vh-140px)] min-h-[500px] bg-map-surface rounded-xl border border-ui-border-strong shadow-sm overflow-hidden group z-0">
      
      {/* --- INPUT DE BUSCA --- */}
      <div className="absolute top-4 left-4 z-[1000] w-full max-w-md px-2">
        <div className="relative shadow-lg">
          <input
            type="text"
            placeholder="Buscar imóvel..."
            value={searchTerm}
            onFocus={() => setIsFocused(true)} 
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (!e.target.value) setSelectedPoint(null);
            }}
            className="w-full pl-10 pr-10 py-3 bg-surface backdrop-blur border border-ui-border-soft rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all"
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
        
        {/* LISTA DE SUGESTÕES (Aparece no Focus) */}
        {isFocused && filteredSuggestions.length > 0 && (
          <div className="mt-2 bg-surface rounded-lg shadow-xl border border-ui-border-soft max-h-60 overflow-y-auto">
            {filteredSuggestions.map((item, idx) => (
              <div 
                key={idx}
                className="px-4 py-3 text-sm text-content-secondary hover:bg-surface-subtle cursor-pointer border-b border-ui-border-soft last:border-0 truncate flex flex-col"
                onMouseDown={() => handleSelect(item)} // onMouseDown executa antes do onBlur
              >
                <span className="font-medium text-content">{item.info}</span>
                <span className="text-xs text-content-muted">Clique para localizar</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- MAPA --- */}
      <MapContainer 
        center={[-14.2350, -51.9253]} 
        zoom={4} 
        style={{ width: "100%", height: "100%", backgroundColor: tokens.mapOcean }}
        zoomControl={false} 
      >
        <TileLayer
          key={`echarts-map-${theme}`}
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url={tileUrl}
        />

        {/* Máscara Global */}
          <MapController 
          selectedLocation={selectedPoint} 
          allLocations={data}
          worldData={worldGeoJson}
          themeColors={{ brandPrimary: tokens.brandPrimary, mapOcean: tokens.mapOcean }}
        />

        {/* Marcadores */}
        {data.map((point, idx) => (
          <Marker 
            key={idx} 
            position={[point.lat, point.lng]} 
            icon={customIcon}
            eventHandlers={{
              click: () => handleSelect(point),
            }}
          >
            <Popup className="custom-popup">
              <div className="p-1">
                <strong className="block text-sm text-brand-hover mb-1">Imóvel Encontrado</strong>
                <p className="text-content-secondary text-xs m-0">{point.info}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      
      {/* Legenda */}
      <div className="absolute bottom-6 right-6 bg-surface backdrop-blur px-4 py-3 rounded-xl shadow-lg border border-ui-border-soft text-xs text-content-secondary z-[1000] flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-brand border border-surface shadow-sm"></span>
          <span className="font-medium">{data.length} Imóveis Disponíveis</span>
        </div>
      </div>

      {/* Ajustes Globais de Estilo */}
      <style jsx global>{`
        .leaflet-container {
          background-color: var(--color-map-ocean) !important;
        }
      `}</style>
    </div>
  );
}
