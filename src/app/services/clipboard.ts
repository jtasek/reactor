/** The browser's asynchronous clipboard, which commands use outside a clipboard event. */
export type SystemClipboard = Pick<Clipboard, 'readText' | 'writeText'>;

/** A clipboard event's data, which commands use while the event runs them. */
export type ClipboardEventData = Pick<DataTransfer, 'getData' | 'setData'>;

/** The root actions that apply what the clipboard answers. */
interface ClipboardActions {
    pasteShapes: (text: string) => boolean;
    displayError: (message: string) => void;
}

/**
 * Copies and pastes for the commands. Run by a clipboard event, as the copy, cut
 * and paste shortcuts are, a command uses the event's data at once. Otherwise it
 * uses the asynchronous clipboard, and a paste is applied through the root
 * actions `connect` gives once startup has run.
 */
export function createClipboard(system: SystemClipboard | undefined) {
    let actions: ClipboardActions | undefined;
    let eventData: ClipboardEventData | undefined;
    // Pages served over plain HTTP, other than localhost, have no clipboard.
    const unavailable = () => Promise.reject(new Error('The clipboard is unavailable'));

    const apply = (text: string) => {
        if (actions && !actions.pasteShapes(text)) {
            actions.displayError('The clipboard holds no shapes to paste.');
        }
    };

    return {
        connect(root: ClipboardActions) {
            actions = root;
        },

        /** Runs `run`, as a command, with a clipboard event's data. */
        during(data: ClipboardEventData, run: () => void) {
            eventData = data;

            try {
                run();
            } finally {
                eventData = undefined;
            }
        },

        async copy(text: string) {
            if (eventData) {
                eventData.setData('text/plain', text);

                return;
            }

            try {
                await (system ? system.writeText(text) : unavailable());
            } catch {
                actions?.displayError('The clipboard could not be written. Press Ctrl/Cmd+C.');
            }
        },

        async paste() {
            if (eventData) {
                apply(eventData.getData('text/plain'));

                return;
            }

            let text: string;

            try {
                text = await (system ? system.readText() : unavailable());
            } catch {
                actions?.displayError(
                    'The clipboard could not be read. Allow this site to read it, or press Ctrl/Cmd+V.'
                );

                return;
            }

            apply(text);
        }
    };
}

export const clipboard = createClipboard(globalThis.navigator?.clipboard);
