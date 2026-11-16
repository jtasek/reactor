import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const shared = path.join(root, 'src/shared');

function sourceFiles(directory: string): string[] {
    return readdirSync(directory).flatMap((name) => {
        const file = path.join(directory, name);

        if (statSync(file).isDirectory()) {
            return sourceFiles(file);
        }

        return /\.tsx?$/.test(name) ? [file] : [];
    });
}

const imports = (file: string) =>
    [...readFileSync(file, 'utf8').matchAll(/(?:from|import\()\s*['"]([^'"]+)['"]/g)].map(
        ([, specifier]) => specifier
    );

const outside = (file: string, allowed: string) =>
    imports(file)
        .filter((specifier) => specifier.startsWith('.') || specifier.startsWith('src/'))
        .map((specifier) =>
            specifier.startsWith('src/')
                ? path.join(root, specifier)
                : path.resolve(path.dirname(file), specifier)
        )
        .filter((target) => target.startsWith(path.join(root, 'src')))
        .filter((target) => !target.startsWith(allowed + path.sep))
        .map((target) => `${path.relative(root, file)} → ${path.relative(root, target)}`);

// The server image copies src/shared whole and nothing else from src (see the Dockerfile).
describe('code the server shares with the editor', () => {
    it('comes only from src/shared', () => {
        const serverFiles = [
            ...sourceFiles(path.join(root, 'server')),
            ...['server.prod.ts', 'server.preview.ts'].map((name) => path.join(root, name))
        ];

        expect(serverFiles.flatMap((file) => outside(file, shared))).toEqual([]);
    });

    it('imports nothing from the rest of src', () => {
        expect(sourceFiles(shared).flatMap((file) => outside(file, shared))).toEqual([]);
    });
});
