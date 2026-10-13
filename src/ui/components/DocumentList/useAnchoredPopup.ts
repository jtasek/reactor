import { RefObject, useLayoutEffect } from 'react';

const MENU_GAP = 6;
const VIEWPORT_MARGIN = 8;

export function useAnchoredPopup(
    menu: RefObject<HTMLDivElement | null>,
    anchor: HTMLButtonElement,
    onClose: () => void
) {
    useLayoutEffect(() => {
        const element = menu.current;
        if (!element) {
            return;
        }
        const position = () => {
            const bounds = anchor.getBoundingClientRect();
            const left = Math.max(
                VIEWPORT_MARGIN,
                Math.min(bounds.left, window.innerWidth - element.offsetWidth - VIEWPORT_MARGIN)
            );
            const top = bounds.bottom + MENU_GAP;
            element.style.left = `${left}px`;
            element.style.top = `${Math.max(VIEWPORT_MARGIN, Math.min(top, window.innerHeight - element.offsetHeight - VIEWPORT_MARGIN))}px`;
        };
        const dismiss = (event: PointerEvent) => {
            if (
                event.target instanceof Node &&
                !element.contains(event.target) &&
                !anchor.contains(event.target)
            ) {
                onClose();
            }
        };
        const escape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                anchor.focus();
                onClose();
            }
        };
        const resize = new ResizeObserver(position);
        resize.observe(element);
        element.addEventListener('keydown', escape);
        position();
        (
            element.querySelector<HTMLElement>('input, [aria-checked="true"]') ??
            element.querySelector<HTMLButtonElement>('button') ??
            element
        ).focus();
        document.addEventListener('pointerdown', dismiss);
        window.addEventListener('resize', position);
        window.addEventListener('scroll', position, true);
        return () => {
            resize.disconnect();
            element.removeEventListener('keydown', escape);
            document.removeEventListener('pointerdown', dismiss);
            window.removeEventListener('resize', position);
            window.removeEventListener('scroll', position, true);
        };
    }, [menu, anchor, onClose]);
}
