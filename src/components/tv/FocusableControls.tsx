import { useCallback, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type Ref, type SelectHTMLAttributes } from 'react';
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';

type MutableElementRef<T extends HTMLElement> = { current: T | null };

function mergeFocusRef<T extends HTMLElement>(focusRef: unknown, ownRef: MutableElementRef<T>, node: T | null): void {
  ownRef.current = node;
  if (typeof focusRef === 'function') (focusRef as (target: T | null) => void)(node);
  else if (focusRef && typeof focusRef === 'object' && 'current' in focusRef) {
    (focusRef as MutableElementRef<T>).current = node;
  }
}

function generatedFocusKey(prefix: string, reactId: string): string {
  return prefix + reactId.replace(/[^a-zA-Z0-9_-]/g, '');
}

export interface TVButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  focusKey?: string;
}

export function TVButton({ focusKey, className, disabled, onClick, ...props }: TVButtonProps) {
  const generatedId = useId();
  const resolvedFocusKey = focusKey ?? generatedFocusKey('TV-BUTTON-', generatedId);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const { ref, focused } = useFocusable({
    focusKey: resolvedFocusKey,
    focusable: !disabled,
    autoRestoreFocus: true,
    onEnterPress: () => { if (!disabled) buttonRef.current?.click(); },
  });
  const mergedRef = useCallback((node: HTMLButtonElement | null) => mergeFocusRef(ref, buttonRef, node), [ref]);

  return (
    <button
      {...props}
      ref={mergedRef as Ref<HTMLButtonElement>}
      disabled={disabled}
      onClick={onClick}
      className={[className, focused ? 'tv-focusable--focused' : ''].filter(Boolean).join(' ')}
      data-tv-focused={focused ? 'true' : undefined}
    />
  );
}

export interface TVInputProps extends InputHTMLAttributes<HTMLInputElement> {
  focusKey?: string;
}

export function TVInput({ focusKey, className, disabled, type, ...props }: TVInputProps) {
  const generatedId = useId();
  const resolvedFocusKey = focusKey ?? generatedFocusKey('TV-INPUT-', generatedId);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { ref, focused } = useFocusable({
    focusKey: resolvedFocusKey,
    focusable: !disabled && type !== 'hidden',
    autoRestoreFocus: true,
    onEnterPress: () => {
      const input = inputRef.current;
      if (!input || disabled) return;
      if (input.type === 'checkbox' || input.type === 'radio' || input.type === 'file') {
        input.click();
        return;
      }
      if (input.type === 'range') {
        input.focus();
        return;
      }
      if (input.dataset.assistantInput !== undefined) {
        const submitButton = input.form?.querySelector<HTMLButtonElement>('button[type="submit"], button:not([type])');
        if (submitButton && !submitButton.disabled) submitButton.click();
        else input.focus();
        return;
      }
      input.focus();
      input.click();
    },
    onArrowPress: (direction: string) => {
      const input = inputRef.current;
      if (!input || input.type !== 'range' || (direction !== 'left' && direction !== 'right')) return true;

      const min = input.min === '' ? 0 : Number(input.min);
      const max = input.max === '' ? 100 : Number(input.max);
      const step = input.step === '' || input.step === 'any' ? 1 : Math.max(1e-6, Number(input.step));
      const current = Number(input.value);
      const next = Math.max(min, Math.min(max, current + (direction === 'right' ? step : -step)));
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      valueSetter?.call(input, String(next));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return false;
    },
  });
  const mergedRef = useCallback((node: HTMLInputElement | null) => mergeFocusRef(ref, inputRef, node), [ref]);

  return (
    <input
      {...props}
      ref={mergedRef as Ref<HTMLInputElement>}
      type={type}
      disabled={disabled}
      className={[className, focused ? 'tv-focusable--focused' : ''].filter(Boolean).join(' ')}
      data-tv-focused={focused ? 'true' : undefined}
    />
  );
}

export interface TVSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  focusKey?: string;
}

export function TVSelect({ focusKey, className, disabled, ...props }: TVSelectProps) {
  const generatedId = useId();
  const resolvedFocusKey = focusKey ?? generatedFocusKey('TV-SELECT-', generatedId);
  const selectRef = useRef<HTMLSelectElement | null>(null);
  const { ref, focused } = useFocusable({
    focusKey: resolvedFocusKey,
    focusable: !disabled,
    autoRestoreFocus: true,
    onEnterPress: () => {
      if (!selectRef.current || disabled) return;
      selectRef.current.focus();
      selectRef.current.click();
    },
  });
  const mergedRef = useCallback((node: HTMLSelectElement | null) => mergeFocusRef(ref, selectRef, node), [ref]);

  return (
    <select
      {...props}
      ref={mergedRef as Ref<HTMLSelectElement>}
      disabled={disabled}
      className={[className, focused ? 'tv-focusable--focused' : ''].filter(Boolean).join(' ')}
      data-tv-focused={focused ? 'true' : undefined}
    />
  );
}
