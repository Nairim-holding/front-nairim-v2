/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import Checkbox from '@/components/ui/Checkbox';
import { getUserScheduleAction } from '@/server/actions/user';

export interface AccessScheduleRow {
  day_of_week: number; // 0=Domingo ... 6=Sábado (Date.getDay())
  start_time: string; // "HH:MM"
  end_time: string; // "HH:MM"
}

interface AccessScheduleGridProps {
  /** Lista de intervalos, no mesmo shape que a API espera. */
  value?: AccessScheduleRow[];
  onChange?: (value: AccessScheduleRow[]) => void;
  /** Em edição/visualização: carrega a jornada já salva deste usuário. */
  userId?: string;
  disabled?: boolean;
}

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

/** Linhas (intervalos) → grade 7×24 para renderizar. Granularidade de hora
 *  cheia: cada célula representa o bloco [h:00, h+1:00). */
function expandToGrid(rows: AccessScheduleRow[]): boolean[][] {
  const grid = Array.from({ length: 7 }, () => Array(24).fill(false));
  for (const row of rows) {
    const startHour = parseInt(row.start_time.split(':')[0], 10);
    const endHour = parseInt(row.end_time.split(':')[0], 10);
    if (!grid[row.day_of_week]) continue;
    for (let h = startHour; h < endHour; h++) {
      grid[row.day_of_week][h] = true;
    }
  }
  return grid;
}

/** Grade → linhas, mesclando células contíguas marcadas em um único intervalo
 *  por bloco (ex.: 08–12 e 13–19 viram duas linhas, não seis). */
function compressFromGrid(grid: boolean[][]): AccessScheduleRow[] {
  const rows: AccessScheduleRow[] = [];
  for (let day = 0; day < 7; day++) {
    let start: number | null = null;
    for (let h = 0; h <= 24; h++) {
      const active = h < 24 && grid[day][h];
      if (active && start === null) start = h;
      if (!active && start !== null) {
        rows.push({
          day_of_week: day,
          start_time: `${String(start).padStart(2, '0')}:00`,
          end_time: `${String(h).padStart(2, '0')}:00`,
        });
        start = null;
      }
    }
  }
  return rows;
}

export default function AccessScheduleGrid({
  value,
  onChange,
  userId,
  disabled = false,
}: AccessScheduleGridProps) {
  const [isLoading, setIsLoading] = useState(!!userId);
  const [error, setError] = useState<string | null>(null);

  // Jornada já salva (edição/visualização). Publica via onChange para que o
  // submit da página consiga enviá-la — mesmo padrão da matriz de permissões.
  useEffect(() => {
    if (!userId || !onChange) return;
    let cancelled = false;

    (async () => {
      try {
        const result = await getUserScheduleAction(userId);
        if (!result.ok) throw new Error(result.error || `Erro ao carregar a jornada`);
        if (!cancelled) onChange(result.data ?? []);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Falha ao carregar a jornada');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Só na montagem: recarregar a cada onChange sobrescreveria a edição em curso
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const rows = useMemo(() => (Array.isArray(value) ? value : []), [value]);
  const grid = useMemo(() => expandToGrid(rows), [rows]);

  const toggleCell = (day: number, hour: number) => {
    if (disabled || !onChange) return;
    const next = grid.map((r) => [...r]);
    next[day][hour] = !next[day][hour];
    onChange(compressFromGrid(next));
  };

  const toggleDay = (day: number, on: boolean) => {
    if (disabled || !onChange) return;
    const next = grid.map((r) => [...r]);
    next[day] = Array(24).fill(on);
    onChange(compressFromGrid(next));
  };

  const clearAll = () => {
    if (disabled || !onChange) return;
    onChange([]);
  };

  if (isLoading) {
    return <div className="py-6 text-sm text-content-muted">Carregando jornada…</div>;
  }

  if (error) {
    return <div className="py-6 text-sm text-red-600">{error}</div>;
  }

  return (
    <div className="col-span-full">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-content-secondary">Controle de jornada</h4>
        {!disabled && (
          <button
            type="button"
            onClick={clearAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-ui-border hover:bg-ui-border-muted text-content-secondary transition-colors"
          >
            <RotateCcw size={14} />
            Limpar jornada
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-ui-border">
        <table className="w-full min-w-[820px] text-xs border-collapse">
          <thead>
            <tr className="bg-page">
              <th className="sticky left-0 z-10 bg-page text-left font-medium text-content-secondary px-3 py-2 min-w-[130px]">
                Horário
              </th>
              {HOURS.map((h) => (
                <th
                  key={h}
                  className="px-1 py-2 font-medium text-content-secondary text-center w-8"
                >
                  {String(h).padStart(2, '0')}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {WEEKDAYS.map((label, day) => {
              const dayFull = grid[day].every(Boolean);
              return (
                <tr key={label} className="border-t border-ui-border">
                  <td className="sticky left-0 z-10 bg-card px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      {!disabled && (
                        <Checkbox
                          checked={dayFull}
                          onChange={(on) => toggleDay(day, on)}
                          ariaLabel={`Marcar ${label} inteiro`}
                        />
                      )}
                      <span className="text-content whitespace-nowrap">{label}</span>
                    </div>
                  </td>
                  {HOURS.map((h) => (
                    <td key={h} className="p-0.5">
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleCell(day, h)}
                        title={`${label} ${String(h).padStart(2, '0')}:00–${String((h + 1) % 24).padStart(2, '0')}:00`}
                        className={`w-full h-6 rounded transition-colors ${
                          grid[day][h]
                            ? 'bg-green-500 dark:bg-green-600'
                            : 'bg-page hover:bg-ui-border'
                        } ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-content-muted">
        Clique nas células para liberar o horário. O acesso é permitido apenas
        nos blocos marcados; fora deles, o login é bloqueado.
      </p>
    </div>
  );
}
