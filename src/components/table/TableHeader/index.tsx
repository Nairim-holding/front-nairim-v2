"use client";

import React, { type ChangeEvent, type ReactNode, type RefObject } from 'react';
import { ArrowUpDown, GripVertical, GripHorizontal } from 'lucide-react';
import type { Header, SortOrder } from '@/types/administrador';

interface TableInformationsProps {
  headers: Header[];
  children: ReactNode;
  sort: Record<string, SortOrder>;
  onSort: (sortParam: string) => void;
  onSelectAll: (event: ChangeEvent<HTMLInputElement>) => void;
  allSelected: boolean;
  emptyMessage?: string;
  hasActions?: boolean;
  columnWidths?: Record<string, number>;
  onMouseDownResize?: (e: React.MouseEvent, field: string) => void;
  onColumnReorder?: (dragIndex: number, dropIndex: number) => void;
  tbodyRef?: RefObject<HTMLTableSectionElement | null>;
  /**
   * Fixa o cabeçalho no topo do container de rolagem (`sticky top-0`).
   * Só tem efeito quando um ancestral com altura limitada + `overflow-y-auto`
   * atua como container de scroll (ex.: grid de Lançamentos).
   */
  stickyHeader?: boolean;
}

export default function TableInformations({
  headers,
  children,
  sort,
  onSort,
  onSelectAll,
  allSelected,
  emptyMessage = "Não foi encontrado nenhum registro.",
  hasActions = true,
  columnWidths = {},
  onMouseDownResize,
  onColumnReorder,
  tbodyRef,
  stickyHeader = false,
}: TableInformationsProps) {
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex && onColumnReorder) {
      onColumnReorder(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const isEmpty = !children || (Array.isArray(children) && children.length === 0);

  if (isEmpty) {
    return (
      <div className="flex justify-center items-center my-3">
        <div className="bg-surface-subtle py-4 px-6 rounded-sm flex items-center gap-3">
          <p className="text-content-secondary">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  const dataHeaders = headers.filter(header => header.field !== "actions");

  return (
    <table className="min-w-full text-xs text-left text-content-secondary" style={{ tableLayout: 'fixed' }}>
      <thead className={`bg-surface-muted uppercase text-content-secondary font-semibold border-b border-ui-border-soft ${stickyHeader ? 'sticky top-0 z-20' : ''}`}>
        <tr className="h-[36px]">
          {dataHeaders.map((header, idx) => {
            const isSortable = header?.sortParam && header.field !== "actions";
            const displayOrder = sort[header.sortParam!];
            const width = columnWidths[header.field] || 150;
            const isDragging = draggedIndex === idx;
            const isDragOver = dragOverIndex === idx;

            return (
              <th
                key={header.field}
                draggable={!!onColumnReorder}
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                className={`py-1 px-2 font-normal text-xs whitespace-nowrap relative select-none
                  ${isSortable ? "cursor-pointer hover:bg-surface-subtle transition-colors" : ""}
                  ${onColumnReorder ? "cursor-move" : ""}
                  ${isDragging ? "opacity-50 bg-brand/10" : ""}
                  ${isDragOver ? "bg-brand/20 border-l-2 border-brand" : ""}
                `}
                style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}
                onClick={isSortable && !isDragging ? () => onSort(header.sortParam!) : undefined}
              >
                <div className="flex gap-1 capitalize w-full items-center justify-center">
                  {onColumnReorder && (
                    <GripHorizontal
                      size={12}
                      className="text-content-muted cursor-move flex-shrink-0 mr-1"
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                  {idx === 0 && (
                    <input
                      type="checkbox"
                      className="inp-checkbox-select ml-[4px] mr-[4px]"
                      onChange={onSelectAll}
                      onClick={(e) => e.stopPropagation()}
                      checked={allSelected}
                    />
                  )}
                  <span className="truncate" title={header.label}>{header.label}</span>
                  {isSortable && (
                    <span
                      className={`transition-transform duration-200 shrink-0 ${
                        displayOrder === "desc" ? "rotate-180" : ""
                      }`}
                    >
                      <ArrowUpDown size={14} className="text-content-secondary" />
                    </span>
                  )}
                </div>

                {/* Divisória invisível de Redimensionamento */}
                {onMouseDownResize && (
                  <div
                    onMouseDown={(e) => onMouseDownResize(e, header.field)}
                    className="absolute right-0 top-0 bottom-0 w-[10px] cursor-col-resize hover:bg-ui-border-muted z-30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <GripVertical size={14} color="var(--color-text-muted)" />
                  </div>
                )}
              </th>
            );
          })}
          
          {hasActions && (
            <th
              key="actions"
              className={`py-1 px-2 font-normal text-xs whitespace-nowrap sticky right-0 bg-surface-muted w-[70px] min-w-[70px] max-w-[70px] ${stickyHeader ? 'z-30' : 'z-20'}`}
            >
              <div className="flex items-center justify-center gap-1 capitalize">
                <span>Ação</span>
              </div>
            </th>
          )}
        </tr>
      </thead>
      <tbody ref={tbodyRef} className="divide-y divide-gray-100 lines-bg">{children}</tbody>
    </table>
  );
}