import { pathToFileURL } from 'node:url';

/**
 * Checks a running production server as it is deployed: its health check, the
 * editor's pages, cache and security headers, missing files and other methods.
 * Returns what failed, empty when nothing did. Run it as
 * `node scripts/smoke.mjs <address>`, as CI does with the Docker image.
 */
export async function smoke(address) {
    const failures = [];
    const check = (passed, failure) => {
        if (!passed) {
            failures.push(failure);
        }
    };
    const request = (path, init) => fetch(new URL(path, address), init);

    const health = await request('/healthz');

    check(health.ok && (await health.json()).status === 'ok', '/healthz does not answer ok');

    for (const route of ['/', '/documents', '/account']) {
        const page = await request(route);
        const header = (name) => page.headers.get(name) ?? '';

        check(
            page.ok && header('content-type').startsWith('text/html'),
            `${route} is not the page`
        );
        check(header('cache-control') === 'no-cache', `${route} may be cached`);
        check(
            header('content-security-policy').includes("script-src 'self'"),
            `${route} has no content security policy`
        );
        check(header('x-content-type-options') === 'nosniff', `${route} may be sniffed`);
        check(header('strict-transport-security') !== '', `${route} does not ask for HTTPS`);
    }

    const html = await (await request('/')).text();
    const scripts = [...html.matchAll(/<script[^>]* src="([^"]+)"/g)].map(([, src]) => src);

    check(scripts.length > 0, 'The page loads no script');

    for (const script of scripts) {
        const asset = await request(script);

        check(
            asset.ok && (asset.headers.get('cache-control') ?? '').includes('immutable'),
            `${script} is not cached for good`
        );
    }

    check(
        (await request('/missing.js')).status === 404,
        'A missing file is not answered as missing'
    );

    const post = await request('/documents', { method: 'POST' });

    check(
        post.status === 405 && post.headers.get('allow') === 'GET, HEAD',
        'A POST is not refused'
    );

    return failures;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    const address = process.argv[2] ?? 'http://127.0.0.1:4000';
    const failures = await smoke(address);

    failures.forEach((failure) => console.error(failure));

    if (failures.length > 0) {
        process.exit(1);
    }

    console.info(`${address} passed the smoke test`);
}
