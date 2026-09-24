import type { Context } from '../index';
import { PERSISTENCE_KEY, RUNTIME_FIELDS, serializePersistedState } from './documentStorage';

const controllers = new WeakMap<object, { flush: () => void; dispose: () => void }>();

const isDurableChange = ({ path, delimiter }: { path: string; delimiter: string }) => {
    const [root, ...fields] = path.split(delimiter);

    return (
        (root === 'documents' || root === 'currentDocumentId') &&
        !fields.some((field) => RUNTIME_FIELDS.has(field))
    );
};

export function disposeAutosave(instance: object): void {
    controllers.get(instance)?.dispose();
}

export function startAutosave(
    instance: Pick<Context, 'state' | 'actions' | 'addMutationListener'>,
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

    const handleStorage = (event: StorageEvent) => {
        if (disposed || event.key !== PERSISTENCE_KEY || event.newValue === null) {
            return;
        }

        if (!instance.actions.loadSavedDocuments(event.newValue)) {
            stop();
            onError(
                'Another tab saved documents this tab cannot read. Reload this tab; changes made in it are no longer saved.'
            );

            return;
        }

        clearTimeout(timer);
        timer = undefined;
        dirty = false;
        lastSaved = JSON.stringify(serializePersistedState(instance.state));
    };

    const stopListening = instance.addMutationListener((mutation) => {
        if (isDurableChange(mutation)) {
            schedule();
        }
    });

    const stop = () => {
        disposed = true;
        clearTimeout(timer);
        stopListening();

        if (typeof window !== 'undefined') {
            window.removeEventListener('pagehide', flush);
            window.removeEventListener('storage', handleStorage);
        }

        controllers.delete(instance);
    };

    const controller = {
        flush,
        dispose: () => {
            if (disposed) {
                return;
            }

            flush();
            stop();
        }
    };

    if (typeof window !== 'undefined') {
        window.addEventListener('pagehide', flush);
        window.addEventListener('storage', handleStorage);
    }

    controllers.set(instance, controller);

    return controller;
}
