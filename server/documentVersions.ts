import * as Y from 'yjs';
import { SCHEMA_VERSION } from '../src/app/services/schemaVersion.ts';

/**
 * The shared map whose keys are the document formats of the editors that wrote to a
 * document; an editor older than the newest key only shows it (see collaboration.ts).
 */
const VERSIONS = 'versions';

/**
 * Removes marks of formats newer than the editor this server serves, and keys that are
 * no format. Such a mark comes from a release that was rolled back, or from a bad or
 * hostile client, and would leave the document view only for every editor served
 * here, with no way back. Returns whether it removed any.
 */
export function dropNewerVersions(document: Y.Doc, version = SCHEMA_VERSION): boolean {
    const versions = document.getMap(VERSIONS);
    const newer = [...versions.keys()].filter((key) => !(Number(key) <= version));

    if (newer.length === 0) {
        return false;
    }

    document.transact(() => newer.forEach((key) => versions.delete(key)));

    return true;
}
