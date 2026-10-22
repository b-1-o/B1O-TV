import type { HTMLAttributes, ReactNode, Ref } from 'react';
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation';

export interface CardGridProps extends HTMLAttributes<HTMLDivElement> {
  focusKey: string;
  focusBoundary?: boolean;
  children?: ReactNode;
}

/** Keep spatial calculations scoped to a related group of controls. */
export function CardGrid({ focusKey, focusBoundary = false, children, ...props }: CardGridProps) {
  const { ref, focusKey: childFocusKey } = useFocusable({
    focusKey,
    trackChildren: true,
    autoRestoreFocus: true,
    isFocusBoundary: focusBoundary,
  });

  return (
    <FocusContext.Provider value={childFocusKey}>
      <div {...props} ref={ref as Ref<HTMLDivElement>}>
        {children}
      </div>
    </FocusContext.Provider>
  );
}

export function FocusGroup(props: CardGridProps) {
  return <CardGrid {...props} />;
}
