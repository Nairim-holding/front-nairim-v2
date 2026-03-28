'use client';

import { useRef, useCallback } from 'react';
import { useMessageContext } from '@/contexts/MessageContext';

export interface CepResult {
  street: string;
  district: string;
  city: string;
  state: string;
  country: string;
  complement: string;
}

/**
 * Returns a `lookupCep` function that, given a masked CEP string,
 * calls the internal /api/cep route and returns the address fields
 * to be merged into the form, or `null` on failure.
 *
 * Also returns `isManualAddress` setter so callers can unlock fields on 404.
 */
export function useCepLookup(setIsManualAddress: (v: boolean) => void) {
  const { showMessage } = useMessageContext();
  const lastFetchedCep = useRef('');

  const lookupCep = useCallback(
    async (value: string): Promise<Partial<CepResult> | null> => {
      const clean = value.replace(/\D/g, '');
      if (clean.length !== 8 || clean === lastFetchedCep.current) return null;

      lastFetchedCep.current = clean;
      showMessage('Buscando CEP...', 'info');

      try {
        const res = await fetch(`/api/cep/${clean}`);

        if (!res.ok) {
          if (res.status === 404) {
            setIsManualAddress(true);
            showMessage('CEP não encontrado. Preencha o endereço manualmente.', 'error');
            return { street: '', district: '', city: '', state: '' };
          }
          throw new Error(`Erro ${res.status}`);
        }

        const data = await res.json();

        if (data.error || data.erro) {
          throw new Error(data.error || 'CEP não encontrado.');
        }

        setIsManualAddress(false);
        showMessage('Endereço preenchido automaticamente!', 'success');

        return {
          street:     data.rua        ?? '',
          district:   data.bairro     ?? '',
          city:       data.cidade     ?? '',
          state:      data.estado     ?? '',
          country:    data.pais       ?? 'Brasil',
          complement: data.complemento ?? '',
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro ao buscar CEP.';
        showMessage(msg, 'error');
        setIsManualAddress(true);
        return null;
      }
    },
    [showMessage, setIsManualAddress],
  );

  return { lookupCep };
}
