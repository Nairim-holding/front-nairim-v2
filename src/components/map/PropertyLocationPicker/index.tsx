'use client';

import dynamic from 'next/dynamic';
import { useLocationSuggestion } from '@/hooks/useLocationSuggestion';
import { coordinate, isLocationConfirmed, locationConfirmation, type LocationAddress } from '@/shared/utils/property-location';

const PointMap = dynamic(() => import('./PointMap'), { ssr: false, loading: () => <div className="h-80 bg-surface-subtle rounded-lg">Carregando mapa...</div> });

export interface LocationDraft {
  latitude?: number | string | null;
  longitude?: number | string | null;
  location_confirmation?: string | null;
}

interface Props {
  value?: LocationDraft;
  address: LocationAddress;
  onChange?: (value: LocationDraft) => void;
  readOnly?: boolean;
}

export default function PropertyLocationPicker({ value, address, onChange, readOnly = false }: Props) {
  const draft: LocationDraft = value && !Array.isArray(value) ? value : {
    latitude: coordinate(address.latitude, 90), longitude: coordinate(address.longitude, 180),
    location_confirmation: address.location_confirmation,
  };
  const current = { ...address, ...draft };
  const lat = coordinate(draft.latitude, 90);
  const lng = coordinate(draft.longitude, 180);
  const point: [number, number] | null = lat !== null && lng !== null ? [lat, lng] : null;
  const confirmed = isLocationConfirmed(current);
  const { message, preserveManualPoint } = useLocationSuggestion(address, confirmed, readOnly, suggestion => {
    onChange?.({ latitude: suggestion?.latitude ?? null, longitude: suggestion?.longitude ?? null, location_confirmation: null });
  }, point !== null);
  const change = (update: Partial<LocationDraft>) => {
    preserveManualPoint();
    onChange?.({ ...draft, ...update, location_confirmation: null });
  };
  const query = [address.street, address.number, address.district, address.city, address.state, address.country || 'Brasil'].filter(Boolean).join(', ');

  return (
    <div className="space-y-3 rounded-lg border border-ui-border-soft p-4">
      <p role="status" className="font-medium text-content">{confirmed ? 'Localização confirmada' : 'Localização pendente de confirmação'}</p>
      <p className="text-sm text-content-secondary">
        {readOnly ? 'Somente localizações confirmadas aparecem no mapa da dashboard.' : 'Clique no local do imóvel ou arraste o pin. Confira o ponto e confirme abaixo. Pontos antigos são apenas referência até a confirmação.'}
      </p>
      {message && <p aria-live="polite" className="text-sm text-content-secondary">{message}</p>}
      <PointMap point={point} readOnly={readOnly} onChange={(latitude, longitude) => change({ latitude, longitude })} />
      {!readOnly && <>
        <a className="text-sm text-brand underline" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`} target="_blank" rel="noopener noreferrer">Consultar endereço no Google Maps</a>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-sm">Latitude
            <input aria-label="Latitude do imóvel" type="number" min={-90} max={90} step="any" value={draft.latitude ?? ''} onChange={e => change({ latitude: e.target.value })} className="block w-full border border-ui-border-soft rounded p-2 bg-surface" placeholder="Ex.: -22.2128484" />
          </label>
          <label className="text-sm">Longitude
            <input aria-label="Longitude do imóvel" type="number" min={-180} max={180} step="any" value={draft.longitude ?? ''} onChange={e => change({ longitude: e.target.value })} className="block w-full border border-ui-border-soft rounded p-2 bg-surface" placeholder="Ex.: -49.6530038" />
          </label>
        </div>
        {((draft.latitude !== null && draft.latitude !== undefined && draft.latitude !== '' && lat === null)
          || (draft.longitude !== null && draft.longitude !== undefined && draft.longitude !== '' && lng === null)) &&
          <p role="alert" className="text-sm text-red-600">Use latitude entre -90 e 90 e longitude entre -180 e 180.</p>}
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={!locationConfirmation(current) || confirmed} onClick={() => { preserveManualPoint(); onChange?.({ ...draft, location_confirmation: locationConfirmation(current) }); }} className="rounded bg-brand text-white px-4 py-2 disabled:opacity-50">Confirmar localização do imóvel</button>
          <button type="button" onClick={() => change({ latitude: null, longitude: null })} className="rounded border border-ui-border-soft px-4 py-2">Remover ponto</button>
        </div>
        <p className="text-sm text-content-secondary">Salve o cadastro para aplicar. Se o endereço ou o ponto mudar, confirme novamente. É possível salvar pendente e revisar depois.</p>
        <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer" className="text-xs underline text-content-secondary">Powered by Geoapify</a>
      </>}
    </div>
  );
}
