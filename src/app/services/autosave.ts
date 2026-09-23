import type { Context } from '../index';
import { PERSISTENCE_KEY, serializePersistedState } from './documentStorage';

const controllers = new WeakMap<object, { flush: () => void; dispose: () => void }>();

export function disposeAutosave(instance: object): void {
    controllers.get(instance)?.dispose();
}

export function startAutosave(
    instance: Pick<Context, 'state' | 'reaction'>,
    effects: Pick<Context['effects'], 'saveState'>,
    onError: (message: string) => void
) {
    disposeAutosave(instance);

    let timer: ReturnType<typeof setTimeout> | undefined;
    let dirty = false;
    let disposed = false;
    let lastSaved = JSON.stringify(serializePersistedState(instance.state));
    let reportedFailure = false;

    const flush = () => {
        clearTimeout(timer);
        timer = undefined;

        if (!dirty || disposed) {
            return;
        }

        try {
            const payload = serializePersistedState(instance.state);
            const serialized = JSON.stringify(payload);

            if (serialized !== lastSaved) {
                effects.saveState(PERSISTENCE_KEY, payload);
            }

            lastSaved = serialized;
            dirty = false;
            reportedFailure = false;
        } catch {
            if (!reportedFailure) {
                onError('Could not save your changes. Local storage may be full or unavailable.');
            }

            reportedFailure = true;
        }
    };

    const schedule = () => {
        dirty = true;
        clearTimeout(timer);
        timer = setTimeout(flush, 500);
    };

    const stopDocuments = instance.reaction((state) => state.documents, schedule, { nested: true });
    const stopCurrent = instance.reaction((state) => state.currentDocumentId, schedule);
    const controller = {
        flush,
        dispose: () => {
            if (disposed) {
                return;
            }

            flush();
            disposed = true;
            clearTimeout(timer);
            stopDocuments();
            stopCurrent();

            if (typeof window !== 'undefined') {
                window.removeEventListener('pagehide', flush);
            }

            controllers.delete(instance);
        }
    };

    if (typeof window !== 'undefined') {
        window.addEventListener('pagehide', flush);
    }

    controllers.set(instance, controller);

    return controller;
}
