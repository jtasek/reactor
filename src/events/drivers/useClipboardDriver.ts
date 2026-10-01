import { useEffect } from 'react';
import { useActions, useTakesEditorInput } from '../../app/hooks';
import { isTextEntry } from './helpers';

const CLIPBOARD_KEYS = new Set(['c', 'x', 'v']);

/**
 * A hidden field focused, with text selected, while Ctrl/Cmd+C, X or V is pressed
 * outside text: some browsers, as Safari, disable the clipboard commands and send
 * no event when nothing is selected.
 */
function createClipboardTarget() {
    const target = document.createElement('textarea');

    target.tabIndex = -1;
    target.setAttribute('aria-hidden', 'true');
    Object.assign(target.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '1px',
        height: '1px',
        opacity: '0',
        pointerEvents: 'none'
    });

    return target;
}

/** Copies, cuts and pastes shapes through the browser's clipboard events. */
export const useClipboardDriver = () => {
    const { copySelection, cutSelection, pasteShapes } = useActions();
    const takesInput = useTakesEditorInput();

    useEffect(() => {
        const clipboardTarget = createClipboardTarget();
        let previousFocus: Element | null = null;

        // Leaves the browser's own clipboard to text fields and text selected on the page.
        const isNativeClipboard = (target: EventTarget | null) =>
            target !== clipboardTarget &&
            (isTextEntry(target) || window.getSelection()?.isCollapsed === false);

        const release = () => {
            if (document.activeElement !== clipboardTarget) {
                return;
            }

            clipboardTarget.value = '';
            clipboardTarget.blur();

            if (previousFocus instanceof HTMLElement) {
                previousFocus.focus({ preventScroll: true });
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (
                !takesInput ||
                !(event.ctrlKey || event.metaKey) ||
                event.altKey ||
                !CLIPBOARD_KEYS.has(event.key.toLowerCase()) ||
                isNativeClipboard(event.target)
            ) {
                return;
            }

            previousFocus = document.activeElement;
            clipboardTarget.value = ' ';
            clipboardTarget.focus({ preventScroll: true });
            clipboardTarget.select();
        };

        const write = (take: () => string | null) => (event: ClipboardEvent) => {
            if (!event.clipboardData || isNativeClipboard(event.target)) {
                return;
            }

            const text = take();

            // The hidden field's own text never reaches the clipboard.
            if (text !== null || event.target === clipboardTarget) {
                event.preventDefault();
            }

            if (text !== null) {
                event.clipboardData.setData('text/plain', text);
            }

            release();
        };
        const handleCopy = write(copySelection);
        const handleCut = write(cutSelection);
        const handlePaste = (event: ClipboardEvent) => {
            if (!event.clipboardData || isNativeClipboard(event.target)) {
                return;
            }

            if (
                pasteShapes(event.clipboardData.getData('text/plain')) ||
                event.target === clipboardTarget
            ) {
                event.preventDefault();
            }

            release();
        };

        document.body.append(clipboardTarget);
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', release);
        document.addEventListener('copy', handleCopy);
        document.addEventListener('cut', handleCut);
        document.addEventListener('paste', handlePaste);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', release);
            document.removeEventListener('copy', handleCopy);
            document.removeEventListener('cut', handleCut);
            document.removeEventListener('paste', handlePaste);
            clipboardTarget.remove();
        };
    }, [copySelection, cutSelection, pasteShapes, takesInput]);
};
