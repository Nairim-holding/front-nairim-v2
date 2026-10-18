'use client';
import QuickCreateAutocomplete, { isQuickCreateSentinel } from './QuickCreateAutocomplete';
import { usePermissions } from '@/contexts/PermissionsContext';
import type { Option } from '@/types/types';
export default function QuickRecordField({ resource, label, value, onChange, options, disabled = false }: {
  resource: 'owners' | 'tenants' | 'agencies' | 'property-types'; label: string; value: string;
  onChange?: (value: string) => void; options: Option[]; disabled?: boolean;
}) {
  const { can } = usePermissions();
  return <><QuickCreateAutocomplete size="md" ariaLabel={label} value={value || ''} onChange={next => onChange?.(next)} options={options}
    disabled={disabled} allowCreate={!disabled && can(resource, 'create')} placeholder="Selecione ou digite para cadastrar..." openOnFocus={!value} />
    {isQuickCreateSentinel(value) && <p className="mt-1 text-xs text-content-muted">Será criado ao salvar. {resource === 'property-types' ? '' : 'Os demais dados serão provisórios; revise o cadastro completo antes de usar documentos ou relatórios.'}{resource === 'agencies' ? ' Configure a comissão antes de cadastrar uma locação.' : ''}</p>}</>;
}
