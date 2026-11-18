/** Where the chat gets its answers when the server offers no AI. */
export type LocalAi = 'always' | 'withoutServer' | 'never';

const KEY = 'reactor.localAi';

/**
 * Whether the chat answers from the local test model (src/ai/localModel.ts):
 * always once `?ai=local` opened this tab, until `?ai=server`; in development
 * builds whenever the server offers no AI; otherwise never.
 */
export function localAi(): LocalAi {
    const asked = new URLSearchParams(window.location.search).get('ai');

    try {
        if (asked === 'local') {
            sessionStorage.setItem(KEY, 'always');
        } else if (asked === 'server') {
            sessionStorage.removeItem(KEY);

            return 'never';
        }
        if (sessionStorage.getItem(KEY) === 'always') {
            return 'always';
        }
    } catch {
        // Storage can be blocked; the address still asks for this page.
        if (asked === 'local') {
            return 'always';
        }
    }

    return process.env.NODE_ENV === 'development' ? 'withoutServer' : 'never';
}
