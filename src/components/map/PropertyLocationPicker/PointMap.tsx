'use client';

import { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getTileUrl, getTileAttribution } from '@/utils';

const icon = L.divIcon({
  className: '',
  html: '<svg width="28" height="40" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg"><path d="M14 39S1 23 1 14a13 13 0 0 1 26 0c0 9-13 25-13 25Z" fill="#7c3aed" stroke="white" stroke-width="2"/><circle cx="14" cy="14" r="5" fill="white"/></svg>',
  iconSize: [28, 40], iconAnchor: [14, 40],
});

interface Props { point: [number, number] | null; readOnly: boolean; onChange: (lat: number, lng: number) => void }

function Controls({ point, readOnly, onChange }: Props) {
  const map = useMap();
  const lat = point?.[0];
  const lng = point?.[1];
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  useEffect(() => {
    if (lat !== undefined && lng !== undefined) map.setView([lat, lng], Math.max(map.getZoom(), 17));
  }, [lat, lng, map]);
  useMapEvents({ click: e => { if (!readOnly) onChange(e.latlng.lat, e.latlng.lng); } });
  return null;
}

export default function PointMap(props: Props) {
  return <div className="relative z-0 h-80 overflow-hidden rounded-lg" aria-label="Mapa para conferir a localização do imóvel">
    <MapContainer center={props.point ?? [-22.2106, -49.6561]} zoom={props.point ? 17 : 14} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
      <TileLayer url={getTileUrl('light_all')} attribution={getTileAttribution()} />
      <Controls {...props} />
      {props.point && <Marker position={props.point} icon={icon} draggable={!props.readOnly} eventHandlers={{ dragend: e => {
        const p = (e.target as L.Marker).getLatLng(); props.onChange(p.lat, p.lng);
      } }} />}
    </MapContainer>
  </div>;
}
