import type { Context } from 'src/app';
import { NOTICES_KEY } from '../services/accounts';
import { createNotification } from '../factories';

/** From this many documents on, signed-out users are told again. */
const MANY_DOCUMENTS = 3;

const LOCAL_ONLY =
    'Your documents are kept only in this browser and are lost if its site data is cleared.';

const noticesShown = ({ effects }: Context): string[] => {
    try {
        const shown = effects.loadState(NOTICES_KEY);

        return Array.isArray(shown) ? shown.filter((notice) => typeof notice === 'string') : [];
    } catch {
        return [];
    }
};

/**
 * Tells a signed-out user that documents are kept only in this browser: once,
 * and again once the browser holds several documents. Each is shown once per
 * browser; the notice links to signing in where the server has accounts.
 */
export const noticeLocalDocuments = (context: Context) => {
    const { state, effects } = context;

    if (state.loading || state.account.kind === 'loading' || state.account.kind === 'signedIn') {
        return;
    }

    const notice = Object.keys(state.documents).length >= MANY_DOCUMENTS ? 'many' : 'first';
    const shown = noticesShown(context);

    if (shown.includes(notice)) {
        return;
    }

    try {
        effects.saveState(NOTICES_KEY, [...new Set([...shown, 'first', notice])]);
    } catch {
        // Without the record, the notice is shown again on the next start.
    }

    state.notifications.push(
        createNotification({
            message: LOCAL_ONLY,
            type: 'info',
            link:
                state.account.kind === 'signedOut'
                    ? { label: 'Sign in to keep them', url: '/account' }
                    : undefined
        })
    );
};
