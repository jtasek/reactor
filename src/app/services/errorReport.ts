import { SCHEMA_VERSION } from './schemaVersion';

export interface ErrorReportConfiguration {
    /** Reports one page load sends at most; a message already sent is not sent again. */
    perPage: number;
}

export const DEFAULT_ERROR_REPORT: ErrorReportConfiguration = { perPage: 10 };

/** Sends the errors nothing handled to the server, which logs and counts them. */
export function reportErrors(
    { perPage }: ErrorReportConfiguration,
    target: Pick<Window, 'addEventListener' | 'location'> = window,
    // As text, the one body a beacon sends without asking the server first.
    send = (body: string) => navigator.sendBeacon('/api/client-errors', body)
) {
    const sent = new Set<string>();
    const report = (kind: string, error: unknown) => {
        const message = `${error}`.slice(0, 500);
        if (sent.size < perPage && !sent.has(message)) {
            sent.add(message);
            send(
                JSON.stringify({
                    kind,
                    message,
                    stack: (error as Error)?.stack,
                    page: target.location.href,
                    release: `${SCHEMA_VERSION}`
                })
            );
        }
    };

    target.addEventListener('error', (event) => report('error', event.error ?? event.message));
    target.addEventListener('unhandledrejection', (event) => report('rejection', event.reason));
}
