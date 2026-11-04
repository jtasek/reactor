import type { Context } from 'src/app';
import { viewLayoutRoot } from 'src/app/screenLayouts';
import { artworkModes } from 'src/app/modeHooks';
import { resolveModes } from 'src/app/inheritedModes';
import { describeVariable } from 'src/app/variableDescription';
import type { CompletionVariable } from './completion';

/** Read the same contexts as the canvas, without changing authored or simulated modes. */
export function variableValues(state: Context['state'], variables: CompletionVariable[]) {
    const document = state.currentDocument;
    const frame = document.frames[document.selectedFrameId ?? ''];
    const viewId = state.events.pointer.screenView?.viewId;
    const contexts =
        !frame && document.selectedShapesIds.length
            ? document.selectedShapesIds.map((id) =>
                  artworkModes(state, document.shapes[id], viewId)
              )
            : [
                  resolveModes(document, {
                      simulation: state.previewModes[document.id],
                      frameId:
                          frame?.kind === 'view' ? viewLayoutRoot(document, frame)?.id : frame?.id,
                      viewId:
                          frame?.kind === 'view'
                              ? frame.id
                              : frame?.kind === 'frame'
                                ? viewId
                                : undefined
                  })
              ];

    return variables.map((variable) => {
        const descriptions = contexts.map((context) => {
            const { resolved } = describeVariable(
                document,
                document.variables[variable.id],
                context.modes
            );
            const dimension = document.dimensions[resolved.dimensionId ?? ''];
            const mode = dimension?.modes[resolved.modeId ?? ''];
            const source = dimension ? context.sources[dimension.id] : undefined;
            const base = resolved.usesBaseValue ? ' · Base value' : '';

            return {
                value: String(resolved.value),
                mode: mode ? `${dimension.name}: ${mode.name}${base}` : 'Base value',
                provenance: mode
                    ? `${dimension.name}: ${mode.name} · ${source}${base}`
                    : 'Base value'
            };
        });
        const values = [...new Set(descriptions.map(({ value }) => value))];
        const modes = [...new Set(descriptions.map(({ mode }) => mode))];
        const sources = [...new Set(descriptions.map(({ provenance }) => provenance))];
        // The same mode reached from several places is still one mode.
        const provenance =
            sources.length === 1
                ? sources[0]
                : modes.length === 1
                  ? `${modes[0]} · from several sources`
                  : 'Different inherited modes across selection';

        return {
            ...variable,
            resolvedValue: values.length === 1 ? values[0] : 'Mixed values',
            provenance
        };
    });
}
