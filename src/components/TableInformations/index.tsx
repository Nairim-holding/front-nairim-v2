"use client";

import { ChangeEvent, ReactNode } from "react";
import { ArrowUpDown, GripVertical } from "lucide-react";
import { Header, SortOrder } from "@/types/administrador";

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
}: TableInformationsProps) {
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
    <table className="min-w-full text-sm text-left text-content-secondary" style={{ tableLayout: 'fixed' }}>
      <thead className="bg-surface-muted uppercase text-content-secondary font-semibold border-b border-ui-border-soft">
        <tr className="h-[36px]">
          {dataHeaders.map((header, idx) => {
            const isSortable = header?.sortParam && header.field !== "actions";
            const displayOrder = sort[header.sortParam!];
            const isFirstColumn = idx === 0;
            const width = columnWidths[header.field] || 150;

            return (
              <th
                key={idx}
                className={`py-1 px-2 font-normal text-[13px] whitespace-nowrap relative
                  ${isFirstColumn ? "sticky left-0 bg-surface-muted z-20" : ""}
                  ${isSortable ? "cursor-pointer hover:bg-surface-subtle transition-colors" : ""}
                `}
                style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}
                onClick={isSortable ? () => onSort(header.sortParam!) : undefined}
              >
                <div className={`flex gap-1 capitalize w-full ${isFirstColumn ? 'items-start justify-start' : 'items-center justify-center'}`}>
                  {isFirstColumn && (
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
              className="py-1 px-2 font-normal text-[13px] whitespace-nowrap sticky right-0 bg-surface-muted z-20 w-[80px] min-w-[80px] max-w-[80px]"
            >
              <div className="flex items-center justify-center gap-1 capitalize">
                <span>Ação</span>
              </div>
            </th>
          )}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 lines-bg">{children}</tbody>
    </table>
  );
}