import { useAppState } from '../app/hooks';
import {
    projectPreview,
    type PreviewSession,
    type PreviewDiagnostic,
    type PreviewInspection
} from './project';

export interface PreviewProjection {
    serialized: string | null;
    problem: string | null;
    warnings: string[];
    diagnostics: PreviewDiagnostic[];
    /** True while a pointer gesture runs; the preview catches up when it ends. */
    paused: boolean;
}

/** Read the drawing while Overmind tracks its actual dependencies. Image preparation
 * and final validation happen before transmission. Serialization avoids rebuilding an
 * unchanged view after selection-only edits. During a
 * drag only the gesture kind is read, so pointer moves don't rebuild the preview. */
export const usePreviewProjection = (
    inspection: PreviewInspection = {},
    session?: PreviewSession
) =>
    useAppState((state): PreviewProjection => {
        if (state.events.pointer.gesture.kind !== 'idle') {
            return { serialized: null, problem: null, warnings: [], diagnostics: [], paused: true };
        }
        const document = state.currentDocument;
        const warnings: string[] = [];
        const diagnostics: PreviewDiagnostic[] = [];
        const namedDiagnostics = () =>
            diagnostics.map((item) => ({
                ...item,
                name:
                    document.frames[item.id]?.name ??
                    document.shapes[item.id]?.name ??
                    Object.values(document.components).find((source) =>
                        source.shapesIds.includes(item.id)
                    )?.name
            }));
        try {
            const drawing = projectPreview(
                document,
                {},
                warnings,
                session ?? state.previewModeContext,
                inspection,
                diagnostics
            );

            return {
                serialized: JSON.stringify(drawing),
                problem: null,
                warnings: [...new Set(warnings)],
                diagnostics: namedDiagnostics(),
                paused: false
            };
        } catch (error) {
            return {
                serialized: null,
                problem: error instanceof Error ? error.message : 'Preview could not be updated.',
                warnings: [],
                diagnostics: namedDiagnostics(),
                paused: false
            };
        }
    });
