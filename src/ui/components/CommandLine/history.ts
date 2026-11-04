import { CREATION_PATTERN } from './creation';
import { editorForInput } from './parameters';
import type { Suggestion } from './search';

const RECENT_LIMIT = 8;
const DOCUMENT_LIMIT = 16;
// Palette UI state only: never saved into documents, storage, or collaboration.
const histories = new Map<string, string[]>();

export const recentCommands = (documentId: string): string[] => histories.get(documentId) ?? [];

export function rememberCommand(documentId: string, command: string): string[] {
    const input = command.trim();
    const next = [input, ...recentCommands(documentId).filter((item) => item !== input)].slice(
        0,
        RECENT_LIMIT
    );
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
            action?.unavailable ?? (!action ? 'This command is no longer available.' : undefined)
    };
}
