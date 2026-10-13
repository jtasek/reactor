import { RefObject, useEffect, useLayoutEffect, useRef } from 'react';

const MENU_GAP = 6;
const VIEWPORT_MARGIN = 8;

/**
 * Places a popup under its anchor and closes it on Escape, a press outside or focus
 * leaving it. It takes focus once, as it opens, so the anchor's re-renders leave the
 * focus where the person put it.
 */
export function useAnchoredPopup(
    menu: RefObject<HTMLDivElement | null>,
    anchor: HTMLButtonElement,
    onClose: () => void
) {
    const close = useRef(onClose);

    useEffect(() => {
        close.current = onClose;
    });

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
        const outside = (target: EventTarget | null) =>
            target instanceof Node && !element.contains(target) && !anchor.contains(target);
        const dismiss = (event: PointerEvent) => {
            if (outside(event.target)) {
                close.current();
            }
        };
        const leave = (event: FocusEvent) => {
            if (outside(event.relatedTarget)) {
                close.current();
            }
        };
        const escape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                anchor.focus();
                close.current();
            }
        };
        const resize = new ResizeObserver(position);
        resize.observe(element);
        element.addEventListener('keydown', escape);
        element.addEventListener('focusout', leave);
        position();
        document.addEventListener('pointerdown', dismiss);
        window.addEventListener('resize', position);
        window.addEventListener('scroll', position, true);
        return () => {
            resize.disconnect();
            element.removeEventListener('keydown', escape);
            element.removeEventListener('focusout', leave);
            document.removeEventListener('pointerdown', dismiss);
            window.removeEventListener('resize', position);
            window.removeEventListener('scroll', position, true);
        };
    }, [menu, anchor]);

    useLayoutEffect(() => {
        (
            menu.current?.querySelector<HTMLElement>('input, [aria-checked="true"]') ??
            menu.current?.querySelector<HTMLButtonElement>('button') ??
            menu.current
        )?.focus();
    }, [menu]);
}
