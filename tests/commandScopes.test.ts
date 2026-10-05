import { commandsFor, commandsIn, registerCommand } from 'src/app/actions/startup';
import { selectionScope } from 'src/app/membership';
import type { ShapeInput } from 'src/app/types';
import * as commands from 'src/commands';
import { createTestStore } from './support/store';

// Commands are registered by application startup, which the test store skips.
Object.values(commands).forEach(registerCommand);

const idsFor = (scope: Parameters<typeof commandsFor>[0]) => commandsFor(scope).map(({ id }) => id);

describe('commands for an item', () => {
    it('are the registered commands of its scope, most used first', () => {
        expect(idsFor('shape')).toEqual(['clone', 'delete', 'bring-to-front', 'send-to-back']);
        expect(idsFor('group')).toEqual([
            'ungroup',
            'clone',
            'delete',
            'bring-to-front',
            'send-to-back'
        ]);
        expect(idsFor('layer')).toEqual(['unlayer']);
        expect(idsFor('selection')).toEqual([
            'ungroup',
            'clone',
            'delete',
            'bring-to-front',
            'send-to-back',
            'group'
        ]);
    });

    it('include a command registered later', () => {
        registerCommand({
            id: 'rename',
            name: 'Rename',
            category: 'shapes',
            scopes: ['shape'],
            menuOrder: 5,
            canExecute: () => true,
            execute: () => {}
        });

        expect(idsFor('shape')[0]).toBe('rename');
    });
});

describe('commands in a place', () => {
    it('are in the command bar unless they name their places', () => {
        const barIds = commandsIn('commandBar').map(({ id }) => id);
        const inspectorIds = commandsIn('inspector').map(({ id }) => id);

        expect(barIds).toContain('clone');
        expect(barIds.filter((id) => id.startsWith('align-') || id.startsWith('space-'))).toEqual(
            []
        );
        // In the order they are registered, which startup sets.
        expect([...inspectorIds].sort()).toEqual([
            'align-bottom',
            'align-center',
            'align-left',
            'align-middle',
            'align-right',
            'align-top',
            'space-between-horizontally',
            'space-between-vertically',
            'space-equally-horizontally',
            'space-equally-vertically'
        ]);
    });
});

describe('the scope of the selection', () => {
    const square = (x: number): ShapeInput => ({
        type: 'rectangle',
        position: { x, y: 0 },
        size: { width: 10, height: 10 },
        selected: false
    });

    it('is a shape, a group selected as one, or several items', () => {
        const { store } = createTestStore();

        [0, 20, 40].forEach((x) => store.actions.addShape(square(x)));

        const ids = [...store.state.currentDocument.shapesIds];
        const scope = () => selectionScope(store.state.currentDocument);
        const select = (...chosen: string[]) => {
            store.actions.unselectShapes();
            chosen.forEach((id) => store.actions.selectShape(id));
        };

        expect(scope()).toBeNull();

        select(ids[0]);
        expect(scope()).toBe('shape');

        select(ids[0], ids[1]);
        expect(scope()).toBe('selection');

        store.actions.submitCommandLine('group');
        expect(scope()).toBe('group');

        select(...ids);
        expect(scope()).toBe('selection');
    });
});
