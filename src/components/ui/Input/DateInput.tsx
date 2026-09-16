'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import Label from '../Label';
import type { InputProps } from './index';
import { dateDisplay, dateValue, editDate } from './date-edit';
import { isValidIsoDateString } from '@/shared/utils/date-utils';

export default function DateInput({ id, label, required, value, onChange, onBlur, placeholder, svg, disabled, tabIndex, autoFocus, full }: InputProps) {
  const external = String(value ?? '');
  const [draft, setDraft] = useState(() => dateDisplay(external));
  const [lastValue, setLastValue] = useState(external);
  const input = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  // Parent echoes must not reformat an in-progress edit or move its cursor.
  if (value !== undefined && external !== lastValue) {
    setLastValue(external);
    setDraft(dateDisplay(external));
  }
  useLayoutEffect(() => {
    if (caret.current !== null) {
      input.current?.setSelectionRange(caret.current, caret.current);
      caret.current = null;
    }
  });
  const emit = (text: string) => {
    setDraft(text);
    const nextValue = dateValue(text);
    setLastValue(nextValue);
    onChange?.({ target: { id, name: id, value: nextValue }, currentTarget: { id, name: id, value: nextValue } } as React.ChangeEvent<HTMLInputElement>);
  };
  const iso = dateValue(draft);
  return (
    <div className={`flex flex-col font-poppins w-full flex-1 ${full ? '' : 'min-w-[300px] max-w-[300px]'}`}>
      <Label id={id} label={label} required={required} svg={svg} />
      <div className="relative flex items-center">
        <input ref={input} id={id} name={id} type="text" inputMode="numeric" autoFocus={autoFocus}
          value={draft} placeholder={placeholder || 'DD/MM/AAAA'} required={required} disabled={disabled} tabIndex={tabIndex}
          onChange={(event) => {
            event.target.setCustomValidity('');
            const edit = editDate(event.target.value, event.target.selectionStart ?? event.target.value.length);
            caret.current = edit.caret;
            emit(edit.text);
          }}
          onKeyDown={(event) => {
            const start = event.currentTarget.selectionStart ?? 0;
            if (start !== event.currentTarget.selectionEnd) return;
            const backward = event.key === 'Backspace' && draft[start - 1] === '/';
            const forward = event.key === 'Delete' && draft[start] === '/';
            if (!backward && !forward) return;
            event.preventDefault();
            const index = backward ? start - 2 : start + 1;
            if (index < 0 || index >= draft.length) return;
            caret.current = backward ? index : start;
            emit(draft.slice(0, index) + draft.slice(index + 1));
          }}
          onBlur={(event) => {
            event.target.setCustomValidity(draft && !isValidIsoDateString(iso) ? 'Informe uma data válida.' : '');
            onBlur?.({ ...event, target: { ...event.target, id, name: id, value: iso }, currentTarget: { ...event.currentTarget, id, name: id, value: iso } } as React.FocusEvent<HTMLInputElement>);
          }}
          onFocus={() => input.current?.setCustomValidity('')}
          onPaste={(event) => {
            const pasted = event.clipboardData.getData('text').trim();
            if (isValidIsoDateString(pasted)) { event.preventDefault(); emit(dateDisplay(pasted)); }
          }}
          className={`w-full border rounded-lg h-[40px] outline-none pl-5 pr-12 text-[14px] font-normal border-ui-border text-content-secondary placeholder:text-content-placeholder ${disabled ? 'bg-surface-muted cursor-not-allowed' : ''}`}
        />
        <span className="absolute right-3 flex h-6 w-6 items-center justify-center text-content-muted">
          <CalendarDays size={19} aria-hidden="true" />
          <input type="date" aria-label={`Selecionar ${label || 'data'} no calendário`} disabled={disabled}
            value={isValidIsoDateString(iso) ? iso : ''}
            onClick={(event) => { try { event.currentTarget.showPicker?.(); } catch { /* Native control remains usable. */ } }}
            onChange={(event) => { emit(dateDisplay(event.target.value)); input.current?.setCustomValidity(''); input.current?.focus(); }}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </span>
      </div>
    </div>
  );
}
