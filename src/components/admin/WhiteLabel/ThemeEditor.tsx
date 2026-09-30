'use client';

import { useState } from 'react';
import { Moon, Sun, WandSparkles } from 'lucide-react';
import Toggle from '@/components/ui/Toggle';
import { COLOR_FIELDS } from '@/lib/brandingTheme';
import { generateDarkColorsFromLight } from '@/lib/colorUtils';
import { isSafeBrandingColor } from '@/shared/validators/branding-color';
import ColorInput from './ColorInput';
import BrandingPreview from './BrandingPreview';

interface ThemeEditorProps {
  values: Record<string, unknown>;
  onChange: (field: string, value: string) => void;
}

export default function ThemeEditor({ values, onChange }: ThemeEditorProps) {
  const [isDark, setIsDark] = useState(false);
  const branding = Object.fromEntries(Object.entries(values).filter(([, value]) => typeof value === 'string' && value !== ''));
  const suggestDark = () => {
    const light = Object.fromEntries(COLOR_FIELDS.map(({ key, defaultValue }) => [key,
      isSafeBrandingColor(values[key]) ? values[key] : defaultValue]));
    Object.entries(generateDarkColorsFromLight(light)).forEach(([key, value]) => onChange(key, value));
  };

  return (
    <div className="space-y-5" data-testid="theme-editor">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-ui-border-soft bg-surface-subtle p-4">
        <div className="flex items-start gap-3">
          {isDark ? <Moon size={20} className="mt-0.5 text-brand" /> : <Sun size={20} className="mt-0.5 text-brand" />}
          <div>
            <h3 className="font-semibold text-content">{isDark ? 'Personalize o modo noturno' : 'Personalize o modo claro'}</h3>
            <p className="mt-1 text-sm text-content-muted">Altere as cores e veja o resultado ao lado. Cada modo mantém sua própria paleta.</p>
          </div>
        </div>
        <Toggle checked={isDark} onChange={setIsDark} label="Modo noturno" />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(260px,0.75fr)_minmax(0,1.6fr)]">
        <div className="min-w-0 space-y-5">
          {['Marca', 'Superfícies e texto', 'Estados e avisos'].map(group => (
            <fieldset key={group} className="rounded-xl border border-ui-border-soft p-4">
              <legend className="px-2 text-sm font-semibold text-content">{group}</legend>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                {COLOR_FIELDS.filter(field => field.group === group).map(({ key, label, defaultValue, darkDefault }) => {
                  const field = isDark ? `${key}_dark` : key;
                  const canInherit = !['bg_color', 'card_color', 'border_color', 'text_color'].includes(key);
                  const fallback = isDark ? (canInherit && isSafeBrandingColor(values[key]) ? values[key] : darkDefault) : defaultValue;
                  return <ColorInput key={field} label={label} value={typeof values[field] === 'string' ? values[field] : ''}
                    defaultValue={fallback} onChange={value => onChange(field, value)} />;
                })}
              </div>
            </fieldset>
          ))}
          {isDark && <div className="space-y-2">
            <button type="button" onClick={suggestDark} className="flex items-center gap-2 rounded-lg border border-ui-border px-3 py-2 text-sm text-content hover:bg-surface-subtle">
              <WandSparkles size={16} /> Sugerir cores noturnas
            </button>
            <p className="text-xs text-content-muted">Substitui a paleta noturna por uma sugestão baseada nas cores do modo claro.</p>
          </div>}
        </div>

        <div className="min-w-0 space-y-3 xl:sticky xl:top-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-content">Prévia em tempo real</h3>
            <span className="inline-flex items-center gap-1.5 text-xs text-content-muted"><span className="h-1.5 w-1.5 rounded-full bg-state-success" />{isDark ? 'Modo noturno' : 'Modo claro'}</span>
          </div>
          <BrandingPreview branding={branding} mode={isDark ? 'dark' : 'light'} />
          <p className="text-xs text-content-muted">Componentes do sistema com dados de exemplo. As cores serão aplicadas à empresa ao salvar.</p>
        </div>
      </div>
    </div>
  );
}
