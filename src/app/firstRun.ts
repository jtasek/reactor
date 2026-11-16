import { useSyncExternalStore } from 'react';

/**
 * The first-run guide follows one document started from a starter template, on this
 * device, through editing it, playing it in Prototype and sharing a link.
 */
export interface FirstRunGuide {
    documentId: string;
    edited?: boolean;
    played?: boolean;
    shared?: boolean;
    closed?: boolean;
}

export type FirstRunStep = 'edited' | 'played' | 'shared';

const KEY = 'reactor:first-run';
const OPEN_AFTER_SIGN_IN_KEY = 'reactor:open-after-sign-in';
/** Set once the person has started a document here, from a template, blank or by drawing. */
const STARTED_KEY = 'reactor:first-run:started';
const listeners = new Set<() => void>();
let cached: { text: string | null; guide: FirstRunGuide | null } | null = null;

const read = (): FirstRunGuide | null => {
    let text: string | null;

    try {
        text = localStorage.getItem(KEY);
    } catch {
        return null;
    }

    if (cached?.text === text) {
        return cached.guide;
    }

    let guide: FirstRunGuide | null = null;

    try {
        const value: unknown = text === null ? null : JSON.parse(text);

        if (
            value &&
            typeof value === 'object' &&
            'documentId' in value &&
            typeof value.documentId === 'string'
        ) {
            guide = value as FirstRunGuide;
        }
    } catch {
        guide = null;
    }

    cached = { text, guide };

    return guide;
};

const store = (key: string, value: string) => {
    try {
        localStorage.setItem(key, value);
    } catch {
        // Without storage there is no guide, and the start panel shows again.
    }

    listeners.forEach((listener) => listener());
};

const write = (guide: FirstRunGuide) => store(KEY, JSON.stringify(guide));

const started = () => {
    try {
        return localStorage.getItem(STARTED_KEY) !== null;
    } catch {
        return false;
    }
};

const subscribe = (listener: () => void) => {
    const fromOtherTab = (event: StorageEvent) => {
        if (event.key === KEY || event.key === STARTED_KEY) {
            listener();
        }
    };

    listeners.add(listener);
    window.addEventListener('storage', fromOtherTab);

    return () => {
        listeners.delete(listener);
        window.removeEventListener('storage', fromOtherTab);
    };
};

/** The person has started a document here, so the start panel is not offered again. */
export const markStarted = () => {
    if (!started()) {
        store(STARTED_KEY, 'true');
    }
};

/** Whether the person has started a document here. */
export const useStarted = () => useSyncExternalStore(subscribe, started, () => true);

/** Follows `documentId` from now on, in place of any document followed before. */
export const startFirstRunGuide = (documentId: string) => {
    markStarted();
    write({ documentId });
};

/** Records a step done in `documentId`, if it is the document the guide follows. */
export const markFirstRunStep = (documentId: string, step: FirstRunStep, done = true) => {
    const guide = read();

    if (guide?.documentId === documentId && Boolean(guide[step]) !== done) {
        write({ ...guide, [step]: done });
    }
};

export const closeFirstRunGuide = () => {
    const guide = read();

    if (guide && !guide.closed) {
        write({ ...guide, closed: true });
    }
};

/** The guide, while it follows a document and has not been closed. */
export const useFirstRunGuide = () => {
    const guide = useSyncExternalStore(subscribe, read, () => null);

    return guide && !guide.closed ? guide : null;
};

/** Signing in to share `documentId`: once it has moved into the account, it opens again. */
export const openAfterSignIn = (documentId: string) => {
    try {
        localStorage.setItem(OPEN_AFTER_SIGN_IN_KEY, documentId);
    } catch {
        // The person opens it from Documents.
    }
};

/** The document to open again after signing in, forgotten once read. */
export const takeOpenAfterSignIn = (exists: (documentId: string) => boolean) => {
    try {
        const documentId = localStorage.getItem(OPEN_AFTER_SIGN_IN_KEY);

        if (documentId && exists(documentId)) {
            localStorage.removeItem(OPEN_AFTER_SIGN_IN_KEY);

            return documentId;
        }
    } catch {
        // Nothing to open.
    }

    return null;
};
