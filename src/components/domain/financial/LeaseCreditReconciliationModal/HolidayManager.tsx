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
import { BRAZIL_STATES, holidayWeekday, type HolidayScope } from '@/core/entities/holidays';
import { creditDateError } from '@/components/ui/Input/date-edit';

interface Props {
  year: number;
  onError: (message: string) => void;
  onChanged: () => void;
}

export default function HolidayManager({ year, onError, onChanged }: Props) {
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [date, setDate] = useState(`${year}-01-01`);
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState<HolidayScope>('NATIONAL');
  const [state, setState] = useState('');
  const [dateError, setDateError] = useState('');
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
    const message = creditDateError(date);
    setDateError(message);
    if (message) return;
    onError('');
    setIsSaving(true);
    const result = await createHolidayAction({ date, description, scope, city, state });
    setIsSaving(false);
    if (!result.ok) {
      onError(describeActionError(result, 'Não foi possível cadastrar o feriado.'));
      return;
    }
    setDescription('');
    onChanged();
    await load();
  };

  const remove = async (id: string) => {
    const result = await deleteHolidayAction(id);
    if (!result.ok) {
      onError(describeActionError(result, 'Não foi possível excluir o feriado.'));
      return;
    }
    setHolidays((current) => current.filter((holiday) => holiday.id !== id));
    onChanged();
  };

  return (
    <details className="rounded-lg border border-ui-border-soft">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-content">Feriados de {year}</summary>
      <div className="border-t border-ui-border-soft p-3 space-y-3">
        <p className="text-xs text-content-muted">Os feriados nacionais, incluindo a Paixão de Cristo, são preenchidos automaticamente para cada ano. O feriado estadual de São Paulo e os municipais de Garça também são incluídos conforme o endereço dos imóveis. Cadastre abaixo outros feriados da sua região.</p>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
          <Input id="holiday-date" label="Data" type="date" value={date} onChange={(event) => { setDate(event.target.value); setDateError(''); }} onBlur={() => setDateError(creditDateError(date))} full />
          <div className="md:col-span-2">
            <Input id="holiday-description" label="Descrição" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: Corpus Christi" full />
          </div>
          <Select
            id="holiday-scope"
            label="Abrangência"
            value={scope}
            onChange={(value) => setScope(String(value) as HolidayScope)}
            options={[
              { value: 'NATIONAL', label: 'Nacional' },
              { value: 'STATE', label: 'Estadual' },
              { value: 'MUNICIPAL', label: 'Municipal' },
            ]}
            full
          />
          {scope !== 'NATIONAL' && <Select id="holiday-state" label="Estado (UF)" value={state} onChange={(value) => setState(String(value))} options={BRAZIL_STATES.map((uf) => ({ value: uf, label: uf }))} placeholder="Selecione a UF" searchable full />}
          {scope === 'MUNICIPAL' && (
            <Input id="holiday-city" label="Cidade" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Cidade" full />
          )}
        </div>
        {dateError && <p role="alert" className="text-sm text-red-700">{dateError}</p>}
        <div className="flex justify-end"><button onClick={create} disabled={isSaving || !description.trim() || (scope !== 'NATIONAL' && !state) || (scope === 'MUNICIPAL' && !city.trim())} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-brand text-white text-sm disabled:opacity-50"><Plus size={15} /> {isSaving ? 'Salvando...' : 'Adicionar'}</button></div>
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-surface"><tr>{['Data', 'Descrição', 'Dia da semana', 'Abrangência', 'Localidade', 'Ações'].map((label) => <th key={label} className="p-2 font-medium text-content-muted whitespace-nowrap">{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-ui-border-soft">
          {holidays.map((holiday) => (
            <tr key={holiday.id} className="text-content">
              <td className="p-2 whitespace-nowrap">{holiday.date.split('-').reverse().join('/')}</td>
              <td className="p-2">{holiday.description}</td>
              <td className="p-2 whitespace-nowrap">{holidayWeekday(holiday.date)}</td>
              <td className="p-2">{{ NATIONAL: 'Nacional', STATE: 'Estadual', MUNICIPAL: 'Municipal' }[holiday.scope]}</td>
              <td className="p-2">{[holiday.city, holiday.state].filter(Boolean).join(' / ') || 'Brasil'}</td>
              <td className="p-2">{holiday.automatic ? <span className="text-xs text-content-muted">Automático</span> : <button onClick={() => remove(holiday.id)} className="p-1.5 rounded hover:bg-red-50" aria-label={`Excluir ${holiday.description}`}><Trash2 size={15} className="text-red-600" /></button>}</td>
            </tr>
          ))}
            </tbody>
          </table>
          {holidays.length === 0 && <p className="py-2 text-xs text-content-muted">Carregando feriados...</p>}
        </div>
      </div>
    </details>
  );
}
