import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parsePort } from '../server/pages.ts';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const editorPort = parsePort(process.env.PORT ?? '4000');
const previewPort = parsePort(process.env.PREVIEW_PORT ?? '4001');

if (editorPort === previewPort) {
    throw new Error('PORT and PREVIEW_PORT must be different.');
}

const env = {
    ...process.env,
    NODE_ENV: 'development',
    HOST: 'localhost',
    EDITOR_ORIGIN: `http://localhost:${editorPort}`,
    PREVIEW_ORIGIN: `http://localhost:${previewPort}`,
    PREVIEW_ALLOW_LOCALHOST: 'true'
};
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
