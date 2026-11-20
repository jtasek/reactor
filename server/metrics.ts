import { createHash, timingSafeEqual } from 'node:crypto';
import express, { type Router } from 'express';
import type { Log } from './schema.ts';

type Labels = Record<string, string>;

interface Series {
    labels: Labels;
    value: number;
}

interface Histogram {
    labels: Labels;
    buckets: number[];
    sum: number;
    count: number;
}

const key = (labels: Labels) => JSON.stringify(Object.entries(labels).sort());

const escape = (value: string) =>
    value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');

const labelText = (labels: Labels) => {
    const entries = Object.entries(labels);

    return entries.length
        ? `{${entries.map(([name, value]) => `${name}="${escape(value)}"`).join(',')}}`
        : '';
};

/** Seconds, from a quarter of a second to two minutes: AI's budgets are 2 s and 20 s. */
export const SECONDS_BUCKETS = [0.25, 0.5, 1, 2, 5, 10, 20, 30, 60, 120];

/**
 * The server's own measurements, kept in this process and read in the Prometheus text
 * format at `/metrics`. Counters start at zero with each process.
 */
export function createMetrics() {
    const counters = new Map<string, { help: string; series: Map<string, Series> }>();
    const gauges = new Map<string, { help: string; read: () => number }>();
    const histograms = new Map<
        string,
        { help: string; bounds: number[]; series: Map<string, Histogram> }
    >();

    return {
        /** Adds `by` to a counter. */
        count(name: string, help: string, labels: Labels = {}, by = 1) {
            const counter = counters.get(name) ?? { help, series: new Map() };
            const series = counter.series.get(key(labels)) ?? { labels, value: 0 };

            series.value += by;
            counter.series.set(key(labels), series);
            counters.set(name, counter);
        },
        /** A value read whenever the metrics are. */
        gauge(name: string, help: string, read: () => number) {
            gauges.set(name, { help, read });
        },
        /** Records one observation, in seconds unless `bounds` says otherwise. */
        observe(
            name: string,
            help: string,
            value: number,
            labels: Labels = {},
            bounds = SECONDS_BUCKETS
        ) {
            const histogram = histograms.get(name) ?? { help, bounds, series: new Map() };
            const series = histogram.series.get(key(labels)) ?? {
                labels,
                buckets: bounds.map(() => 0),
                sum: 0,
                count: 0
            };

            histogram.bounds.forEach((bound, index) => {
                if (value <= bound) series.buckets[index]++;
            });
            series.sum += value;
            series.count++;
            histogram.series.set(key(labels), series);
            histograms.set(name, histogram);
        },
        /** Every metric in the Prometheus text format. */
        render() {
            const lines: string[] = [];

            for (const [name, { help, series }] of counters) {
                lines.push(`# HELP ${name} ${help}`, `# TYPE ${name} counter`);
                for (const { labels, value } of series.values()) {
                    lines.push(`${name}${labelText(labels)} ${value}`);
                }
            }
            for (const [name, { help, read }] of gauges) {
                lines.push(`# HELP ${name} ${help}`, `# TYPE ${name} gauge`, `${name} ${read()}`);
            }
            for (const [name, { help, bounds, series }] of histograms) {
                lines.push(`# HELP ${name} ${help}`, `# TYPE ${name} histogram`);
                for (const { labels, buckets, sum, count } of series.values()) {
                    bounds.forEach((bound, index) =>
                        lines.push(
                            `${name}_bucket${labelText({ ...labels, le: `${bound}` })} ${buckets[index]}`
                        )
                    );
                    lines.push(
                        `${name}_bucket${labelText({ ...labels, le: '+Inf' })} ${count}`,
                        `${name}_sum${labelText(labels)} ${sum}`,
                        `${name}_count${labelText(labels)} ${count}`
                    );
                }
            }

            return `${lines.join('\n')}\n`;
        }
    };
}

export type Metrics = ReturnType<typeof createMetrics>;

/** Measurements nobody reads, for code run without a server's metrics, as in tests. */
export const noMetrics: Metrics = createMetrics();

const digest = (value: string) => createHash('sha256').update(value).digest();

/**
 * `GET /metrics` in the Prometheus text format, `GET /metrics/prototypes`, what each
 * shared prototype was opened by, `GET /metrics/first-links`, how long each person took
 * to share their first link, and `GET /metrics/beta`, R7's weekly measures, for whoever sends `token` as a bearer token. Without a token,
 * none exists.
 */
export function metricsRoutes({
    token,
    metrics,
    prototypes,
    firstLinks,
    beta
}: {
    token?: string;
    metrics: Metrics;
    /** The shared prototypes' measures; without accounts there are none. */
    prototypes?: () => Promise<unknown>;
    /** Each person's first shared link; without accounts there are none. */
    firstLinks?: () => Promise<unknown>;
    /** R7's weekly beta measures; without accounts there are none. */
    beta?: () => Promise<unknown>;
}): Router {
    const router = express.Router();
    if (!token) {
        return router;
    }
    const expected = digest(`Bearer ${token}`);

    router.use('/metrics', (req, res, next) => {
        res.set('Cache-Control', 'no-store');
        if (!timingSafeEqual(digest(req.headers.authorization ?? ''), expected)) {
            res.status(401).json({ code: 'UNAUTHORIZED' });

            return;
        }
        next();
    });
    router.get('/metrics', (_req, res) => {
        res.type('text/plain; version=0.0.4').send(metrics.render());
    });
    router.get('/metrics/prototypes', async (_req, res) => {
        res.json(prototypes ? await prototypes() : []);
    });
    router.get('/metrics/first-links', async (_req, res) => {
        res.json(firstLinks ? await firstLinks() : []);
    });
    router.get('/metrics/beta', async (_req, res) => {
        res.json(beta ? await beta() : []);
    });

    return router;
}

export interface BrowserErrorLimits {
    /** Reports one address may send in `windowMs`; more are dropped. */
    perAddress: number;
    /** Reports all addresses together may send in `windowMs`. */
    total: number;
    windowMs: number;
}

export const BROWSER_ERROR_LIMITS: BrowserErrorLimits = {
    perAddress: 20,
    total: 600,
    windowMs: 60 * 1000
};

const text = (value: unknown, length: number) =>
    typeof value === 'string' ? value.slice(0, length) : '';

/** The page's path alone: a query or fragment may hold a token or a document's name. */
const pagePath = (value: unknown) => {
    try {
        return new URL(text(value, 2000)).pathname.slice(0, 200);
    } catch {
        return '';
    }
};

/**
 * `POST /api/client-errors`: the editor reports an error it did not handle. Each is
 * logged and counted, signed in or out, from the editor's own pages only.
 */
export function browserErrors({
    metrics,
    log,
    limits = BROWSER_ERROR_LIMITS,
    now = Date.now
}: {
    metrics: Metrics;
    log: Pick<Log, 'warn'>;
    limits?: BrowserErrorLimits;
    now?: () => number;
}): Router {
    const router = express.Router();
    let windowStart = 0;
    let total = 0;
    const perAddress = new Map<string, number>();

    const admitted = (address: string) => {
        if (now() - windowStart >= limits.windowMs) {
            windowStart = now();
            total = 0;
            perAddress.clear();
        }
        const sent = perAddress.get(address) ?? 0;
        if (total >= limits.total || sent >= limits.perAddress) {
            return false;
        }
        total++;
        perAddress.set(address, sent + 1);

        return true;
    };

    // Beacons send text, so the body is read as JSON whatever its type.
    const readBody = express.text({ type: () => true, limit: '8kb' });
    router.post('/api/client-errors', readBody, (req, res) => {
        res.set('Cache-Control', 'no-store');
        let origin: string | undefined;
        try {
            origin = new URL(req.headers.origin ?? '').host;
        } catch {
            origin = undefined;
        }
        // `req.host` is the forwarded host behind a trusted proxy, which may rewrite `Host`.
        if (!origin || origin !== req.host) {
            res.status(403).json({ code: 'INVALID_ORIGIN' });

            return;
        }
        if (!admitted(req.ip ?? '')) {
            metrics.count(
                'reactor_browser_errors_dropped_total',
                'Browser error reports dropped over the rate limit.'
            );
            res.status(429).json({ code: 'TOO_MANY_REPORTS' });

            return;
        }
        let body: unknown;
        try {
            body = JSON.parse(String(req.body));
        } catch {
            res.status(400).json({ code: 'INVALID_BODY' });

            return;
        }
        const kind = Reflect.get(Object(body), 'kind') === 'rejection' ? 'rejection' : 'error';
        metrics.count(
            'reactor_browser_errors_total',
            'Errors the editor did not handle, as browsers reported them.',
            { kind }
        );
        log.warn(
            {
                browserError: {
                    kind,
                    message: text(Reflect.get(Object(body), 'message'), 500),
                    stack: text(Reflect.get(Object(body), 'stack'), 4000),
                    page: pagePath(Reflect.get(Object(body), 'page')),
                    release: text(Reflect.get(Object(body), 'release'), 40)
                }
            },
            'Browser error'
        );
        res.status(204).end();
    });

    return router;
}
