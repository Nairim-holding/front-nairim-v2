'use client';

import { useState, useCallback, useEffect } from 'react';
import { X, RotateCcw } from 'lucide-react';
import type { ColumnDef } from '@/types/types';

interface ColumnCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
  columns: ColumnDef[];
  onReorder: (columns: ColumnDef[]) => void;
  onReset: () => void;
  visibleColumns?: string[];
  onVisibilityChange?: (visibleFields: string[]) => void;
  /** Título do modal — outros usos além de colunas de tabela (ex.: gráficos do Resumo, Tarefa 10) passam o próprio título. */
  title?: string;
  /** Quando false, esconde os controles de reordenar (ex.: gráficos, cuja ordem/posição já é ajustada arrastando o próprio card no grid). */
  allowReorder?: boolean;
}

export default function ColumnCustomizer({
  isOpen,
  onClose,
  columns,
  onReorder,
  onReset,
  visibleColumns = [],
  onVisibilityChange,
  title = 'Personalizar Colunas',
  allowReorder = true,
}: ColumnCustomizerProps) {
  const [localColumns, setLocalColumns] = useState<ColumnDef[]>(columns);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [localVisibleColumns, setLocalVisibleColumns] = useState<Set<string>>(
    visibleColumns.length > 0 ? new Set(visibleColumns) : new Set(columns.map(c => c.field))
  );

  // Update local columns when props change
  if (JSON.stringify(localColumns.map(c => c.field)) !== JSON.stringify(columns.map(c => c.field))) {
    setLocalColumns(columns);
  }

  // Sincronizar estado com prop visibleColumns quando mudar
  useEffect(() => {
    if (visibleColumns.length > 0) {
      setLocalVisibleColumns(new Set(visibleColumns));
    }
  }, [visibleColumns]);

  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newColumns = [...localColumns];
    const draggedColumn = newColumns[draggedIndex];
    newColumns.splice(draggedIndex, 1);
    newColumns.splice(index, 0, draggedColumn);

    setLocalColumns(newColumns);
    setDraggedIndex(index);
  }, [draggedIndex, localColumns]);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    onReorder(localColumns);
  }, [localColumns, onReorder]);

  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return;
    const newColumns = [...localColumns];
    const temp = newColumns[index];
    newColumns[index] = newColumns[index - 1];
    newColumns[index - 1] = temp;
    setLocalColumns(newColumns);
    onReorder(newColumns);
  }, [localColumns, onReorder]);

  const handleMoveDown = useCallback((index: number) => {
    if (index === localColumns.length - 1) return;
    const newColumns = [...localColumns];
    const temp = newColumns[index];
    newColumns[index] = newColumns[index + 1];
    newColumns[index + 1] = temp;
    setLocalColumns(newColumns);
    onReorder(newColumns);
  }, [localColumns, onReorder]);

  const handleReset = useCallback(() => {
    onReset();
    onClose();
  }, [onReset, onClose]);

  const handleToggleVisibility = useCallback((field: string) => {
    setLocalVisibleColumns((prev) => {
      const newVisible = new Set(prev);
      if (newVisible.has(field)) {
        newVisible.delete(field);
      } else {
        newVisible.add(field);
      }
      // Chamar callback após state update
      const newArray = Array.from(newVisible);
      Promise.resolve().then(() => onVisibilityChange?.(newArray));
      return newVisible;
    });
  }, [onVisibilityChange]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-ui-border-soft">
          <h2 className="text-lg font-semibold text-content">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-surface-subtle rounded-lg transition-colors"
          >
            <X size={20} className="text-content-secondary" />
          </button>
        </div>

        {/* Column List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {localColumns.map((column, index) => (
            <div
              key={column.field}
              draggable={allowReorder}
              onDragStart={allowReorder ? () => handleDragStart(index) : undefined}
              onDragOver={allowReorder ? (e) => handleDragOver(e, index) : undefined}
              onDragEnd={allowReorder ? handleDragEnd : undefined}
              className={`flex items-center gap-2 p-2.5 rounded-lg transition-colors ${allowReorder ? 'cursor-move' : ''} ${
                draggedIndex === index
                  ? 'bg-brand/10 border-2 border-brand/30'
                  : 'bg-surface-subtle hover:bg-ui-border-soft border-2 border-transparent'
              }`}
            >
              <input
                type="checkbox"
                checked={localVisibleColumns.has(column.field)}
                onChange={() => handleToggleVisibility(column.field)}
                className="w-4 h-4 cursor-pointer"
                title={localVisibleColumns.has(column.field) ? 'Ocultar' : 'Exibir'}
              />
              {allowReorder && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-content-secondary flex-shrink-0">
                  <circle cx="9" cy="5" r="1.5" />
                  <circle cx="9" cy="12" r="1.5" />
                  <circle cx="9" cy="19" r="1.5" />
                  <circle cx="15" cy="5" r="1.5" />
                  <circle cx="15" cy="12" r="1.5" />
                  <circle cx="15" cy="19" r="1.5" />
                </svg>
              )}
              <span className="flex-1 text-sm text-content truncate">
                {column.label}
              </span>
              {allowReorder && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    className="p-1 hover:bg-surface rounded disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Mover para cima"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="18 15 12 9 6 15" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveDown(index)}
                    disabled={index === localColumns.length - 1}
                    className="p-1 hover:bg-surface rounded disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Mover para baixo"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-ui-border-soft">
          {/*<button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-content-secondary hover:text-content hover:bg-surface-subtle rounded-lg transition-colors"
          >
            <RotateCcw size={14} />
            <span>Restaurar padrão</span>
          </button> */}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition-colors"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}
