import { createTestStore } from './support/store';

describe('holding Space', () => {
    it('pans only while the pointer is over the canvas, until it is let go', () => {
        const { store } = createTestStore();
        const { events } = store.state;
        const enter = () =>
            store.actions.events.movePointer({ pointerId: 1, position: { x: 5, y: 5 } });

        store.actions.events.leaveSurface();
        expect(store.actions.events.holdSpace(true)).toBe(false);

        enter();
        expect(store.actions.events.holdSpace(true)).toBe(true);

        store.actions.events.leaveSurface();
        expect(store.actions.events.holdSpace(true)).toBe(true);
        expect(store.actions.events.holdSpace(false)).toBe(false);
        expect(events.keyboard.space).toBe(false);
    });

    it('is let go with the modifiers when the window loses focus', () => {
        const { store } = createTestStore();

        store.actions.events.movePointer({ pointerId: 1, position: { x: 5, y: 5 } });
        store.actions.events.holdSpace(true);
        store.actions.events.releaseModifiers();

        expect(store.state.events.keyboard.space).toBe(false);
    });
});
