'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  createHolidayAction,
  deleteHolidayAction,
  listHolidaysAction,
  type HolidayItem,
} from '@/server/actions/holiday';
import { describeActionError } from '@/shared/actions/action-result';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';

interface Props {
  year: number;
  onError: (message: string) => void;
}

export default function HolidayManager({ year, onError }: Props) {
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [date, setDate] = useState(`${year}-01-01`);
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState<'NATIONAL' | 'MUNICIPAL'>('NATIONAL');
  const [city, setCity] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    const result = await listHolidaysAction({ year });
    if (result.ok) setHolidays(result.data);
    else onError(describeActionError(result, 'Não foi possível carregar os feriados.'));
  }, [year, onError]);

  useEffect(() => {
    let active = true;
    listHolidaysAction({ year }).then((result) => {
      if (!active) return;
      if (result.ok) setHolidays(result.data);
      else onError(describeActionError(result, 'Não foi possível carregar os feriados.'));
    });
    return () => { active = false; };
  }, [year, onError]);

  const create = async () => {
    setIsSaving(true);
    const result = await createHolidayAction({ date, description, scope, city });
    setIsSaving(false);
    if (!result.ok) {
      onError(describeActionError(result, 'Não foi possível cadastrar o feriado.'));
      return;
    }
    setDescription('');
    await load();
  };

  const remove = async (id: string) => {
    const result = await deleteHolidayAction(id);
    if (!result.ok) {
      onError(describeActionError(result, 'Não foi possível excluir o feriado.'));
      return;
    }
    setHolidays((current) => current.filter((holiday) => holiday.id !== id));
  };

  return (
    <details className="rounded-lg border border-ui-border-soft">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-content">Cadastrar feriados de {year}</summary>
      <div className="border-t border-ui-border-soft p-3 space-y-3">
        <p className="text-xs text-content-muted">Os feriados nacionais de data fixa já são reconhecidos automaticamente. Cadastre aqui datas móveis e feriados municipais.</p>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
          <Input id="holiday-date" label="Data" type="date" value={date} onChange={(event) => setDate(event.target.value)} full />
          <div className="md:col-span-2">
            <Input id="holiday-description" label="Descrição" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: Corpus Christi" full />
          </div>
          <Select
            id="holiday-scope"
            label="Abrangência"
            value={scope}
            onChange={(value) => setScope(String(value) as 'NATIONAL' | 'MUNICIPAL')}
            options={[
              { value: 'NATIONAL', label: 'Nacional' },
              { value: 'MUNICIPAL', label: 'Municipal' },
            ]}
            full
          />
          {scope === 'MUNICIPAL' ? (
            <Input id="holiday-city" label="Cidade" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Cidade" full />
          ) : (
            <button onClick={create} disabled={isSaving || !description} className="inline-flex h-10 justify-center items-center gap-1 rounded-lg bg-brand px-3 text-white text-sm disabled:opacity-50"><Plus size={15} /> Adicionar</button>
          )}
        </div>
        {scope === 'MUNICIPAL' && (
          <div className="flex justify-end"><button onClick={create} disabled={isSaving || !description || !city} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-brand text-white text-sm disabled:opacity-50"><Plus size={15} /> Adicionar</button></div>
        )}
        <div className="max-h-36 overflow-y-auto divide-y divide-ui-border-soft">
          {holidays.map((holiday) => (
            <div key={holiday.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="text-content"><strong>{holiday.date.split('-').reverse().join('/')}</strong> · {holiday.description}{holiday.city ? ` · ${holiday.city}` : ''}</span>
              <button onClick={() => remove(holiday.id)} className="p-1.5 rounded hover:bg-red-50" aria-label="Excluir feriado"><Trash2 size={15} className="text-red-600" /></button>
            </div>
          ))}
          {holidays.length === 0 && <p className="py-2 text-xs text-content-muted">Nenhum feriado adicional cadastrado.</p>}
        </div>
      </div>
    </details>
  );
}
