'use client';

import { Palette } from 'lucide-react';
import type { FormStep } from '@/types/types';
import ThemeEditor from './ThemeEditor';
import { BRANDING_COLOR_KEYS } from '@/lib/brandingTheme';

/** Keep both palettes in the form even when only one is being edited. */
export function companyThemeStep(): FormStep {
  return {
    title: 'Tema e aparência',
    icon: <Palette size={20} />,
    fields: [
      ...BRANDING_COLOR_KEYS.map(field => ({ field, label: '', type: 'text' as const, hidden: true, defaultValue: '' })),
      {
        field: '__theme_editor', label: '', type: 'custom', className: 'basis-full w-full min-w-0',
        render: (_value, values, _onChange, setField) => (
          <ThemeEditor values={values ?? {}} onChange={(field, value) => setField?.(field, value)} />
        ),
      },
    ],
  };
}
