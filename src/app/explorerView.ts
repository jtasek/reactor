import type { ExplorerView } from './types';

/** Kept apart from `explorerTree`, which loads with the Explorer panel. */
export const EXPLORER_VIEW_KEY = 'reactor:explorer-view';

export const readExplorerView = (value: unknown): ExplorerView =>
    value === 'layers' ? 'layers' : 'objects';
