const KEY = 'reactor.debugMode';

/** Whether this tab shows developer readouts: on once `?debug=on` opened it, until `?debug=off`. */
export function debugMode(): boolean {
    const asked = new URLSearchParams(globalThis.location?.search).get('debug');

    try {
        if (asked === 'on') {
            sessionStorage.setItem(KEY, 'on');
        } else if (asked === 'off') {
            sessionStorage.removeItem(KEY);
        }

        return sessionStorage.getItem(KEY) === 'on';
    } catch {
        return asked === 'on';
    }
}
