/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { Filter, Trash2, Plus, Edit, Eye, X, Settings2, Paperclip, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { useMessageContext } from "@/contexts/MessageContext";
import { usePopupContext } from "@/contexts/PopupContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { normalizeResourceKey } from "@/utils/permissionResource";
import SkeletonTable from "../TableSkeleton";
import DynamicFilterModal from "../../filters/DynamicFilterModal";
import SearchInput from "../../filters/SearchInput";
import SelectLimit from "../../filters/PageSizeSelect";
import Pagination from "../../filters/Pagination";
import TableInformations from "../TableHeader";
import ColumnCustomizer from "../ColumnCustomizer";
import Input from "../../ui/Input";
import { formatCurrency, formatDate, formatDateTime, formatCPFCNPJ, formatRG, formatGender, formatPhone, formatCEP, formatStatus } from "@/utils/displayFormatters";
import { useOptimizedTableData } from "@/hooks/useOptimizedTableData";
import { useDynamicFilters } from "@/hooks/useDynamicFilters";
import { TABLE_DATA_SOURCES } from "../tableDataSources";
import { getColumnPreferencesAction, saveColumnPreferencesAction } from "@/server/actions/user-preferences";
import { ColumnDef } from "@/types/types";
import ModalSelectTypeOwner from "@/components/modals/OwnerTypeModal";
import { useRouter } from "next/navigation";
import { matchesTableFilter } from "@/shared/utils/table-filter-utils";

interface DynamicTableManagerProps {
  resource: string;
  title: string;
  columns: ColumnDef[];
  basePath: string;
  autoFocusSearch?: boolean;
  defaultSort?: Record<string, any>;
  defaultLimit?: number;
  enableCreate?: boolean;
  enableView?: boolean;
  enableEdit?: boolean;
  enableDelete?: boolean;
  onRowClick?: (item: any) => void;
  defaultFilters?: Record<string, any>;
  localData?: any[];
  onEdit?: (item: any, index: number) => void;
  onDelete?: (item: any, index: number) => void;
  hideActionButtons?: boolean;
  onSortChange?: (sort: Record<string, 'asc' | 'desc'>) => void;
  /**
   * Ações extras por linha, renderizadas depois de Visualizar/Editar.
   * Opcional: sem ela a célula de ações continua exatamente como antes.
   */
  rowActions?: RowAction[];
  /**
   * Fonte de filtros alternativa (Server Action). Quando presente, a tabela
   * busca os filtros por este fetcher em vez do endpoint `/${resource}/filters`.
   */
  filtersFetcher?: (appliedFilters?: Record<string, any>) => Promise<any>;
  /** Botão de exportar para Excel na toolbar (Tarefa 5.1 do guia de correções) — desligado por padrão para não alterar telas existentes. */
  enableExcelExport?: boolean;
  /**
   * Campos do backend a esconder do modal de Filtro (Tarefa 5.4 do guia de
   * correções) — ex.: remover "Período" de Logs de Auditoria, que passou a
   * ser controlado só pela busca/atalho da tela inicial.
   */
  excludeFilterFields?: string[];
}

export interface RowAction {
  key: string;
  title: string;
  icon: ReactNode;
  onClick: (item: any) => void;
  /** Ação da diretiva de acesso que autoriza este botão (default: sempre visível). */
  action?: 'view' | 'create' | 'edit' | 'delete' | 'export' | 'custom_field';
}

export default function DynamicTableManager({
  resource,
  title,
  columns,
  basePath,
  autoFocusSearch = true,
  defaultSort = {},
  defaultLimit = 150,
  enableCreate = true,
  enableView = true,
  enableEdit = true,
  enableDelete = true,
  onRowClick,
  defaultFilters = {},
  localData,
  onEdit,
  onDelete,
  hideActionButtons = false,
  onSortChange,
  rowActions,
  filtersFetcher,
  enableExcelExport = false,
  excludeFilterFields,
}: DynamicTableManagerProps) {
  const { can } = usePermissions();
  const permResource = normalizeResourceKey(resource);
  // Diretiva de acesso do grupo AND a prop (a prop já desliga o botão por
  // regra de negócio da página; a diretiva desliga por permissão do usuário).
  const canView = enableView && can(permResource, 'view');
  const canEditPerm = (enableEdit || !!onEdit) && can(permResource, 'edit');
  const canDeletePerm = enableDelete && can(permResource, 'delete');
  const canCreatePerm = enableCreate && can(permResource, 'create');
  const visibleRowActions = (rowActions ?? []).filter(
    (action) => !action.action || can(permResource, action.action)
  );

  // A célula de ações é sticky e tinha largura fixa de 50px (cabia Ver + Editar).
  // Com rowActions o total varia, então a largura acompanha a quantidade de ícones.
  const actionsCount =
    (canView ? 1 : 0) +
    (canEditPerm ? 1 : 0) +
    visibleRowActions.length;
  const actionsCellWidth = `${Math.max(50, actionsCount * 26 + 8)}px`;

  const [filterVisible, setFilterVisible] = useState(false);
  const [selectedCheckboxes, setSelectedCheckboxes] = useState<string[]>([]);
  const [appliedFilters, setAppliedFilters] = useState<Record<string, any>>(defaultFilters);
  const [showOwnerTypeModal, setShowOwnerTypeModal] = useState(false);
  
  const [isCancelLeaseModalOpen, setIsCancelLeaseModalOpen] = useState(false);
  const [cancelLeaseData, setCancelLeaseData] = useState({
    cancellation_penalty: '',
    other_cancellation_amounts: '',
    cancellation_justification: '',
    canceled_at: new Date().toISOString().split('T')[0]
  });
  
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [displayColumns, setDisplayColumns] = useState<ColumnDef[]>(columns);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(columns.map(c => c.field));
  const [isLoadingColumns, setIsLoadingColumns] = useState(true);
  const [columnOrder, setColumnOrder] = useState<string[]>(columns.map(c => c.field).filter(f => f !== 'actions'));
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);

  const router = useRouter();

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef(0);
  const isRestoringScrollRef = useRef(false);
  const scrollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const columnWidthsRef = useRef<Record<string, number>>(columnWidths);
  
  const { showMessage } = useMessageContext();
  const { showPopup } = usePopupContext();

  // Carregar preferências de colunas do servidor
  const fetchColumnPreferences = useCallback(async () => {
    try {
      const result = await getColumnPreferencesAction(resource);
      if (result.ok) {
        if (result.data.columnWidths && typeof result.data.columnWidths === 'object') {
          setColumnWidths(result.data.columnWidths);
          columnWidthsRef.current = result.data.columnWidths;
        }

        if (result.data.visibleColumns && Array.isArray(result.data.visibleColumns) && result.data.visibleColumns.length > 0) {
          setVisibleColumns(result.data.visibleColumns);
        }

        if (result.data.columnOrder && Array.isArray(result.data.columnOrder)) {
          setColumnOrder(result.data.columnOrder);
          const orderedColumns: ColumnDef[] = [];
          const remainingColumns = [...columns];

          result.data.columnOrder.forEach((field: string) => {
            const colIndex = remainingColumns.findIndex(c => c.field === field);
            if (colIndex >= 0) {
              orderedColumns.push(remainingColumns[colIndex]);
              remainingColumns.splice(colIndex, 1);
            }
          });

          setDisplayColumns([...orderedColumns, ...remainingColumns]);
        } else {
          // Sem columnOrder salvo: usa as colunas atuais (inclui dinâmicas como vencimento*)
          setDisplayColumns(columns);
        }
      } else {
        setDisplayColumns(columns);
      }
    } catch (error) {
      console.error('[DataTable] Erro ao carregar preferências:', error);
      setDisplayColumns(columns);
    } finally {
      setIsLoadingColumns(false);
    }
  }, [resource, columns]);

  // Salvar preferências de colunas no servidor
  const saveColumnPreferences = useCallback(async (widths: Record<string, number>, visibleCols?: string[], orderedCols?: string[]) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      const MAX_RETRIES = 3;
      let attempt = 0;

      const attemptSave = async (): Promise<boolean> => {
        try {
          const body = {
            resource,
            columnOrder: orderedCols || columnOrder,
            columnWidths: widths,
            ...(visibleCols && visibleCols.length > 0 && { visibleColumns: visibleCols }),
          };
          const result = await saveColumnPreferencesAction(body);

          if (!result.ok) {
            throw new Error(result.error);
          }

          showMessage('Preferências de colunas salvas com sucesso', 'success', 2000);
          return true;
        } catch (error) {
          attempt++;
          if (attempt < MAX_RETRIES) {
            const delayMs = Math.pow(2, attempt - 1) * 1000;
            console.warn(`[DataTable] Tentativa ${attempt} falhou. Retentando em ${delayMs}ms...`, error);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            return attemptSave();
          } else {
            console.error('[DataTable] Falha ao salvar após 3 tentativas:', error);
            showMessage('Erro ao salvar preferências de colunas. Tente novamente.', 'error', 5000);
            return false;
          }
        }
      };

      await attemptSave();
    }, 500);
  }, [resource, columnOrder, visibleColumns, showMessage]);

  // Sincronizar columnWidthsRef
  useEffect(() => {
    columnWidthsRef.current = columnWidths;
  }, [columnWidths]);

  // Carregar preferências na montagem
  useEffect(() => {
    fetchColumnPreferences();
  }, [fetchColumnPreferences]);

  const useLocalMode = !!localData;

  // Fonte de dados via Server Action (registro central) quando o recurso está
  // mapeado; o fetcher da página (dataFetcher) tem prioridade sobre o registro.
  const resourceSource = TABLE_DATA_SOURCES[resource];

  const {
    filters: dynamicFilters,
    searchFields,
    isLoading: isLoadingFilters
  } = useDynamicFilters(`/${resource}/filters`, appliedFilters, filtersFetcher ?? resourceSource?.filters);
  const { 
    state = { page: 1, limit: defaultLimit, search: "", sort: defaultSort, filters: defaultFilters },
    data = null,
    isLoading: isLoadingData = false,
    updateState = () => {},
    refreshData = () => {}
  } = useLocalMode ? { 
    state: { page: 1, limit: defaultLimit, search: "", sort: defaultSort, filters: defaultFilters },
    data: null,
    isLoading: false,
    updateState: () => {},
    refreshData: () => {}
  } : useOptimizedTableData(resource, {
    page: 1,
    limit: defaultLimit,
    search: "",
    sort: defaultSort,
    filters: defaultFilters
  }, resourceSource?.list);

  const dataColumns = useMemo(() => {
    return displayColumns.filter(col => col.field !== "actions" && col.type !== "custom");
  }, [displayColumns]);

  const visibleDataColumns = useMemo(() => {
    return dataColumns.filter(col => visibleColumns.includes(col.field));
  }, [dataColumns, visibleColumns]);

  useEffect(() => {
    const initialWidths: Record<string, number> = {};
    dataColumns.forEach(col => {
      if (!columnWidths[col.field]) {
        const fieldName = col.field.toLowerCase();
        
        // Aumentado para 320 para dar espaço suficiente para e-mails e nomes grandes
        if (fieldName.includes('email') || fieldName.includes('name') || fieldName.includes('contact') || fieldName.includes('street') || fieldName.includes('address')) {
          initialWidths[col.field] = 320; 
        } else if (fieldName.includes('phone') || fieldName.includes('cellphone') || fieldName.includes('telephone')) {
          initialWidths[col.field] = 160;
        } else if (col.field === 'person_type') {
          initialWidths[col.field] = 70;
        } else {
          initialWidths[col.field] = 150;
        }
      }
    });
    if (Object.keys(initialWidths).length > 0) {
      setColumnWidths(prev => ({ ...prev, ...initialWidths }));
    }
  }, [dataColumns]);

  const isResizingRef = useRef<{field: string, startX: number, startWidth: number} | null>(null);

  const handleMouseDownResize = useCallback((e: React.MouseEvent, field: string) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = {
      field,
      startX: e.pageX,
      startWidth: columnWidthsRef.current[field] || 150
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current) return;
    const { field, startX, startWidth } = isResizingRef.current;
    const diff = e.pageX - startX;
    const newWidth = Math.max(60, startWidth + diff);
    console.log(`[DataTable] Resizing ${field}: ${newWidth}px`);
    setColumnWidths(prev => ({ ...prev, [field]: newWidth }));
  }, []);

  const handleMouseUp = useCallback(() => {
    if (isResizingRef.current) {
      const currentWidths = { ...columnWidthsRef.current };
      console.log('[DataTable] handleMouseUp - columnWidths:', currentWidths);
      console.log('[DataTable] Campo redimensionado:', isResizingRef.current.field);
      saveColumnPreferences(currentWidths);
    }
    isResizingRef.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove, saveColumnPreferences]);

  const handleColumnsChange = useCallback((newColumns: ColumnDef[]) => {
    setDisplayColumns(newColumns);
    const orderedFields = newColumns.map(c => c.field).filter(f => f !== 'actions');
    setColumnOrder(orderedFields);
    saveColumnPreferences(columnWidthsRef.current, visibleColumns, orderedFields);
  }, [saveColumnPreferences, visibleColumns]);

  const handleResetColumns = useCallback(() => {
    const allFields = columns.map(c => c.field);
    const orderedFields = columns.map(c => c.field).filter(f => f !== 'actions');
    setDisplayColumns(columns);
    setColumnOrder(orderedFields);
    setColumnWidths({});
    setVisibleColumns(allFields);
    columnWidthsRef.current = {};
    saveColumnPreferences({}, allFields, orderedFields);
  }, [columns, saveColumnPreferences]);

  const handleVisibilityChange = useCallback((visibleFields: string[]) => {
    setVisibleColumns(visibleFields);
    saveColumnPreferences(columnWidthsRef.current, visibleFields);
  }, [saveColumnPreferences]);

  const { items, meta } = useMemo(() => {
    if (useLocalMode && localData) {
      // Aplicar filtros aos dados locais
      let filteredData = localData;
      
      if (appliedFilters && Object.keys(appliedFilters).length > 0) {
        filteredData = localData.filter((item: any) => {
          return Object.entries(appliedFilters).every(([field, filterValue]) =>
            matchesTableFilter(item[field], filterValue),
          );
        });
      }
      
      return {
        items: filteredData,
        meta: {
          page: 1,
          limit: filteredData.length,
          total: filteredData.length,
          totalPages: 1
        }
      };
    }
    if (!data) return { items: [], meta: null };
    if (data.data && Array.isArray(data.data)) {
      return {
        items: data.data,
        meta: {
          page: data.currentPage || 1,
          limit: state.limit,
          total: data.count || 0,
          totalPages: data.totalPages || 1
        }
      };
    }
    if (data.items && Array.isArray(data.items)) return { items: data.items, meta: data.meta };
    if (Array.isArray(data)) return { items: data, meta: { page: 1, limit: state.limit, total: data.length, totalPages: 1 } };
    return { items: [], meta: null };
  }, [data, state.limit, useLocalMode, localData, appliedFilters]);

  const getNestedValue = useCallback((obj: any, path: string) => {
    if (!obj || !path) return undefined;
    try {
      return path.split('.').reduce((acc, key) => {
        const arrayMatch = key.match(/(\w+)\[(\d+)\]/);
        if (arrayMatch && acc) {
          const arrayKey = arrayMatch[1];
          const index = parseInt(arrayMatch[2]);
          return acc[arrayKey]?.[index];
        }
        return acc?.[key];
      }, obj);
    } catch {
      return undefined;
    }
  }, []);

  const formatValue = useCallback((value: any, column: ColumnDef) => {
    if (value === undefined || value === null || value === '') return '-';

    if (column.formatter) {
      switch (column.formatter) {
        case 'currency': return formatCurrency(value);
        case 'date': return formatDate(value);
        case 'datetime': return formatDateTime(value);
        case 'cpfCnpj': return formatCPFCNPJ(value);
        case 'gender': return formatGender(value);
        case 'phone': return formatPhone(value);
        case 'boolean': return value ? 'Sim' : 'Não';
        case 'cep': return formatCEP(value);
        case 'rg': return formatRG(value);
        case 'propertyStatus': return formatStatus(value);
        default: return String(value);
      }
    }

    if (column.type === 'date' && value) return formatDate(value);
    if (column.type === 'currency' && value) return formatCurrency(value);
    if (column.type === 'boolean') return value ? 'Sim' : 'Não';
    if (column.type === 'number') return Number(value).toLocaleString('pt-BR');

    return String(value);
  }, []);

  const [isExporting, setIsExporting] = useState(false);

  /**
   * Exporta para Excel todos os registros que batem com a busca/filtros
   * atuais (não só a página visível) — Tarefa 5.1 do guia de correções.
   * Usa `formatValue`/`nestedField` (sempre string) em vez de `getCellValue`
   * (que mistura JSX para colunas com badge), então cobre bem colunas de
   * texto/data/nested — o mesmo tipo de coluna usado em Auditoria/Logs.
   */
  const handleExportExcel = useCallback(async () => {
    if (!meta || meta.total === 0) {
      showMessage('Não há dados para exportar', 'error');
      return;
    }

    setIsExporting(true);
    try {
      const exportLimit = 100;
      const totalPages = Math.max(1, Math.ceil(meta.total / exportLimit));
      const allItems: any[] = [];

      for (let p = 1; p <= totalPages; p++) {
        if (!resourceSource?.list) {
          throw new Error('Recurso não rastreado por Server Action — exportação indisponível');
        }

        const res = await resourceSource.list({
          page: p,
          limit: exportLimit,
          search: state.search,
          sort: state.sort,
          filters: state.filters,
        });
        const pageItems = Array.isArray(res.data) ? res.data : Array.isArray(res.items) ? res.items : [];
        allItems.push(...pageItems);
      }

      const rows = allItems.map((item: any) => {
        const row: Record<string, string> = {};
        visibleDataColumns.forEach((col) => {
          const raw = col.nestedField ? getNestedValue(item, col.nestedField) : item[col.field];
          row[col.label] = formatValue(raw, col);
        });
        return row;
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, title.slice(0, 31));
      XLSX.writeFile(workbook, `${resource}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error('[DataTable] Erro ao exportar Excel:', error);
      showMessage('Erro ao exportar para Excel. Tente novamente.', 'error');
    } finally {
      setIsExporting(false);
    }
  }, [meta, state, resource, visibleDataColumns, getNestedValue, formatValue, title, showMessage]);

  const getCellValue = useCallback((item: any, column: ColumnDef) => {
    // Colunas técnicas de Logs de Auditoria (Tarefa 5.2 do guia de correções):
    // IP em fonte monoespaçada para diferenciar de texto comum, e o registro
    // afetado (UUID) truncado com tooltip do valor completo — nenhum dos dois
    // é removido (têm valor de rastreabilidade), só ficam mais discretos/legíveis.
    if (resource === 'audit-logs' && column.field === 'ip' && item.ip) {
      return <span className="font-mono text-xs text-content-secondary">{item.ip}</span>;
    }
    if (resource === 'audit-logs' && column.field === 'record_id' && item.record_id) {
      return (
        <span className="font-mono text-xs text-content-muted" title={item.record_id}>
          {String(item.record_id).slice(0, 8)}…
        </span>
      );
    }

    if (column.field === "is_active") {
      const isActive = item[column.field];
      return (
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
          isActive 
            ? 'text-green-700 bg-green-50 border border-green-200' 
            : 'text-red-700 bg-red-50 border border-red-200'
        }`}>
          {isActive ? 'Ativo' : 'Inativo'}
        </span>
      );
    }

    if (column.field === "status" && (item[column.field] === 'PENDING' || item[column.field] === 'COMPLETED')) {
      const isCompleted = item[column.field] === 'COMPLETED';
      return (
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
          isCompleted 
            ? 'text-green-700 bg-green-50 border border-green-200' 
            : 'text-yellow-700 bg-yellow-50 border border-yellow-200'
        }`}>
          {isCompleted ? 'Concluído' : 'Pendente'}
        </span>
      );
    }

    try {
      if (column.field === 'person_type') {
        const cnpjStr = item.cnpj ? String(item.cnpj).replace(/\D/g, '') : '';
        const cpfStr = item.cpf ? String(item.cpf).replace(/\D/g, '') : '';
        
        if (cnpjStr.length > 0) return 'J';
        if (cpfStr.length > 0) return 'F';
        return '-';
      }

      const isUser = resource === 'users';
      if (isUser && ['name', 'email', 'gender', 'birth_date', 'created_at'].includes(column.field)) {
        return formatValue(item[column.field], column);
      }

      const contactFields = ['contact', 'telephone', 'phone', 'cellphone', 'email', 'contact_name'];
      
      if (contactFields.includes(column.field)) {
        if (item.contacts && Array.isArray(item.contacts) && item.contacts.length > 0) {
          return (
            <div className="flex flex-col w-full gap-1 py-1">
              {item.contacts.map((contact: any, index: number) => {
                let rawValue = '';
                if (column.field === 'contact' || column.field === 'contact_name') rawValue = contact.contact;
                else if (column.field === 'email') rawValue = contact.email;
                else if (column.field === 'telephone' || column.field === 'phone') rawValue = contact.phone;
                else if (column.field === 'cellphone') rawValue = contact.cellphone;

                const formattedValue = formatValue(rawValue, column);
                return (
                  <div key={index} className="flex items-center justify-start text-xs min-h-[20px] w-full min-w-0">
                     <span className={`w-full whitespace-normal break-all ${!rawValue ? 'text-content-muted' : ''}`}>
                        {formattedValue !== '-' ? formattedValue : '-'}
                     </span>
                  </div>
                );
              })}
            </div>
          );
        }
        return '-';
      }

      const isLease = resource === 'leases';
      if (isLease) {
        if (column.field === "contract_number") {
          const count = item._count?.documents ?? 0;
          const text = formatValue(item.contract_number, column);
          if (count > 0) {
            return (
              <span className="inline-flex items-center gap-1.5">
                <span>{text}</span>
                <span
                  className="inline-flex shrink-0 text-blue-500"
                  title={`Contém ${count} arquivo${count === 1 ? '' : 's'} anexado${count === 1 ? '' : 's'}`}
                >
                  <Paperclip size={14} />
                </span>
              </span>
            );
          }
          return text;
        }
        if (column.field === "property_title") return formatValue(item.property?.title, column);
        if (column.field === "type") return formatValue(item.property?.type?.description, column);
        if (column.field === "owner") return formatValue(item.owner?.name, column);
        if (column.field === "tenant") return formatValue(item.tenant?.name, column);
        if (['rent_due_day', 'tax_due_day', 'condo_due_day'].includes(column.field)) {
           return item[column.field] ? `${item[column.field]}º dia` : '-';
        }
        if (column.field === "payment_condition") {
          const paymentMap: Record<string, string> = {
            'IN_FULL_15_DISCOUNT': 'À vista (15% desc.)',
            'SECOND_INSTALLMENT_10_DISCOUNT': '2ª parcela (10% desc.)',
            'INSTALLMENTS': 'Parcelado (12x)'
          };
          return paymentMap[item.payment_condition] || '-';
        }
        if (column.field === "status") {
          const statusMap: Record<string, { label: string, color: string }> = {
            'EXPIRED': { label: 'Vencido', color: 'text-red-700 bg-red-100 border border-red-300' },
            'EXPIRING': { label: 'Vencendo', color: 'text-yellow-700 bg-yellow-100 border border-yellow-300' },
            'ACTIVE': { label: 'Em Dia', color: 'text-green-700 bg-green-100 border border-green-300' },
            'CANCELED': { label: 'Cancelado', color: 'text-orange-700 bg-orange-100 border border-orange-500' }
          };
          const mapped = statusMap[item.status];
          if (mapped) {
            return (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${mapped.color}`}>
                {mapped.label}
              </span>
            );
          }
          return item.status || '-';
        }
      }

      const isProperty = resource === 'properties';
      const isTenantOrOwner = resource === 'tenants' || resource === 'owners';
      const isAgency = resource === 'agencies';
      
      if (isProperty) {
        const addressFieldMap: Record<string, string> = {
          'zip_code': 'zip_code', 'state': 'state', 'city': 'city',
          'district': 'district', 'street': 'street', 'address': 'street', 'cep': 'zip_code',
          'complement': 'complement'
        };
        const addressField = addressFieldMap[column.field];
        if (addressField) {
          // Concatenar número no endereço (campo street)
          if (column.field === 'street' || column.field === 'address') {
            const street = item.addresses?.[0]?.address?.street || '';
            const number = item.addresses?.[0]?.address?.number || '';
            const fullAddress = number ? `${street}, ${number}` : street;
            return formatValue(fullAddress, column);
          }
          return formatValue(item.addresses?.[0]?.address?.[addressField], column);
        }
        if (column.field === "owner") return formatValue(item.owner?.name, column);
        if (column.field === "type") return formatValue(item.type?.description, column);
        if (column.field === "status") return formatValue(item.values?.[0]?.status, column);
      }

      if (isTenantOrOwner || isAgency) {
        // Concatenar número no endereço (campo street/address) para tenants, owners e agencies
        if (column.field === 'street' || column.field === 'address') {
          const street = item.addresses?.[0]?.address?.street || '';
          const number = item.addresses?.[0]?.address?.number || '';
          const fullAddress = number ? `${street}, ${number}` : street;
          return formatValue(fullAddress, column);
        }
      }

      const addressFieldMap: Record<string, {path: string, field: string}> = {
        'zip_code': { path: 'addresses[0].address', field: 'zip_code' },
        'state': { path: 'addresses[0].address', field: 'state' },
        'city': { path: 'addresses[0].address', field: 'city' },
        'district': { path: 'addresses[0].address', field: 'district' },
        'address': { path: 'addresses[0].address', field: 'street' },
        'street': { path: 'addresses[0].address', field: 'street' },
        'cep': { path: 'addresses[0].address', field: 'zip_code' },
        'number': { path: 'addresses[0].address', field: 'number' },
        'complement': { path: 'addresses[0].address', field: 'complement' }
      };

      if (addressFieldMap[column.field]) {
        const { path, field } = addressFieldMap[column.field];
        return formatValue(getNestedValue(item, `${path}.${field}`), column);
      }

      if (column.field in item) {
        const value = item[column.field];
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          if (value.name) return formatValue(value.name, column);
          if (value.description) return formatValue(value.description, column);
          if (value.title) return formatValue(value.title, column);
        }
        return formatValue(value, column);
      }
      
      const nestedValue = getNestedValue(item, column.field);
      if (nestedValue !== undefined) return formatValue(nestedValue, column);

      return '-';
      
    } catch {
      return '-';
    }
  }, [formatValue, getNestedValue, resource]);

  const searchPlaceholder = useMemo(() => {
    if (!searchFields.length) return `Pesquisar ${title.toLowerCase()}...`;
    const fieldsText = searchFields.map(field => {
      const filter = dynamicFilters.find(f => f.field === field);
      return filter?.label || field;
    }).join(", ");
    return `Pesquisar por ${fieldsText}...`;
  }, [searchFields, dynamicFilters, title]);

  const headers = useMemo(() =>
    visibleDataColumns.map(col => ({
      label: col.label,
      field: col.field,
      sortParam: col.sortParam || col.field
    }))
  , [visibleDataColumns]);

  const handleTableScroll = useCallback(() => {
    if (isRestoringScrollRef.current) return;
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      if (tableContainerRef.current) {
        scrollPositionRef.current = tableContainerRef.current.scrollLeft;
      }
    }, 50);
  }, []);

  useEffect(() => {
    if (tableContainerRef.current) {
      isRestoringScrollRef.current = true;
      tableContainerRef.current.scrollLeft = scrollPositionRef.current;
      setTimeout(() => { isRestoringScrollRef.current = false; }, 100);
    }
  }, [items]);

  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, []);

  const handleSearch = useCallback((search: string) => {
    updateState({ search, page: 1 });
  }, [updateState]);

  const handleSort = useCallback((sortParam: string) => {
    const currentOrder = state.sort[sortParam] || null;
    let nextOrder: "asc" | "desc" = "desc";
    
    if (currentOrder === "desc") nextOrder = "asc";
    else if (currentOrder === "asc") nextOrder = "desc";

    const newSort = { [sortParam]: nextOrder };
    updateState({ sort: newSort, page: 1 });
    
    // Se estiver em modo local, notifica o componente pai sobre a mudança de ordenação
    if (useLocalMode && onSortChange) {
      onSortChange(newSort);
    }
  }, [state.sort, updateState, useLocalMode, onSortChange]);

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked && items.length > 0) {
      setSelectedCheckboxes(items.map((item: any) => item.id));
    } else {
      setSelectedCheckboxes([]);
    }
  }, [items]);

  const handleCheckboxChange = useCallback((id: string) => {
    setSelectedCheckboxes(prev => {
      if (prev.includes(id)) {
        return prev.filter(itemId => itemId !== id);
      } else {
        return [...prev, id];
      }
    });
  }, []);

  const handleDeleteClick = useCallback(() => {
    if (!selectedCheckboxes.length) {
      showMessage(`Selecione os registros que deseja ${resource === 'leases' ? 'cancelar ou excluir' : 'excluir'}.`, "error");
      return;
    }

    if (resource === 'leases') {
      const selectedItems = items.filter((item: any) => selectedCheckboxes.includes(item.id));
      const canceledCount = selectedItems.filter((item: any) => item.status === 'CANCELED' || item.status === 'Cancelado').length;
      const hasMixed = canceledCount > 0 && canceledCount < selectedItems.length;

      if (hasMixed) {
        showMessage("Selecione apenas locações ativas ou apenas locações já canceladas.", "error");
        return;
      }

      setIsCancelLeaseModalOpen(true);
      return;
    }

    // Se estiver em modo local (localData) e tiver onDelete callback, usa ele diretamente
    // O componente pai (IptuManager) já tem seu próprio modal de confirmação no handleRemove
    if (useLocalMode && onDelete) {
      const selectedItems = items.filter((item: any) => selectedCheckboxes.includes(item.id));
      selectedItems.forEach((item: any) => {
        // Usar _originalIndex se disponível, senão usar o índice no array items
        const index = item._originalIndex !== undefined ? item._originalIndex : items.indexOf(item);
        onDelete(item, index);
      });
      setSelectedCheckboxes([]);
      return;
    }
    
    showPopup(
      selectedCheckboxes.length > 1 ? `Remover ${selectedCheckboxes.length} registros` : `Remover ${title.toLowerCase()}`,
      selectedCheckboxes.length > 1 
        ? `Você selecionou ${selectedCheckboxes.length} registros. Tem certeza que deseja removê-los?`
        : `Tem certeza que deseja remover este ${title.toLowerCase()}?`,
      async () => {
        if (!selectedCheckboxes.length) return;
        try {
          let successCount = 0;
          let errorCount = 0;
          let lastErrorMessage = "";

          for (const id of selectedCheckboxes) {
            try {
              if (resourceSource?.delete) {
                const result = await resourceSource.delete(id);
                if (result.ok) {
                  successCount++;
                } else {
                  errorCount++;
                  if (result.error) lastErrorMessage = result.error;
                }
              } else {
                throw new Error(`Exclusão não rastreada por Server Action para o recurso ${resource}`);
              }
            } catch {
              errorCount++;
            }
          }
          
          if (errorCount === 0) {
            showMessage(selectedCheckboxes.length > 1 ? `${successCount} registros removidos com sucesso!` : "Registro removido com sucesso!", "success");
          } else {
            if (selectedCheckboxes.length === 1 && lastErrorMessage) {
              showMessage(lastErrorMessage, "error");
            } else {
              showMessage(`${successCount} de ${selectedCheckboxes.length} registros removidos. ${errorCount} erros.`, "error");
            }
          }
          refreshData();
          setSelectedCheckboxes([]);
        } catch {
          showMessage(`Erro ao deletar ${title.toLowerCase()}(s).`, "error");
        }
      },
      () => {}
    );
  }, [selectedCheckboxes, showMessage, showPopup, refreshData, resource, title, items, useLocalMode, onDelete, resourceSource]);

  const handleConfirmCancelLeases = useCallback(async () => {
    try {
      let successCount = 0;
      let errorCount = 0;
      for (const id of selectedCheckboxes) {
        try {
          const parsedPenalty = cancelLeaseData.cancellation_penalty 
            ? Number(String(cancelLeaseData.cancellation_penalty).replace(/\D/g, '')) / 100 
            : null;
            
          const parsedOther = cancelLeaseData.other_cancellation_amounts 
            ? Number(String(cancelLeaseData.other_cancellation_amounts).replace(/\D/g, '')) / 100 
            : null;

          if (resourceSource?.cancelLease) {
            const result = await resourceSource.cancelLease(id, {
              status: 'CANCELED',
              canceled_at: cancelLeaseData.canceled_at,
              cancellation_justification: cancelLeaseData.cancellation_justification || null,
              cancellation_penalty: parsedPenalty,
              other_cancellation_amounts: parsedOther
            });
            if (result.ok) successCount++;
            else errorCount++;
          } else {
            throw new Error(`Cancelamento de locação não rastreado por Server Action`);
          }
        } catch {
          errorCount++;
        }
      }
      if (errorCount === 0) {
        showMessage(selectedCheckboxes.length > 1 ? `${successCount} locações canceladas com sucesso!` : "Locação cancelada com sucesso!", "success");
      } else {
        showMessage(`${successCount} locações canceladas. ${errorCount} erros.`, "info");
      }
      refreshData();
      setSelectedCheckboxes([]);
      setIsCancelLeaseModalOpen(false);
      setCancelLeaseData({
        cancellation_penalty: '',
        other_cancellation_amounts: '',
        cancellation_justification: '',
        canceled_at: new Date().toISOString().split('T')[0]
      });
    } catch {
      showMessage("Erro ao cancelar locação.", "error");
    }
  }, [cancelLeaseData, selectedCheckboxes, showMessage, refreshData, resourceSource]);

  // Exclusão DEFINITIVA (hard delete + cascata dos lançamentos financeiros).
  // Diferente do "Confirmar" acima, que apenas cancela (soft).
  const handleConfirmDeleteLeases = useCallback(() => {
    showPopup(
      selectedCheckboxes.length > 1 ? `Excluir ${selectedCheckboxes.length} locações` : 'Excluir locação',
      'Esta ação remove a locação E todos os lançamentos financeiros vinculados a ela. Não pode ser desfeita. Deseja continuar?',
      async () => {
        let successCount = 0;
        let errorCount = 0;
        let lastError = '';
        for (const id of selectedCheckboxes) {
          try {
            if (resourceSource?.permanentDelete) {
              const result = await resourceSource.permanentDelete(id);
              if (result.ok) {
                successCount++;
              } else {
                errorCount++;
                if (result.error) lastError = result.error;
              }
            } else {
              throw new Error(`Exclusão definitiva de locação não rastreada por Server Action`);
            }
          } catch {
            errorCount++;
          }
        }
        if (errorCount === 0) {
          showMessage(selectedCheckboxes.length > 1 ? `${successCount} locações excluídas com sucesso!` : 'Locação excluída com sucesso!', 'success');
        } else {
          showMessage(lastError || `${successCount} excluídas. ${errorCount} erros.`, 'error');
        }
        refreshData();
        setSelectedCheckboxes([]);
        setIsCancelLeaseModalOpen(false);
      },
      () => {}
    );
  }, [selectedCheckboxes, showMessage, showPopup, refreshData, resourceSource]);

  const handleApplyFilter = useCallback((filters: Record<string, any>) => {
    setAppliedFilters(filters);
    updateState({ filters, page: 1 });
    setFilterVisible(false);
  }, [updateState]);

  const handleClearFilters = useCallback(() => {
    setAppliedFilters({});
    updateState({ filters: {}, page: 1 });
    setFilterVisible(false);
  }, [updateState]);

  const handlePageChange = useCallback((page: number) => {
    updateState({ page });
  }, [updateState]);

  const handleLimitChange = useCallback((limit: number) => {
    updateState({ limit, page: 1 });
  }, [updateState]);

  const tableData = useMemo(() => {
    if (!meta || !meta.total) {
      return { start: 0, end: 0, allSelected: false };
    }
    const start = (meta.page - 1) * meta.limit + 1;
    const end = Math.min(meta.page * meta.limit, meta.total);
    
    const allSelected = selectedCheckboxes.length > 0 && selectedCheckboxes.length === items.length;
    
    return { start, end, allSelected };
  }, [meta, selectedCheckboxes.length, items, resource]);

  const hasActiveFilters = useMemo(() => Object.keys(appliedFilters).length > 0, [appliedFilters]);
  const activeFilterCount = useMemo(() => Object.keys(appliedFilters).length, [appliedFilters]);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (filterVisible) setFilterVisible(false);
        if (showOwnerTypeModal) setShowOwnerTypeModal(false);
        if (isCancelLeaseModalOpen) setIsCancelLeaseModalOpen(false);
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [filterVisible, showOwnerTypeModal, isCancelLeaseModalOpen]);

  if (isLoadingFilters || isLoadingData) {
    return <SkeletonTable />;
  }

  if (!items || !Array.isArray(items)) {
    return (
      <div className="flex justify-center items-center my-3">
        <div className="bg-surface-subtle py-4 px-6 rounded-sm flex items-center gap-3">
          <p className="text-content-secondary">Erro ao carregar dados da tabela</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-center gap-1 sm:justify-between items-center flex-wrap mb-1 mt-2">
        <div className="flex items-center justify-center sm:justify-start gap-5 max-w-[500px] w-full flex-wrap sm:flex-nowrap relative">
          <div className="flex items-center gap-4">
            {!hideActionButtons && (
              <>
                {canCreatePerm && (
                  resource === 'owners' || resource === 'tenants' ? (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowOwnerTypeModal(true)}
                        className="bg-surface-subtle p-2 rounded hover:bg-ui-border transition-colors relative group"
                        title={`Adicionar novo ${title.toLowerCase()}`}
                      >
                        <Plus size={20} color="var(--color-text-muted)" />
                        <span className="absolute -top-2 -right-2 bg-brand text-content-inverse text-xs rounded-full w-5 h-5 flex items-center justify-center">↓</span>
                      </button>
                      {showOwnerTypeModal && (
                        <ModalSelectTypeOwner
                          onSelect={(type) => {
                            router.push(`${basePath}/cadastrar?tipo=${type}`);
                            setShowOwnerTypeModal(false);
                          }}
                          onClose={() => setShowOwnerTypeModal(false)}
                          className="left-0 top-full"
                        />
                      )}
                    </div>
                  ) : (
                    <Link 
                      href={`${basePath}/cadastrar`} 
                      className="bg-surface-subtle p-2 rounded hover:bg-ui-border transition-colors"
                      title={`Adicionar novo ${title.toLowerCase()}`}
                    >
                      <Plus size={20} color="var(--color-text-muted)" />
                    </Link>
                  )
                )}
                <button
                  type="button"
                  onClick={() => setIsColumnModalOpen(true)}
                  className="hidden sm:block p-2 hover:bg-surface-subtle rounded transition-colors"
                  title="Personalizar colunas"
                >
                  <Settings2 size={20} color="var(--color-text-muted)" />
                </button>
                {enableExcelExport && (
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    disabled={isExporting}
                    className="p-2 hover:bg-surface-subtle rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Exportar para Excel"
                  >
                    <FileSpreadsheet size={20} className={isExporting ? 'animate-pulse' : ''} color="var(--color-text-muted)" />
                  </button>
                )}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setFilterVisible(!filterVisible)}
                    className="p-2 hover:bg-surface-subtle rounded transition-colors"
                    title="Filtrar registros"
                  >
                    <Filter size={20} color={hasActiveFilters ? "var(--color-brand-primary)" : "var(--color-text-muted)"} />
                  </button>
                  {hasActiveFilters && (
                    <span className="absolute -top-1 -right-1 bg-brand text-content-inverse text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </div>
                {canDeletePerm && (
                  <button
                    type="button"
                    onClick={handleDeleteClick}
                    className="p-2 hover:bg-surface-subtle rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={resource === 'leases' ? "Cancelar selecionados" : "Excluir selecionados"}
                    disabled={!selectedCheckboxes.length}
                  >
                    <Trash2 size={20} color="var(--color-text-muted)" />
                  </button>
                )}
              </>
            )}
          </div>

          {filterVisible && (
            <DynamicFilterModal
              visible={filterVisible}
              setVisible={setFilterVisible}
              onApply={handleApplyFilter}
              onClear={handleClearFilters}
              title={title}
              filters={excludeFilterFields ? dynamicFilters.filter((f) => !excludeFilterFields.includes(f.field)) : dynamicFilters}
              initialValues={appliedFilters}
              columns={4}
            />
          )}

          {!useLocalMode && (
            <SearchInput 
              initialValue={state.search}
              onSearch={handleSearch}
              placeholder={searchPlaceholder}
              delay={600}
              autoFocus={autoFocusSearch}
            />
          )}
        </div>

        {/* Contagem e navegação de páginas moram no rodapé fixo (padrão da tela
            de Lançamentos) — aqui fica só o seletor "Exibir N registros". */}
        {!useLocalMode && <SelectLimit limit={state.limit} onLimitChange={handleLimitChange} />}
      </div>

      <div 
        ref={tableContainerRef}
        onScroll={handleTableScroll}
        className="overflow-x-auto rounded-lg shadow-sm"
      >
        <TableInformations
          headers={headers}
          sort={state.sort}
          onSort={handleSort}
          onSelectAll={(e) => handleSelectAll(e.target.checked)}
          allSelected={tableData.allSelected}
          hasActions={!!(canView || canEditPerm || actionsCount > 0)}
          columnWidths={columnWidths}
          onMouseDownResize={handleMouseDownResize}
        >
          {items.map((item: any) => (
            <tr
              key={item.id}
              className="bg-surface hover:bg-surface-subtle border-b border-ui-border-soft text-content-secondary cursor-pointer min-h-[26px] h-fit"
              onClick={() => onRowClick?.(item)}
            >
              {visibleDataColumns.map((col, index) => {
                const isFirst = index === 0;
                const width = columnWidths[col.field] || 150;
                const isContactField = ['contact', 'telephone', 'phone', 'cellphone', 'email', 'contact_name'].includes(col.field);
                
                return (
                  <td 
                    key={col.field} 
                    className="align-middle border-r border-ui-border-soft p-0"
                    style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}
                  >
                    <div className={`flex w-full h-full min-h-[26px] items-center px-2 py-1 ${isFirst ? 'justify-start' : 'justify-center'}`}>
                      {isFirst && canDeletePerm && (
                        <div className="mr-2 flex shrink-0 items-center justify-center w-4 h-4">
                          <input
                            type="checkbox"
                            className="inp-checkbox-select rounded border-ui-border w-full h-full cursor-pointer"
                            value={item.id}
                            checked={selectedCheckboxes.includes(item.id)}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleCheckboxChange(item.id);
                            }}
                          />
                        </div>
                      )}
                      
                      {/* O Segredo: adicionamos 'break-all' e 'min-w-0' se for contato, senão 'truncate' */}
                      <div className={`w-full min-w-0 text-[13px] ${isFirst || col.align === 'left' ? 'text-left' : col.align === 'right' ? 'text-right' : 'text-center'} ${!isContactField ? 'truncate' : 'whitespace-normal break-all'}`}>
                        {col.field === 'description' ? (
                          <div className="relative group w-full">
                            <div className="w-full pr-6">
                              {getCellValue(item, col)}
                            </div>
                          </div>
                        ) : (
                          getCellValue(item, col)
                        )}
                      </div>
                    </div>
                  </td>
                );
              })}

              {(canView || canEditPerm || actionsCount > 0) && (
                <td
                  className="px-1 sticky right-0 bg-surface z-20 border-l border-ui-border-soft align-middle p-0 h-[26px]"
                  style={{ width: actionsCellWidth, minWidth: actionsCellWidth, maxWidth: actionsCellWidth }}
                >
                  <div className="flex items-center justify-center h-full min-h-[26px]">
                    {canView && (
                      <Link
                        href={`${basePath}/visualizar/${item.id}`}
                        title="Visualizar"
                        className="p-1 hover:bg-surface-subtle rounded transition-colors text-brand"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Eye size={16} />
                      </Link>
                    )}
                    {canEditPerm && !onEdit && (
                      <Link
                        href={`${basePath}/editar/${item.id}`}
                        title="Editar"
                        className="p-1 hover:bg-surface-subtle rounded transition-colors text-brand"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Edit size={16} />
                      </Link>
                    )}
                    {canEditPerm && onEdit && (
                      <button
                        type="button"
                        title="Editar"
                        className="p-1 hover:bg-surface-subtle rounded transition-colors text-brand"
                        onClick={(e) => {
                          e.stopPropagation();
                          const index = items.indexOf(item);
                          onEdit(item, index);
                        }}
                      >
                        <Edit size={16} />
                      </button>
                    )}
                    {visibleRowActions.map((action) => (
                      <button
                        key={action.key}
                        type="button"
                        title={action.title}
                        className="p-1 hover:bg-surface-subtle rounded transition-colors text-brand"
                        onClick={(e) => {
                          e.stopPropagation();
                          action.onClick(item);
                        }}
                      >
                        {action.icon}
                      </button>
                    ))}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </TableInformations>
      </div>

      {/* Rodapé fixo de paginação — mesmo padrão visual da tela de Lançamentos
          (Tarefa 8.1): total à esquerda, navegação de páginas à direita. Fica
          de fora no modo local (tabela embutida em formulário, como a de IPTU
          do imóvel), onde um rodapé preso à janela flutuaria sobre a tela. */}
      {!useLocalMode && (
        <>
          <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-ui-border-soft px-3 sm:px-4 py-2 z-50 shadow-lg">
            <div className="flex flex-wrap justify-between items-center gap-2 max-w-[1400px] mx-auto">
              <p className="text-[13px] text-content-secondary">
                {meta && meta.total > 0
                  ? `Total de registros: ${meta.total} (Exibindo ${tableData.start} a ${tableData.end})`
                  : 'Nenhum registro encontrado'}
              </p>

              <div className="flex items-center gap-3">
                {meta && meta.totalPages > 1 && (
                  <Pagination
                    currentPage={meta.page}
                    totalPage={meta.totalPages}
                    onPageChange={handlePageChange}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Espaço para o rodapé fixo não cobrir o fim da tabela */}
          <div className="h-12" />
        </>
      )}

      <ColumnCustomizer
        isOpen={isColumnModalOpen}
        onClose={() => setIsColumnModalOpen(false)}
        columns={displayColumns}
        onReorder={handleColumnsChange}
        onReset={handleResetColumns}
        visibleColumns={visibleColumns}
        onVisibilityChange={handleVisibilityChange}
      />

      {isCancelLeaseModalOpen && (() => {
        const allSelectedCanceled = selectedCheckboxes.length > 0 && items
          .filter((item: any) => selectedCheckboxes.includes(item.id))
          .every((item: any) => item.status === 'CANCELED' || item.status === 'Cancelado');
        return (
          <div className="fixed inset-0 bg-layer-overlay z-[1000001] flex items-center justify-center p-4">
            <div className="bg-surface rounded-xl max-w-xl w-full shadow-2xl animate-fade-in p-6 overflow-y-auto max-h-[95vh]">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-content">
                  {allSelectedCanceled ? 'Excluir Locação' : 'Cancelar ou Excluir Locação'}
                </h3>
                <button
                  onClick={() => setIsCancelLeaseModalOpen(false)}
                  className="p-1 hover:bg-surface-subtle rounded-lg transition-colors"
                  title="Fechar"
                >
                  <X size={20} className="text-content-secondary" />
                </button>
              </div>

              <div className="space-y-4 mb-6 text-content-secondary">
                {allSelectedCanceled ? (
                  <p className="text-sm">
                    {selectedCheckboxes.length > 1 ? 'As locações selecionadas já estão canceladas.' : 'Esta locação já está cancelada.'}{' '}
                    Clique em <strong>Excluir definitivamente</strong> para remover por completo, junto com os lançamentos financeiros vinculados.
                  </p>
                ) : (
                  <>
                    <p className="text-sm">Preencha os dados abaixo e clique em <strong>Confirmar cancelamento</strong> para apenas cancelar {selectedCheckboxes.length > 1 ? 'as locações' : 'a locação'} (pode ser restaurada depois), ou use <strong>Excluir definitivamente</strong> para remover por completo, junto com os lançamentos financeiros vinculados.</p>

                    <div className="flex flex-col gap-1 w-full">
                      <label className="text-sm font-medium text-content">Data de Cancelamento *</label>
                      <input
                        type="date"
                        className="border border-ui-border rounded-lg px-4 h-[40px] text-[14px] bg-surface outline-none focus:border-brand w-full"
                        value={cancelLeaseData.canceled_at}
                        onChange={(e) => setCancelLeaseData({...cancelLeaseData, canceled_at: e.target.value})}
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 w-full">
                      <div className="flex-1 w-full [&>div]:min-w-0 [&>div]:max-w-none">
                        <Input
                          id="cancellation_penalty"
                          label="Valor da Multa"
                          mask="money"
                          value={cancelLeaseData.cancellation_penalty}
                          onChange={(e) => setCancelLeaseData({...cancelLeaseData, cancellation_penalty: e.target.value})}
                          placeholder="R$ 0,00"
                        />
                      </div>
                      <div className="flex-1 w-full [&>div]:min-w-0 [&>div]:max-w-none">
                        <Input
                          id="other_cancellation_amounts"
                          label="Outros Valores"
                          mask="money"
                          value={cancelLeaseData.other_cancellation_amounts}
                          onChange={(e) => setCancelLeaseData({...cancelLeaseData, other_cancellation_amounts: e.target.value})}
                          placeholder="R$ 0,00"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 w-full">
                      <label className="text-sm font-medium text-content">Justificativa</label>
                      <textarea
                        className="border border-ui-border rounded-lg p-4 text-[14px] bg-surface outline-none focus:border-brand min-h-[100px] resize-none w-full"
                        placeholder="Motivo do cancelamento..."
                        value={cancelLeaseData.cancellation_justification}
                        onChange={(e) => setCancelLeaseData({...cancelLeaseData, cancellation_justification: e.target.value})}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-between gap-3 mt-8">
                <button
                  onClick={handleConfirmDeleteLeases}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors order-last sm:order-first"
                >
                  <Trash2 size={16} />
                  Excluir definitivamente
                </button>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setIsCancelLeaseModalOpen(false)}
                    className="px-5 py-2.5 border border-ui-border rounded-lg text-sm font-medium hover:bg-surface-subtle transition-colors"
                  >
                    Fechar
                  </button>
                  {!allSelectedCanceled && (
                    <button
                      onClick={handleConfirmCancelLeases}
                      className="px-5 py-2.5 bg-gradient-to-r from-brand to-brand-hover text-content-inverse rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                      Confirmar cancelamento
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
