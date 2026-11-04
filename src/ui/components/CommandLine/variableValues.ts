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
            const provenance = mode
                ? `${dimension.name}: ${mode.name} · ${source}${resolved.usesBaseValue ? ' · Base value' : ''}`
                : 'Base value';

            return { value: String(resolved.value), provenance };
        });
        const values = [...new Set(descriptions.map(({ value }) => value))];
        const sources = [...new Set(descriptions.map(({ provenance }) => provenance))];

        return {
            ...variable,
            resolvedValue: values.length === 1 ? values[0] : 'Mixed values',
            provenance:
                sources.length === 1 ? sources[0] : 'Different inherited modes across selection'
        };
    });
}
