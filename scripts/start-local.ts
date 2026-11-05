import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parsePort } from '../server/pages.ts';

const cwd = fileURLToPath(new URL('..', import.meta.url));
function fail(message: string): never {
    console.error(message);
    process.exit(1);
}

function readPort(name: 'PORT' | 'PREVIEW_PORT', fallback: string) {
    try {
        return parsePort(process.env[name] ?? fallback);
    } catch {
        return fail(`Invalid ${name}: ${process.env[name]}`);
    }
}

const editorPort = readPort('PORT', '4000');
const previewPort = readPort('PREVIEW_PORT', '4001');

if (editorPort === previewPort) {
    fail('PORT and PREVIEW_PORT must be different.');
}

const env = {
    ...process.env,
    NODE_ENV: 'development',
    HOST: 'localhost',
    EDITOR_ORIGIN: `http://localhost:${editorPort}`,
    PREVIEW_ORIGIN: `http://localhost:${previewPort}`,
    PREVIEW_ALLOW_LOCALHOST: 'true'
};

// Better Auth only trusts its own origin, so sign-in from a different editor address fails.
if (process.env.BETTER_AUTH_URL) {
    let authOrigin: string | undefined;
    try {
        authOrigin = new URL(process.env.BETTER_AUTH_URL).origin;
    } catch {
        authOrigin = undefined;
    }
    if (authOrigin !== env.EDITOR_ORIGIN) {
        console.warn(
            `Warning: BETTER_AUTH_URL is ${process.env.BETTER_AUTH_URL}, but the editor runs at ${env.EDITOR_ORIGIN}. Sign-in will be rejected until BETTER_AUTH_URL is set to ${env.EDITOR_ORIGIN}.`
        );
    }
}

const children = new Set<ChildProcess>();
let stopping = false;
let shutdownTimer: NodeJS.Timeout | undefined;

function stop(code: number) {
    if (stopping) {
        return;
    }
    stopping = true;
    process.exitCode = code;
    for (const child of children) {
        child.kill('SIGTERM');
    }
    shutdownTimer = setTimeout(() => {
        for (const child of children) {
            child.kill('SIGKILL');
        }
    }, 12_000);
    shutdownTimer.unref();
}

function run(args: string[], environment: NodeJS.ProcessEnv) {
    const child = spawn(process.execPath, args, { cwd, env: environment, stdio: 'inherit' });
    children.add(child);
    child.once('error', (error) => {
        console.error(error.message);
        stop(1);
    });

    return new Promise<number>((resolve) => {
        child.once('close', (code) => {
            children.delete(child);
            if (children.size === 0) {
                clearTimeout(shutdownTimer);
            }
            resolve(code ?? 1);
        });
    });
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

console.info('Building the isolated prototype runtime…');
const buildCode = await run(
    ['node_modules/webpack/bin/webpack.js', '--config', 'webpack.preview.mjs'],
    { ...env, NODE_ENV: 'production' }
);

if (!stopping && buildCode !== 0) {
    stop(buildCode);
}

if (!stopping) {
    console.info(`Editor: ${env.EDITOR_ORIGIN} · Prototype runtime: ${env.PREVIEW_ORIGIN}`);
    console.info('Press Ctrl+C to stop both servers.');
    // Any server exit stops its sibling, including startup failures such as an occupied port.
    await Promise.race([
        run(['server.ts'], { ...env, PORT: String(editorPort) }),
        run(['server.preview.ts'], { ...env, PORT: String(previewPort) })
    ]).then((code) => stop(code || 1));
}
