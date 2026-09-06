'use client';

import { useEffect, useRef, useState } from 'react';
import { addressIdentity, type LocationAddress } from '@/shared/utils/property-location';
import { locationSuggestionSchema, type LocationSuggestion } from '@/shared/validators/location-suggestion';

export function useLocationSuggestion(address: LocationAddress, confirmed: boolean, readOnly: boolean, apply: (suggestion: LocationSuggestion | null) => void, hasPoint: boolean) {
  const identity = addressIdentity(address);
  // Opening an existing draft must not replace its point. Editing the address may suggest a new one.
  const initial = useRef({ identity, hasPoint });
  const latest = useRef({ address, apply });
  const active = useRef<AbortController | null>(null);
  const manual = useRef<string | null>(null);
  const [feedback, setFeedback] = useState({ identity: '', text: '' });
  useEffect(() => { latest.current = { address, apply }; });

  useEffect(() => {
    if (initial.current.identity !== identity) initial.current.hasPoint = false;
    if (confirmed || readOnly || manual.current === identity || (initial.current.hasPoint && initial.current.identity === identity)) return;
    const parsed = locationSuggestionSchema.safeParse(latest.current.address);
    if (!parsed.success) return;
    const setMessage = (text: string) => setFeedback({ identity, text });
    const controller = new AbortController();
    active.current = controller;
    const timer = setTimeout(async () => {
      if (controller.signal.aborted) return;
      latest.current.apply(null);
      setMessage('Buscando uma sugestão de localização...');
      try {
        const response = await fetch('/api/properties/location-suggestion', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed.data), signal: controller.signal,
        });
        const result = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok || !result.ok || result.data.status === 'unavailable') {
          setMessage('Busca indisponível. Posicione o pin manualmente.'); return;
        }
        if (result.data.status === 'unconfigured') {
          setMessage('Busca automática ainda não configurada. Você pode posicionar o pin manualmente.'); return;
        }
        const suggestion: LocationSuggestion | null = result.data.suggestion;
        if (!suggestion) { setMessage('Endereço não localizado. Posicione o pin manualmente.'); return; }
        latest.current.apply(suggestion);
        setMessage(suggestion.precision === 'approximate'
          ? 'Localização aproximada da rua ou bairro. Ajuste o pin para o imóvel e confirme.'
          : 'Endereço sugerido. Confira o ponto, ajuste se necessário e confirme.');
      } catch {
        if (!controller.signal.aborted) setMessage('Busca indisponível. Posicione o pin manualmente.');
      }
    }, 1200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [identity, confirmed, readOnly]);

  const preserveManualPoint = () => {
    manual.current = identity;
    active.current?.abort();
    setFeedback({ identity, text: '' });
  };
  return { message: confirmed || feedback.identity !== identity ? '' : feedback.text, preserveManualPoint };
}
