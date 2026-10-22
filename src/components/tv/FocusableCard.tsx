import type { ButtonHTMLAttributes } from 'react';
import { TVButton } from './FocusableControls';

export interface FocusableCardProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'id' | 'title' | 'onClick'> {
  id: string;
  title: string;
  onSelect: () => void;
}

/** A TV card with a stable ID, visible focus state and OK/Enter activation. */
export function FocusableCard({ id, title, onSelect, className, children, ...buttonProps }: FocusableCardProps) {
  const ariaLabel = buttonProps['aria-label'] ?? title;
  return (
    <TVButton
      {...buttonProps}
      focusKey={`CARD-${id}`}
      className={className}
      aria-label={ariaLabel}
      onClick={onSelect}
    >
      {children ?? title}
    </TVButton>
  );
}
