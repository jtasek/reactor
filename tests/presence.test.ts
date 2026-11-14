import type { Context } from 'src/app';
import {
    followPresence,
    peerColor,
    PRESENCE_INTERVAL,
    readPeers,
    type LocalPresence
} from 'src/app/services/presence';
import { createTestStore } from './support/store';

describe('presence', () => {
    it('reads the other people with a document open, leaving out this copy and its account', () => {
        const states = new Map<number, unknown>([
            [1, { user: { id: 'me', name: 'Me' }, pointer: { x: 1, y: 2 } }],
            [2, { user: { id: 'grace', name: 'Grace' }, pointer: { x: 3, y: 4 } }],
            [3, { user: { id: 'self', name: 'Me elsewhere' }, pointer: { x: 0, y: 0 } }],
            [4, { user: { id: 'ada', name: ' ' }, selection: ['a', 7, 'b'] }],
            // Elsewhere: shows nothing.
            [5, { user: { id: 'linus', name: 'Linus' } }],
            // Not stamped by the server.
            [6, { pointer: { x: 1, y: 1 } }],
            [7, { user: { id: 'bad', name: 'Bad' }, pointer: { x: 'a', y: 1 } }]
        ]);

        expect(readPeers(states, 1, 'self')).toEqual([
            {
                clientId: 2,
                userId: 'grace',
                name: 'Grace',
                color: peerColor('grace'),
                pointer: { x: 3, y: 4 },
                selection: []
            },
            {
                clientId: 4,
                userId: 'ada',
                name: 'Someone',
                color: peerColor('ada'),
                pointer: undefined,
                selection: ['a', 'b']
            }
        ]);
        expect(peerColor('grace')).toBe(peerColor('grace'));
    });

    it('shares the pointer and selection as they change, at most every interval', () => {
        vi.useFakeTimers();
        onTestFinished(() => {
            vi.useRealTimers();
        });

        const { store } = createTestStore();
        const shared: Array<[string | undefined, LocalPresence]> = [];
        const stop = followPresence(
            store as unknown as Pick<Context, 'state' | 'addMutationListener'>,
            {
                present: (documentId, local) => shared.push([documentId, local])
            }
        );
        const documentId = store.state.currentDocumentId;

        expect(shared).toEqual([[documentId, {}]]);

        store.actions.addShape({
            type: 'rectangle',
            position: { x: 10, y: 20 },
            size: { width: 30, height: 40 }
        });
        const [shapeId] = store.state.currentDocument.shapesIds;
        store.actions.selectShape(shapeId);
        for (let x = 0; x < 10; x++) {
            store.actions.events.movePointer({ pointerId: 1, position: { x, y: 5 } });
        }

        vi.advanceTimersByTime(PRESENCE_INTERVAL);
        expect(shared).toHaveLength(2);
        expect(shared[1]).toEqual([documentId, { pointer: { x: 9, y: 5 }, selection: [shapeId] }]);

        store.actions.events.leaveSurface();
        vi.advanceTimersByTime(PRESENCE_INTERVAL);
        expect(shared.at(-1)).toEqual([documentId, { selection: [shapeId] }]);

        // On another page, as Documents, nothing of the canvas is shared.
        store.actions.events.movePointer({ pointerId: 1, position: { x: 2, y: 2 } });
        store.actions.showDocuments();
        vi.advanceTimersByTime(PRESENCE_INTERVAL);
        expect(shared.at(-1)).toEqual([documentId, {}]);

        stop();
        store.actions.events.movePointer({ pointerId: 1, position: { x: 1, y: 1 } });
        vi.advanceTimersByTime(PRESENCE_INTERVAL);
        expect(shared).toHaveLength(4);
    });
});
