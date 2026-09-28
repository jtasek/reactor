import { Collaboration } from 'src/app/services/collaboration';
import { type Channel, TabSync } from 'src/app/services/tabSync';
import { type Copy, DOCUMENT_ID, documentOf, sharedContent } from './support/collaboration';
import { createTestStore } from './support/store';

type Actions = Copy['store']['actions'];

interface Tab extends Copy {
    sync: TabSync;
    channel: Channel;
}

const rectangle = (x = 0) => ({
    type: 'rectangle' as const,
    position: { x, y: 0 },
    size: { width: 20, height: 10 }
});

/**
 * A BroadcastChannel for copies in one test: messages wait until `deliver`, and a
 * frozen copy misses the messages posted meanwhile.
 */
class Hub {
    readonly frozen = new Set<Channel>();
    private readonly channels = new Set<Channel>();
    private readonly queue: Array<() => void> = [];

    open(): Channel {
        const channel: Channel = {
            onmessage: null,
            postMessage: (message) =>
                this.channels.forEach((other) => {
                    if (other !== channel && !this.frozen.has(other)) {
                        const data: unknown = structuredClone(message);

                        this.queue.push(() =>
                            other.onmessage?.(new MessageEvent('message', { data }))
                        );
                    }
                }),
            close: () => this.channels.delete(channel)
        };

        this.channels.add(channel);

        return channel;
    }

    /** Delivers messages, including the answers they bring, until none are left. */
    deliver() {
        while (this.queue.length > 0) {
            this.queue.shift()?.();
        }
    }
}

/** Copies of one document connected through `hub`; the first one's, after `setup`, is shared. */
async function openTabs(hub: Hub, count: number, setup: (actions: Actions) => void = () => {}) {
    const tabs: Tab[] = [];

    for (let index = 0; index < count; index++) {
        const collaboration = new Collaboration();
        const { store } = createTestStore({}, { collaboration });
        const channel = hub.open();
        const sync = new TabSync(collaboration, channel);

        await collaboration.initialize({
            getDocument: (documentId) => store.state.documents[documentId],
            applyRemoteChanges: store.actions.applyRemoteChanges,
            addMutationListener: store.addMutationListener,
            sendUpdate: (documentId, update) => sync.send(documentId, update)
        });
        tabs.push({ store, collaboration, inbox: [], sync, channel });
    }

    const [first, ...others] = tabs;

    setup(first.store.actions);
    first.collaboration.open(DOCUMENT_ID);

    const state = first.collaboration.state(DOCUMENT_ID);

    others.forEach(({ collaboration }) => collaboration.open(DOCUMENT_ID, state));
    hub.deliver();

    return tabs;
}

/** Makes a change in a copy and writes it, as the end of an action does. */
function change(tab: Tab, edit: (actions: Actions) => void) {
    edit(tab.store.actions);
    tab.collaboration.flush();
}

describe('tab sync', () => {
    it('shares each copy’s changes with the other open copies', async () => {
        const hub = new Hub();
        const [a, b] = await openTabs(hub, 2);

        change(a, (actions) => actions.addShape(rectangle()));
        hub.deliver();

        const [id] = documentOf(b).shapesIds;

        change(b, (actions) => actions.updateShape({ id, name: 'renamed' }));
        hub.deliver();

        expect(documentOf(a).shapes[id].name).toBe('renamed');
        expect(sharedContent(a)).toEqual(sharedContent(b));
    });

    it('catches up copies that missed each other’s changes while frozen', async () => {
        const hub = new Hub();
        const [a, b] = await openTabs(hub, 2, (actions) => actions.addShape(rectangle()));
        const [id] = documentOf(a).shapesIds;

        hub.frozen.add(a.channel);
        change(b, (actions) => actions.updateShape({ id, name: 'from b' }));
        hub.frozen.clear();
        hub.frozen.add(b.channel);
        change(a, (actions) => actions.addShape(rectangle(40)));
        hub.frozen.clear();
        hub.deliver();
        expect(sharedContent(a)).not.toEqual(sharedContent(b));

        b.sync.catchUp();
        hub.deliver();

        expect(documentOf(a).shapes[id].name).toBe('from b');
        expect(Object.keys(documentOf(b).shapes)).toHaveLength(2);
        expect(sharedContent(a)).toEqual(sharedContent(b));
    });

    it('takes only the answers meant for it', async () => {
        const hub = new Hub();
        const [a, b, c] = await openTabs(hub, 3, (actions) => actions.addShape(rectangle()));
        const received = vi.spyOn(b.collaboration, 'receive');

        c.sync.catchUp();
        hub.deliver();

        // The answers to b's own question, from a and c; not those for a or c.
        expect(received).toHaveBeenCalledTimes(2);
        expect(sharedContent(a)).toEqual(sharedContent(c));
    });

    it('ignores messages it cannot read and documents not open here', async () => {
        const hub = new Hub();
        const [a, b] = await openTabs(hub, 2, (actions) => actions.addShape(rectangle()));
        const before = sharedContent(b);
        const received = vi.spyOn(b.collaboration, 'receive');

        [
            null,
            'text',
            { type: 'update', documentId: DOCUMENT_ID, update: 'bytes' },
            { type: 'sync', documentId: DOCUMENT_ID },
            { type: 'update', documentId: 'other', update: new Uint8Array([0, 0]) }
        ].forEach((message) => a.channel.postMessage(message));

        expect(() => hub.deliver()).not.toThrow();
        expect(received).not.toHaveBeenCalled();
        expect(sharedContent(b)).toEqual(before);
    });

    it('catches up when the page is shown again', async () => {
        const [tab] = await openTabs(new Hub(), 1);
        const document = Object.assign(new EventTarget(), { visibilityState: 'hidden' });
        const page = Object.assign(new EventTarget(), { document });
        const shown = (persisted: boolean) =>
            page.dispatchEvent(Object.assign(new Event('pageshow'), { persisted }));
        const catchUp = vi.spyOn(tab.sync, 'catchUp');
        const stop = tab.sync.listen(page as unknown as Window);

        document.dispatchEvent(new Event('visibilitychange'));
        document.visibilityState = 'visible';
        document.dispatchEvent(new Event('visibilitychange'));
        shown(false);
        shown(true);
        expect(catchUp).toHaveBeenCalledTimes(2);

        stop();
        shown(true);
        expect(catchUp).toHaveBeenCalledTimes(2);
    });
});
