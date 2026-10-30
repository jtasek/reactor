import type { AssetServer } from './services/assetSync';
export { v4 as newId } from 'uuid';
export { loadState, saveState, backupState, removeState } from './services/localStorage';
export {
    initializeRoutes,
    navigate,
    redirect,
    reload,
    reloadPage,
    guardNavigation
} from './services/router';
export { collaboration } from './services/collaboration';
export { deleteDocumentDatabase, openDocumentDatabase } from './services/documentDatabase';
export { openChannel } from './services/tabSync';
export { accounts, forgetOwner, lastOwner, recordSignedOut, shareOwner } from './services/accounts';
export { api, serverTransport } from './services/api';
export { clipboard } from './services/clipboard';
export { assets } from './services/assets';

/** The server's calls for images; none, for its own over HTTP, unless a test gives some. */
export const assetServer = (): AssetServer | undefined => undefined;
export { viewSize } from './services/viewSize';
export { dragTargets } from './services/dragTargets';
