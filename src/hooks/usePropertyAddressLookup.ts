'use client';

import { useCallback, useEffect, useRef } from 'react';

/** Postal lookup never writes coordinates or confirmation. */
export function usePropertyAddressLookup(showMessage: (message: string, type: 'info' | 'success' | 'error') => void) {
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  const handleFieldChange = useCallback(async (field: string, value: unknown) => {
    if (field === 'category_id') return { subcategory_id: '' };
    if (['street', 'number', 'district', 'city', 'state', 'country', 'location'].includes(field)) request.current?.abort();
    if (field !== 'zip_code') return null;
    request.current?.abort();
    const cep = String(value ?? '').replace(/\D/g, '');
    if (cep.length !== 8) return null;
    const controller = new AbortController();
    request.current = controller;
    try {
      showMessage('Buscando CEP...', 'info');
      const response = await fetch(`/api/cep/${cep}`, { signal: controller.signal });
      if (!response.ok) throw new Error('CEP não encontrado');
      const data = await response.json();
      if (controller.signal.aborted) return null;
      const street = data.rua || data.logradouro || '';
      showMessage(street ? 'Endereço preenchido. Confira a localização no mapa.' : 'Preencha a rua e confira a localização no mapa.', 'info');
      return {
        street,
        district: data.bairro || '',
        city: data.cidade || data.localidade || '',
        state: data.estado || data.uf || '',
        country: 'Brasil',
      };
    } catch {
      if (controller.signal.aborted) return null;
      showMessage('Não foi possível consultar o CEP. Preencha o endereço manualmente.', 'error');
      return null;
    }
  }, [showMessage]);

  return { handleFieldChange };
}
