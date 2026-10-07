import { Collaboration } from 'src/app/services/collaboration';
import { createTestStore } from './support/store';

function setup() {
    const collaboration = new Collaboration();
    const { store } = createTestStore({}, { collaboration });
    const pause = vi.spyOn(collaboration, 'pause');
    const resume = vi.spyOn(collaboration, 'resume');

    return { store, pause, resume };
}

describe('sharing held by a control', () => {
    it('is paused while the control is held and resumed on its release', () => {
        const { store, pause, resume } = setup();

        store.actions.holdSharing();
        expect(pause).toHaveBeenCalledTimes(1);

        store.actions.releaseSharing();
        expect(resume).toHaveBeenCalledTimes(1);
    });

    it('stays paused for a gesture still in progress', () => {
        const { store, resume } = setup();

        store.actions.events.beginGesture({ pointerId: 1, position: { x: 10, y: 10 } });
        store.actions.holdSharing();
        store.actions.releaseSharing();

        expect(resume).not.toHaveBeenCalled();
    });
});
