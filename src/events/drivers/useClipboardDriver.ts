import { useEffect, useRef } from 'react';
import { getCommands } from '../../app/actions/startup';
import { useActions, useEffects, useTakesEditorInput } from '../../app/hooks';
import { matchesShortcut } from '../shortcuts';
import { isTextEntry } from './helpers';

const clipboardCommands = () => getCommands().filter(({ clipboardEvent }) => clipboardEvent);

/**
 * A hidden field focused, with text selected, while a clipboard command's shortcut
 * is pressed outside text: some browsers, as Safari, disable the clipboard commands and send
 * no event when nothing is selected.
 */
function createClipboardTarget() {
    const target = document.createElement('textarea');

    target.tabIndex = -1;
    target.setAttribute('aria-label', 'Clipboard');
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

/**
 * Runs the copy, cut and paste commands from the browser's clipboard events, with
 * the event's data, so their shortcuts work like the browser's own.
 */
export const useClipboardDriver = () => {
    const { runCommand } = useActions();
    const { clipboard } = useEffects();
    const takesInput = useTakesEditorInput();
    // Read when a key is pressed, so a drag or typing does not remount the listeners.
    const takesInputNow = useRef(takesInput);

    useEffect(() => {
        takesInputNow.current = takesInput;
    }, [takesInput]);

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
                !takesInputNow.current ||
                isNativeClipboard(event.target) ||
                !clipboardCommands().some(
                    ({ shortcut }) => shortcut && matchesShortcut(shortcut, event)
                )
            ) {
                return;
            }

            previousFocus = document.activeElement;
            clipboardTarget.value = ' ';
            clipboardTarget.focus({ preventScroll: true });
            clipboardTarget.select();
        };

        const handleClipboard = (event: ClipboardEvent) => {
            const command = clipboardCommands().find(
                ({ clipboardEvent }) => clipboardEvent === event.type
            );
            const data = event.clipboardData;

            if (!command || !data || isNativeClipboard(event.target)) {
                return;
            }

            let ran = false;

            clipboard.during(data, () => {
                ran = runCommand(command);
            });

            // The hidden field's own text never reaches the clipboard.
            if (ran || event.target === clipboardTarget) {
                event.preventDefault();
            }

            release();
        };

        document.body.append(clipboardTarget);
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', release);
        document.addEventListener('copy', handleClipboard);
        document.addEventListener('cut', handleClipboard);
        document.addEventListener('paste', handleClipboard);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', release);
            document.removeEventListener('copy', handleClipboard);
            document.removeEventListener('cut', handleClipboard);
            document.removeEventListener('paste', handleClipboard);
            clipboardTarget.remove();
        };
    }, [clipboard, runCommand]);
};
