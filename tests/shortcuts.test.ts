import { registerCommand, registerTool } from 'src/app/actions/startup';
import type { Command } from 'src/app/types';
import * as commands from 'src/commands';
import * as tools from 'src/tools';
import type { Tool } from 'src/tools/types';
import type { KeyPress } from 'src/events/shortcuts';
import { createTestStore } from './support/store';

const isTool = (item: unknown): item is Tool =>
    typeof item === 'object' && item !== null && 'designComponent' in item;

// Every command and tool the app defines, however they are exported.
const allCommands: Command[] = Object.values(commands);
const allTools = Object.values(tools).filter(isTool);
const everything = [...allCommands, ...allTools];

// Commands and tools are registered by application startup, which the test store skips.
allCommands.forEach(registerCommand);
allTools.forEach(registerTool);

const press = (key: string, modifiers: Partial<Omit<KeyPress, 'key'>> = {}): KeyPress => ({
    key,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...modifiers
});

function storeWithRect(selected: boolean) {
    const { store } = createTestStore();

    store.actions.addShape({
        type: 'rectangle',
        position: { x: 0, y: 0 },
        size: { width: 10, height: 10 },
        selected
    });

    return store;
}

describe('keyboard shortcuts', () => {
    it('gives every tool and command its own binding', () => {
        const bindings = everything.flatMap(({ shortcut }) =>
            (shortcut ?? '')
                .split(',')
                .map((binding) => binding.trim().toLowerCase())
                .filter(Boolean)
        );

        expect(bindings.length).toBeGreaterThan(10);
        expect(new Set(bindings).size).toBe(bindings.length);
    });

    it('activates the tool bound to a key', () => {
        const store = storeWithRect(false);

        expect(store.actions.events.pressShortcut(press('r'))).toBe(true);
        expect(store.state.tools.activeToolsIds).toEqual(['rectangle']);

        expect(store.actions.events.pressShortcut(press('s'))).toBe(true);
        expect(store.state.tools.activeToolsIds).toEqual(['select']);
    });

    it('runs the command bound to a key through its guard', () => {
        const store = storeWithRect(true);

        expect(store.actions.events.pressShortcut(press('d', { metaKey: true }))).toBe(true);
        expect(store.state.currentDocument.shapesIds).toHaveLength(2);

        expect(store.actions.events.pressShortcut(press('Backspace'))).toBe(true);
        expect(store.state.currentDocument.shapesIds).toHaveLength(1);

        // Nothing is selected now: the key is still claimed, but Delete cannot run.
        expect(store.actions.events.pressShortcut(press('Delete'))).toBe(true);
        expect(store.state.currentDocument.shapesIds).toHaveLength(1);
    });

    it('leaves unbound keys and browser shortcuts to the browser', () => {
        const store = storeWithRect(true);

        expect(store.actions.events.pressShortcut(press('q'))).toBe(false);
        expect(store.actions.events.pressShortcut(press('r', { ctrlKey: true }))).toBe(false);
        expect(store.state.tools.activeToolsIds).toEqual(['select']);
    });

    it('ignores shortcuts while text is typed or a gesture is in progress', () => {
        const store = storeWithRect(true);

        store.actions.events.startTyping();

        expect(store.actions.events.pressShortcut(press('Delete'))).toBe(false);

        store.actions.events.endTyping();
        store.actions.events.beginGesture({ pointerId: 1, position: { x: 100, y: 100 } });

        expect(store.actions.events.pressShortcut(press('Delete'))).toBe(false);
        expect(store.state.currentDocument.shapesIds).toHaveLength(1);
    });
});
