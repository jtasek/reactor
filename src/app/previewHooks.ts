import { useAppState } from './hooks';

export const usePreviewOpen = () =>
    useAppState((state) => state.previewDocumentId === state.currentDocumentId);
