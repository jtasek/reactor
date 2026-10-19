import type { FrameEdit } from '../frameEdits';
import type { PasteResult } from '../clipboard';

/** The browser's asynchronous clipboard, which commands use outside a clipboard event. */
export type SystemClipboard = Pick<Clipboard, 'readText' | 'writeText'>;

/** A clipboard event's data, which commands use while the event runs them. */
export type ClipboardEventData = Pick<DataTransfer, 'getData' | 'setData'>;

/** Shapes to cut: their clipboard text, and their ids to remove once it is copied. */
export interface Cut {
    frameIds?: string[];
    documentId?: string;
    text: string;
    shapeIds: string[];
}

/** The root actions that apply what the clipboard answers. */
interface ClipboardActions {
    editFrame?: (edit: FrameEdit) => unknown;
    pasteShapes: (text: string) => PasteResult;
    removeShapes: (shapeIds: string[]) => void;
    displayError: (message: string) => void;
}

const PASTE_ERRORS: Record<Exclude<Extract<PasteResult, string>, 'pasted'>, string> = {
    noShapes: 'The clipboard holds no shapes to paste.',
    notNow: 'Nothing was pasted, as the editor was busy. Paste again.'
};

/**
 * Copies, cuts and pastes for the commands. Run by a clipboard event, as their
 * shortcuts are, a command uses the event's data at once. Otherwise it uses the
 * asynchronous clipboard and applies what it answers through the root actions
 * `connect` gives once startup has run; a cut removes its shapes only once the
 * clipboard holds them.
 */
export function createClipboard(system: SystemClipboard | undefined) {
    let actions: ClipboardActions | undefined;
    let eventData: ClipboardEventData | undefined;
    // Pages served over plain HTTP, other than localhost, have no clipboard.
    const unavailable = () => Promise.reject(new Error('The clipboard is unavailable'));

    /** Puts `text` on the clipboard; returns whether it is there. */
    const write = async (text: string, keys: string) => {
        if (eventData) {
            eventData.setData('text/plain', text);

            return true;
        }

        try {
            await (system ? system.writeText(text) : unavailable());

            return true;
        } catch {
            actions?.displayError(`The clipboard could not be written. Press ${keys}.`);

            return false;
        }
    };

    const apply = (text: string) => {
        const result = actions?.pasteShapes(text);

        if (!actions || !result || result === 'pasted') {
            return;
        }
        actions.displayError(
            typeof result === 'string'
                ? PASTE_ERRORS[result]
                : `Nothing was pasted. ${result.problem}`
        );
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
            await write(text, 'Ctrl/Cmd+C');
        },

        async cut({ text, shapeIds, frameIds, documentId }: Cut) {
            if (await write(text, 'Ctrl/Cmd+X')) {
                actions?.removeShapes(shapeIds);
                frameIds?.forEach((id) => actions?.editFrame?.({ kind: 'delete', id, documentId }));
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
