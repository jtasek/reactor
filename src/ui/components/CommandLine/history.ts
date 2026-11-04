import { CREATION_PATTERN } from './creation';
import { EDIT_ACTIONS, editorForInput, editorInput } from './parameters';
import type { Suggestion } from './search';

// Kept short so suggested actions stay visible below the recent list.
const RECENT_LIMIT = 5;
const DOCUMENT_LIMIT = 16;
// Palette UI state only: never saved into documents, storage, or collaboration.
const histories = new Map<string, string[]>();

export const recentCommands = (documentId: string): string[] => histories.get(documentId) ?? [];

/** Undo and redo would only repeat themselves and push real edits out of the list. */
const NOT_RECORDED = /^(?:undo|redo)$/i;

/** Parameters keep their case (text values differ); bare command names do not. */
const sameCommand = (a: string, b: string) =>
    a.includes('=') || b.includes('=') ? a === b : a.toLowerCase() === b.toLowerCase();

export function rememberCommand(documentId: string, command: string): string[] {
    const input = command.trim();
    if (NOT_RECORDED.test(input)) {
        return recentCommands(documentId);
    }
    const next = [
        input,
        ...recentCommands(documentId).filter((item) => !sameCommand(item, input))
    ].slice(0, RECENT_LIMIT);
    histories.delete(documentId);
    histories.set(documentId, next);
    if (histories.size > DOCUMENT_LIMIT) {
        histories.delete(histories.keys().next().value!);
    }

    return next;
}

export const clearRecentCommands = (documentId: string) => {
    histories.delete(documentId);
};

/** Resolve presentation and availability from today's catalogue, not recorded metadata. */
/** A bind command shows its variable by current name; the input keeps the stable ID. */
export function readableCommand(
    input: string,
    variables: { id: string; name: string }[] = []
): string {
    const editor = editorForInput(input);
    const variable =
        editor?.prefix === 'bind'
            ? variables.find(({ id }) => id === editor.values.variable)
            : undefined;

    return editor && variable
        ? editorInput({ ...editor, values: { ...editor.values, variable: variable.name } })
        : input;
}

export function recentSuggestion(
    input: string,
    suggestions: Suggestion[],
    variables: { id: string; name: string }[] = []
): Suggestion {
    const query = input.toLowerCase();
    const exact = suggestions.find(
        (item) => item.id.toLowerCase() === query || item.name.toLowerCase() === query
    );
    const creation = CREATION_PATTERN.exec(input);
    const editor = editorForInput(input);
    const actionId = recentAction();
    function recentAction() {
        if (creation) {
            return `create ${creation[1].toLowerCase()}`;
        }
        if (!editor) {
            return undefined;
        }
        if (editor.prefix === 'bind') {
            return 'bind variable';
        }
        if (editor.prefix === 'unbind') {
            return 'unbind variable';
        }
        if (editor.prefix === 'move') {
            return 'edit position';
        }
        if (['value', 'fontSize', 'fontColor'].some((key) => key in editor.values)) {
            return 'edit text';
        }
        if (['fill', 'stroke'].some((key) => key in editor.values)) {
            return 'edit colors';
        }
        if (['gap', 'padding'].some((key) => key in editor.values)) {
            return 'edit stack';
        }
        if ('radius' in editor.values && Object.keys(editor.values).length === 1) {
            return 'edit radius';
        }

        return 'edit size';
    }
    const action = exact ?? suggestions.find((item) => item.id === actionId);

    return {
        id: `recent:${input}`,
        name: action?.name ?? input,
        description: readableCommand(input, variables),
        input,
        icon: action?.icon,
        enabled: action?.enabled ?? false,
        unavailable:
            action?.unavailable ??
            (action
                ? undefined
                : actionId && EDIT_ACTIONS.some((item) => item.id === actionId)
                  ? // Hidden for this kind of selection (e.g. radius on frames), not removed.
                    'Not available for the current selection.'
                  : 'This command is no longer available.')
    };
}
