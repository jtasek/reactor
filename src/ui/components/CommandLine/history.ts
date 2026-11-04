import { CREATION_PATTERN } from './creation';
import { EDIT_ACTIONS, editorForInput } from './parameters';
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
export function recentSuggestion(input: string, suggestions: Suggestion[]): Suggestion {
    const query = input.toLowerCase();
    const exact = suggestions.find(
        (item) => item.id.toLowerCase() === query || item.name.toLowerCase() === query
    );
    const creation = CREATION_PATTERN.exec(input);
    const editor = editorForInput(input);
    const actionId = creation
        ? `create ${creation[1].toLowerCase()}`
        : editor?.prefix === 'move'
          ? 'edit position'
          : editor && ('gap' in editor.values || 'padding' in editor.values)
            ? 'edit stack'
            : editor && 'radius' in editor.values && Object.keys(editor.values).length === 1
              ? 'edit radius'
              : editor
                ? 'edit size'
                : undefined;
    const action = exact ?? suggestions.find((item) => item.id === actionId);

    return {
        id: `recent:${input}`,
        name: action?.name ?? input,
        description: input,
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
