import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ESLint } from 'eslint';

const baseline = JSON.parse(
    await readFile(new URL('../lint-baseline.json', import.meta.url), 'utf8')
);
const eslint = new ESLint();
const results = await eslint.lintFiles([
    'src',
    'tests',
    '*.js',
    '*.mjs',
    '*.mts',
    '*.config.ts',
    'scripts'
]);
const base = process.env.LINT_BASE_REF ?? 'HEAD';
const gitFiles = (args) =>
    execFileSync('git', args, { encoding: 'utf8' }).split('\0').filter(Boolean);
const touched = new Set([
    ...gitFiles(['diff', '--name-only', '-z', base, '--']),
    ...gitFiles(['ls-files', '--others', '--exclude-standard', '-z'])
]);
let failed = false;
let debt = 0;
for (const result of results) {
    const file = path.relative(process.cwd(), result.filePath).split(path.sep).join('/');
    const counts = {};
    for (const message of result.messages) {
        const key = JSON.stringify([message.ruleId, message.severity, message.message]);
        counts[key] = (counts[key] ?? 0) + 1;
        const allowed = baseline.files[file]?.[key] ?? 0;
        if (touched.has(file) || counts[key] > allowed) {
            failed = true;
            console.error(`${file}:${message.line}: ${message.ruleId}: ${message.message}`);
        } else {
            debt++;
        }
    }
}
console.info(`Existing lint debt: ${debt} findings. Comparison base: ${base}.`);
console.info('Run pnpm lint for the full report; baseline entries are not ESLint suppressions.');
process.exitCode = failed ? 1 : 0;
