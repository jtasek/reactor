import { reportErrors } from 'src/app/services/errorReport';
import { SCHEMA_VERSION } from 'src/app/services/schemaVersion';

function page(perPage = 3) {
    const target = new EventTarget();
    const sent: Record<string, unknown>[] = [];
    reportErrors(
        { perPage },
        Object.assign(target, { location: { href: 'https://reactor.test/designer' } }) as never,
        (body) => sent.push(JSON.parse(body)) > 0
    );
    const fail = (error: unknown) =>
        target.dispatchEvent(Object.assign(new Event('error'), { error, message: String(error) }));
    const reject = (reason: unknown) =>
        target.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason }));

    return { sent, fail, reject };
}

it('reports errors and rejections nothing handled, each message once', () => {
    const { sent, fail, reject } = page();
    const error = new TypeError('boom');

    fail(error);
    fail(new TypeError('boom'));
    reject('offline');
    reject(Symbol('reason'));

    expect(sent).toEqual([
        {
            kind: 'error',
            message: 'TypeError: boom',
            stack: error.stack,
            page: 'https://reactor.test/designer',
            release: `${SCHEMA_VERSION}`
        },
        {
            kind: 'rejection',
            message: 'offline',
            page: 'https://reactor.test/designer',
            release: `${SCHEMA_VERSION}`
        },
        {
            kind: 'rejection',
            message: 'Symbol(reason)',
            page: 'https://reactor.test/designer',
            release: `${SCHEMA_VERSION}`
        }
    ]);
});

it('sends at most so many reports from one page', () => {
    const { sent, fail } = page(2);

    fail(new Error('one'));
    fail(new Error('two'));
    fail(new Error('three'));
    fail(null);

    expect(sent.map(({ message }) => message)).toEqual(['Error: one', 'Error: two']);
});
